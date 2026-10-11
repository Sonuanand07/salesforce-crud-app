import { config } from './config.js';

export class SfError extends Error {
  constructor(status, messages) {
    super(messages.join('; '));
    this.status = status;
    this.messages = messages;
  }
}

// Only ever send tokens to genuine Salesforce hosts.
export function assertSalesforceUrl(value) {
  const url = new URL(value);
  const testHost = process.env.NODE_ENV === 'test' && url.hostname === '127.0.0.1';
  const ok = testHost || (url.protocol === 'https:' && /\.(salesforce|force)\.com$/i.test(url.hostname));
  if (!ok) throw new SfError(502, ['Unexpected instance URL returned by Salesforce']);
  return url.origin;
}

export function buildAuthUrl({ state, challenge }) {
  const url = new URL(`${config.loginUrl}/services/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'api refresh_token',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

async function tokenRequest(params) {
  const body = new URLSearchParams({ client_id: config.clientId, ...params });
  if (config.clientSecret) body.set('client_secret', config.clientSecret);
  const res = await fetch(`${config.loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new SfError(res.status === 400 ? 401 : res.status, [json.error_description || json.error || 'OAuth token request failed']);
  return json;
}

export async function exchangeCode({ code, verifier }) {
  const t = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token || null,
    instanceUrl: assertSalesforceUrl(t.instance_url),
  };
}

export async function fetchUser(tokens) {
  const res = await fetch(`${tokens.instanceUrl}/services/oauth2/userinfo`, {
    headers: { authorization: `Bearer ${tokens.accessToken}` },
  });
  const u = await res.json().catch(() => ({}));
  return { name: u.name || u.preferred_username || 'Salesforce user', email: u.email || '', username: u.preferred_username || '' };
}

async function refreshAccessToken(session) {
  if (!session.refreshToken) throw new SfError(401, ['Session expired. Please log in again.']);
  // De-duplicate concurrent refreshes.
  session.refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: session.refreshToken })
    .then((t) => {
      session.accessToken = t.access_token;
    })
    .finally(() => {
      session.refreshing = null;
    });
  try {
    await session.refreshing;
  } catch {
    throw new SfError(401, ['Session expired. Please log in again.']);
  }
}

export async function revokeToken(session) {
  const token = session.refreshToken || session.accessToken;
  await fetch(`${config.loginUrl}/services/oauth2/revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => {});
}

function errorMessages(json, status) {
  if (Array.isArray(json)) return json.map((e) => e.message).filter(Boolean);
  if (json?.message) return [json.message];
  return [`Salesforce request failed (${status})`];
}

export async function sfRequest(session, path, { method = 'GET', body } = {}) {
  const send = () =>
    fetch(`${session.instanceUrl}/services/data/v${config.apiVersion}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  let res = await send();
  if (res.status === 401) {
    await refreshAccessToken(session);
    res = await send();
  }
  if (res.status === 204) return null;
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw new SfError(res.status, errorMessages(json, res.status));
  return json;
}

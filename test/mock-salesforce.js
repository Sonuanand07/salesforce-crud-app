import crypto from 'node:crypto';
import http from 'node:http';

// A tiny fake Salesforce (OAuth + REST) so the whole flow can be verified offline.
const FIELDS = ['Name', 'Type', 'Industry', 'Phone', 'Website', 'BillingCity', 'BillingCountry', 'AnnualRevenue', 'NumberOfEmployees', 'Rating'];
const id = (n) => `001${String(n).padStart(12, '0')}AAA`;
let records = Array.from({ length: Number(process.env.MOCK_TOTAL) || 45 }, (_, i) => ({ Id: id(i + 1), Name: `Acme ${i + 1}`, Type: 'Customer' }));
const codes = new Map();
export const stats = { refreshCalls: 0 };
let validToken = 'tok-1';
export const expireToken = () => { validToken = 'rotated-on-server'; };

const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); });
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };

export function makeMock() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const base = `http://127.0.0.1:${server.address().port}`;
    if (url.pathname === '/services/oauth2/authorize') {
      codes.set('code-1', url.searchParams.get('code_challenge'));
      res.writeHead(302, { location: `${url.searchParams.get('redirect_uri')}?code=code-1&state=${url.searchParams.get('state')}` });
      return res.end();
    }
    if (url.pathname === '/services/oauth2/token') {
      const p = new URLSearchParams(await readBody(req));
      if (p.get('grant_type') === 'refresh_token') { stats.refreshCalls++; validToken = 'tok-2'; return send(res, 200, { access_token: 'tok-2' }); }
      const challenge = crypto.createHash('sha256').update(p.get('code_verifier') || '').digest('base64url');
      if (codes.get(p.get('code')) !== challenge) return send(res, 400, { error: 'invalid_grant', error_description: 'PKCE failed' });
      return send(res, 200, { access_token: 'tok-1', refresh_token: 'ref-1', instance_url: base });
    }
    if (url.pathname === '/services/oauth2/revoke') return send(res, 200, {});
    if (req.headers.authorization !== `Bearer ${validToken}`) return send(res, 401, [{ message: 'Session expired or invalid', errorCode: 'INVALID_SESSION_ID' }]);
    if (url.pathname === '/services/oauth2/userinfo') return send(res, 200, { name: 'Test User', email: 't@example.com', preferred_username: 't@example.com' });
    const api = url.pathname.replace(/^\/services\/data\/v[\d.]+/, '');
    if (api === '/sobjects/Account/describe') {
      return send(res, 200, { fields: [{ name: 'Id', type: 'id' }, ...FIELDS.map((n) => ({ name: n, label: n, type: 'string', createable: true, updateable: true, nillable: n !== 'Name', defaultedOnCreate: false, length: 255 }))] });
    }
    if (api === '/query') {
      const q = url.searchParams.get('q');
      const after = /Id > '([^']+)'/.exec(q)?.[1] ?? '';
      const limit = Number(/LIMIT (\d+)/.exec(q)[1]);
      return send(res, 200, { records: records.filter((r) => r.Id > after).slice(0, limit).map((r) => ({ attributes: { type: 'Account' }, ...r })) });
    }
    const m = /^\/sobjects\/Account(?:\/(\w+))?$/.exec(api);
    if (m && req.method === 'POST') { const b = JSON.parse(await readBody(req)); const r = { Id: id(records.length + 1), ...b }; records.push(r); return send(res, 201, { id: r.Id, success: true }); }
    if (m && req.method === 'GET') return send(res, 200, { attributes: {}, ...records.find((r) => r.Id === m[1]) });
    if (m && req.method === 'PATCH') { Object.assign(records.find((r) => r.Id === m[1]), JSON.parse(await readBody(req))); return send(res, 204); }
    if (m && req.method === 'DELETE') { records = records.filter((r) => r.Id !== m[1]); return send(res, 204); }
    return send(res, 404, [{ message: 'not found' }]);
  });
  return server;
}


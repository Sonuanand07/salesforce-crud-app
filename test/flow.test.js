import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { makeMock, stats, expireToken } from './mock-salesforce.js';

let mock; let appServer; let app;
const cookies = {};
const jar = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
const absorb = (res) => { for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (/Expires=Thu, 01 Jan 1970/i.test(c)) delete cookies[k]; else cookies[k] = v; } };
const call = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const res = await fetch(`${app}${path}`, { method, redirect: 'manual', headers: { cookie: jar(), ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  absorb(res);
  return res;
};
const mutate = (path, method, body) => call(path, { method, body, headers: { 'x-requested-with': 'fetch' } });

before(async () => {
  mock = makeMock();
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  const probe = http.createServer();
  await new Promise((r) => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  Object.assign(process.env, { NODE_ENV: 'test', SF_CLIENT_ID: 'cid', SF_LOGIN_URL: `http://127.0.0.1:${mock.address().port}`, APP_URL: `http://127.0.0.1:${port}` });
  const { createApp } = await import('../server/app.js');
  appServer = createApp().listen(port, '127.0.0.1');
  app = `http://127.0.0.1:${port}`;
});
after(() => { mock.close(); appServer.close(); });

test('API rejects unauthenticated requests', async () => {
  assert.equal((await call('/api/me')).status, 401);
});

test('OAuth Authorization Code + PKCE login works end to end', async () => {
  const login = await call('/auth/login');
  assert.equal(login.status, 302);
  const location = new URL(login.headers.get('location'));
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(cookies.oauth_state);
  const authorize = await fetch(location, { redirect: 'manual' });
  const callbackUrl = new URL(authorize.headers.get('location'));
  const cb = await call(callbackUrl.pathname + callbackUrl.search);
  assert.equal(cb.status, 302);
  assert.equal(cb.headers.get('location'), '/');
  assert.ok(cookies.sid);
  const me = await (await call('/api/me')).json();
  assert.equal(me.user.name, 'Test User');
});

test('callback rejects a forged state', async () => {
  const res = await call('/auth/callback?code=x&state=forged');
  assert.match(res.headers.get('location'), /error=/);
});

test('describe returns 5-10 dynamic fields', async () => {
  const meta = await (await call('/api/objects/Account')).json();
  assert.ok(meta.fields.length >= 5 && meta.fields.length <= 10);
  assert.equal(meta.fields.find((f) => f.name === 'Name').required, true);
});

test('pagination returns 20 records at a time using the cursor', async () => {
  const p1 = await (await call('/api/objects/Account/records')).json();
  assert.equal(p1.records.length, 20);
  assert.ok(p1.hasMore);
  const p2 = await (await call(`/api/objects/Account/records?cursor=${p1.nextCursor}`)).json();
  assert.equal(p2.records.length, 20);
  assert.notEqual(p2.records[0].Id, p1.records[19].Id);
  const p3 = await (await call(`/api/objects/Account/records?cursor=${p2.nextCursor}`)).json();
  assert.equal(p3.records.length, 5);
  assert.equal(p3.hasMore, false);
  assert.equal(p3.records[0].attributes, undefined);
});

test('rejects unsupported objects and malicious cursors', async () => {
  assert.equal((await call('/api/objects/User')).status, 400);
  assert.equal((await call("/api/objects/Account/records?cursor=1'%20OR%20'1'='1")).status, 400);
});

test('create, read, update, delete', async () => {
  assert.equal((await call('/api/objects/Account/records', { method: 'POST', body: { Name: 'X' } })).status, 403, 'CSRF header required');
  assert.equal((await mutate('/api/objects/Account/records', 'POST', { Industry: 'Tech' })).status, 400);
  const created = await mutate('/api/objects/Account/records', 'POST', { Name: 'New Co', Industry: 'Tech' });
  assert.equal(created.status, 201);
  const { id: newId } = await created.json();
  assert.equal((await (await call(`/api/objects/Account/records/${newId}`)).json()).Name, 'New Co');
  assert.equal((await mutate(`/api/objects/Account/records/${newId}`, 'PATCH', { Name: 'Renamed' })).status, 204);
  assert.equal((await (await call(`/api/objects/Account/records/${newId}`)).json()).Name, 'Renamed');
  assert.equal((await mutate(`/api/objects/Account/records/${newId}`, 'DELETE')).status, 204);
});

test('expired access token is refreshed transparently', async () => {
  expireToken();
  const res = await call('/api/objects/Account/records');
  assert.equal(res.status, 200);
  assert.equal(stats.refreshCalls, 1);
});

test('logout destroys the session', async () => {
  assert.equal((await mutate('/auth/logout', 'POST')).status, 204);
  assert.equal((await call('/api/me')).status, 401);
});

test('security headers are present', async () => {
  const res = await call('/healthz');
  assert.ok(res.headers.get('content-security-policy'));
  assert.equal(res.headers.get('x-powered-by'), null);
});

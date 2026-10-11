import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { createSession, destroySession, getSession, randomToken, SESSION_TTL_MS } from '../session.js';
import { buildAuthUrl, exchangeCode, fetchUser, revokeToken } from '../salesforce.js';
import { csrfGuard } from '../middleware.js';

const router = Router();
const pending = new Map(); // state -> { verifier, expires }
const cookieBase = { httpOnly: true, sameSite: 'lax', secure: config.secureCookies, path: '/' };

const fail = (res, message) => res.redirect(`/?error=${encodeURIComponent(String(message).slice(0, 200))}`);

router.get('/login', (_req, res) => {
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  for (const [s, p] of pending) if (p.expires < Date.now()) pending.delete(s);
  pending.set(state, { verifier, expires: Date.now() + 10 * 60 * 1000 });
  res.cookie('oauth_state', state, { ...cookieBase, maxAge: 10 * 60 * 1000 });
  res.redirect(buildAuthUrl({ state, challenge }));
});

router.get('/callback', async (req, res) => {
  const { code, state, error, error_description: description } = req.query;
  const cookieState = req.cookies.oauth_state;
  res.clearCookie('oauth_state', cookieBase);
  if (error) return fail(res, description || error);

  const entry = typeof state === 'string' ? pending.get(state) : null;
  if (typeof state === 'string') pending.delete(state);
  if (typeof code !== 'string' || !entry || entry.expires < Date.now() || state !== cookieState) {
    return fail(res, 'Login session expired. Please try again.');
  }
  try {
    const tokens = await exchangeCode({ code, verifier: entry.verifier });
    const user = await fetchUser(tokens);
    const sid = createSession({ ...tokens, user });
    res.cookie('sid', sid, { ...cookieBase, maxAge: SESSION_TTL_MS });
    return res.redirect('/');
  } catch (err) {
    return fail(res, err.message);
  }
});

router.post('/logout', csrfGuard, async (req, res) => {
  const sid = req.cookies.sid;
  const session = getSession(sid);
  if (session) await revokeToken(session);
  destroySession(sid);
  res.clearCookie('sid', cookieBase);
  res.status(204).end();
});

export default router;

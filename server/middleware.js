import { config } from './config.js';
import { getSession } from './session.js';

export function requireAuth(req, res, next) {
  const session = getSession(req.cookies.sid);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  req.sf = session;
  return next();
}

// CSRF defence for state-changing requests: custom header + same-origin check (on top of SameSite=Lax cookies).
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const sameOrigin = !origin || origin === new URL(config.appUrl).origin;
  if (req.get('x-requested-with') !== 'fetch' || !sameOrigin) return res.status(403).json({ error: 'Blocked request' });
  return next();
}

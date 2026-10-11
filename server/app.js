import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import apiRouter from './routes/api.js';
import { csrfGuard } from './middleware.js';
import { SfError } from './salesforce.js';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': null, 'img-src': ["'self'", 'data:'] } } }));
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));
  const limiter = (limit) => rateLimit({ windowMs: 60_000, limit, standardHeaders: true, legacyHeaders: false });

  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.use('/auth', limiter(40), authRouter);
  app.use('/api', limiter(300), csrfGuard, apiRouter);

  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(path.join(dist, 'index.html')) : next()));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof SfError) {
      const status = err.status >= 500 ? 502 : err.status;
      return res.status(status).json({ error: err.messages[0], details: err.messages });
    }
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong' });
  });
  return app;
}

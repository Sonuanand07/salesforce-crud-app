import { assertConfig, config } from './config.js';
import { createApp } from './app.js';

assertConfig();
const server = createApp().listen(config.port, () => {
  console.log(`Server running at ${config.appUrl} (port ${config.port})`);
  console.log(`OAuth callback URL: ${config.redirectUri}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));

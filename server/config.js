import 'dotenv/config';

const env = process.env;
const appUrl = (env.APP_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, '');

export const config = {
  port: Number(env.PORT) || 3000,
  appUrl,
  secureCookies: appUrl.startsWith('https://'),
  clientId: env.SF_CLIENT_ID || '',
  clientSecret: env.SF_CLIENT_SECRET || '',
  loginUrl: (env.SF_LOGIN_URL || 'https://login.salesforce.com').replace(/\/+$/, ''),
  apiVersion: env.SF_API_VERSION || '61.0',
  pageSize: 20,
  redirectUri: `${appUrl}/auth/callback`,
};

export function assertConfig() {
  if (!config.clientId) {
    throw new Error('SF_CLIENT_ID is missing. Copy .env.example to .env and add your External Client App consumer key.');
  }
}

# Salesforce setup: Developer Org and External Client App

Salesforce menu labels change between releases. If something is named slightly differently, use the Setup Quick Find box.

## 1. Create a Developer Org
1. Go to https://developer.salesforce.com/signup and register (use a real email).
2. Verify the email and set a password. You land in your org (`https://<yourdomain>.develop.my.salesforce.com`).
3. Optional: add sample data. Create a few Accounts, Contacts, etc., or use the sample records that come with the org.

## 2. Create the External Client App
1. Click the gear icon > **Setup**. In Quick Find type **External Client App Manager** and open it.
2. Click **New External Client App**.
3. **Basic Information:** name `CRUD Manager`, contact email (yours), **Distribution State: Local**.
4. Expand **API (Enable OAuth Settings)** and tick **Enable OAuth**.
5. **Callback URL**: add one per line:
   - `http://localhost:3000/auth/callback` (local run)
   - `http://localhost:5173/auth/callback` (Vite dev server, optional)
   - `https://<your-app>.onrender.com/auth/callback` (production, add after you know the URL)
6. **OAuth Scopes**, move these to Selected:
   - *Manage user data via APIs (api)*
   - *Perform requests at any time (refresh_token, offline_access)*
7. **Flow Enablement:** tick **Enable Authorization Code and Credentials Flow**.
8. **Security:** keep **Require secret for Web Server Flow** ticked and tick **Require Proof Key for Code Exchange (PKCE) extension for Supported Authorization Flows**. Leave "Require secret for Refresh Token Flow" ticked.
9. Click **Create**.

## 3. Get the Consumer Key and Secret
1. Open the app in External Client App Manager > **Settings** tab > **OAuth Settings** > **Consumer Key and Secret**.
2. Verify your identity if asked (a code is emailed to you), then copy:
   - Consumer Key -> `SF_CLIENT_ID`
   - Consumer Secret -> `SF_CLIENT_SECRET`

## 4. Allow users to authorize
On the app's **Policies** tab > **OAuth Policies**, set **Permitted Users** to **All users can self-authorize** (or pre-authorize your profile) and save.

## 5. Put the values in `.env`
```
SF_CLIENT_ID=<consumer key>
SF_CLIENT_SECRET=<consumer secret>
APP_URL=http://localhost:3000
```

## Troubleshooting
| Error | Fix |
| --- | --- |
| `redirect_uri_mismatch` | The callback URL in the app must exactly equal `APP_URL/auth/callback` (scheme, host, port, no trailing slash) |
| `invalid_client_id` or `invalid_client` | New apps can take up to ~10 minutes to activate. Re-check the key and secret. |
| `OAUTH_APPROVAL_ERROR_GENERIC` / app not approved | Set Permitted Users as in step 4 |
| `invalid_grant` / PKCE failed | PKCE is on in the app, but check `APP_URL` matches the callback used when logging in |
| Login works but API calls fail with `INSUFFICIENT_ACCESS` | Your user needs object permissions (System Administrator profile in a dev org has them) |
| Sandbox or My Domain login | Set `SF_LOGIN_URL=https://test.salesforce.com` or your My Domain URL |

# Salesforce CRUD Manager

A web app that performs full CRUD on the Salesforce standard objects **Account, Opportunity, Lead, Contact and Case** without opening the Salesforce UI. Login uses **OAuth 2.0 (Authorization Code + PKCE)** through a Salesforce **External Client App**, and every operation uses the resulting tokens.

- **Live URL:** https://salesforce-crud-app-pzbo.onrender.com
- **Repository:** https://github.com/Sonuanand07/salesforce-crud-app

**Stack:** React 18 + Vite (frontend), Node.js 22 + Express (backend), Salesforce REST API.

## How each requirement is met

| Requirement | Implementation |
| --- | --- |
| Dev org + External Client App | Step-by-step in [docs/SALESFORCE_SETUP.md](docs/SALESFORCE_SETUP.md) |
| OAuth 2.0 via External Client App, tokens used for operations | `server/routes/auth.js`, `server/salesforce.js` (Auth Code + PKCE, automatic refresh on 401, token revoke on logout) |
| Login button | `client/src/components/LoginScreen.jsx` |
| Dropdown with 5 objects | `Dashboard.jsx`, whitelist in `server/objects.js` |
| Dynamic fields, min 5 / max 10 | Fields come from the live **describe** call (`selectFields`); picklists, required flags and read-only rules come from your org |
| Pagination: 20 at a time, next 20 on scroll end | Keyset pagination (`LIMIT 21`, `Id > cursor`) + `IntersectionObserver` in `RecordTable.jsx` |
| View, update, delete buttons (+ create) | Row buttons and "New" button open `RecordModal` / `ConfirmDelete` |
| Free online deployment | Render blueprint `render.yaml`, guide in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

**Extras:** debounced name search, validation on client and server, loading skeletons, toasts, dark mode, keyboard accessible dialogs, 16 automated tests (including a fake Salesforce server that runs the full OAuth + CRUD flow).

## Architecture

```
Browser (React)  <--cookie: opaque session id-->  Express server  <--Bearer token-->  Salesforce
                                                  holds tokens,
                                                  validates input
```

The browser never sees an access or refresh token. Tokens live in server memory, keyed by a random httpOnly session cookie.

```
server/
  index.js, app.js       Express setup, security headers, rate limits, static hosting
  config.js              Environment configuration
  session.js             In-memory server-side sessions
  salesforce.js          OAuth + REST client (refresh, errors)
  objects.js             Object whitelist, field selection, SOQL builder, input validation
  middleware.js          Auth guard + CSRF guard
  routes/auth.js         /auth/login, /auth/callback, /auth/logout
  routes/api.js          /api/objects/** CRUD endpoints
client/src/              React app (components, hooks, api client)
test/                    Unit tests + mock-Salesforce integration tests
```

## Run locally

Prerequisites: Node.js 20.19+ (see `.nvmrc`), a Salesforce Developer Org and an External Client App ([setup guide](docs/SALESFORCE_SETUP.md)).

```bash
npm install
npm run build              # installs client deps and builds the React app
cp .env.example .env       # then fill SF_CLIENT_ID and SF_CLIENT_SECRET
npm start                  # http://localhost:3000
```

Register `http://localhost:3000/auth/callback` as a callback URL in your External Client App.
For the deployed app, also register `https://salesforce-crud-app-pzbo.onrender.com/auth/callback` and set `APP_URL` to `https://salesforce-crud-app-pzbo.onrender.com` in Render.

**Hot-reload development** (two terminals): set `APP_URL=http://localhost:5173` in `.env`, register `http://localhost:5173/auth/callback`, then run `npm run dev` and `npm run dev:client` (open http://localhost:5173).

**Tests:** `npm test` (no Salesforce org needed).

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `SF_CLIENT_ID` | yes | External Client App consumer key |
| `SF_CLIENT_SECRET` | recommended | Consumer secret (needed when "Require secret for Web Server Flow" is on) |
| `APP_URL` | yes | Public URL of this app, no trailing slash. Callback = `APP_URL/auth/callback` |
| `SF_LOGIN_URL` | no | Default `https://login.salesforce.com` (use `https://test.salesforce.com` for sandboxes) |
| `SF_API_VERSION` | no | Default `61.0` |
| `PORT` | no | Default `3000` |

## REST API (all require login)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/me` | Current user |
| GET | `/api/objects` | Supported objects |
| GET | `/api/objects/:name` | Displayed fields and metadata |
| GET | `/api/objects/:name/records?cursor=&q=` | 20 records per page |
| GET / POST | `/api/objects/:name/records[/:id]` | Read one / create |
| PATCH / DELETE | `/api/objects/:name/records/:id` | Update / delete |

## Security

- OAuth 2.0 Authorization Code with PKCE (S256) and a random `state` bound to a cookie
- Tokens stored server-side only; session cookie is `httpOnly`, `SameSite=Lax`, `Secure` on HTTPS
- Instance URL validated to be a `salesforce.com` / `force.com` host before tokens are sent
- Object names and record ids whitelisted/validated; SOQL values escaped (no injection)
- Request bodies validated against live field metadata (unknown and read-only fields rejected)
- CSRF guard (custom header + same-origin check), Helmet security headers with CSP, rate limiting
- Tokens revoked on logout; `npm audit` reports 0 vulnerabilities; no secrets in the repo (`.env` is git-ignored)

## Known limitations

- Sessions live in memory: a server restart (including Render free-tier sleep) logs users out.
- Records are ordered by Salesforce Id (required for reliable cursor pagination), not by name.
- Only the five standard objects are supported, with a curated set of up to 10 fields each.

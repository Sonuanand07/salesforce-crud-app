# Git push and deployment guide

## Which free host is best?
**Render (recommended).** It runs a normal long-lived Node server on its free plan, which this app needs because OAuth sessions are held in server memory and the Express server serves the React build. It auto-deploys on every `git push`. Serverless hosts (Vercel/Netlify functions) are a poor fit here. Railway and Koyeb also work with the same build and start commands.

## 1. Push to GitHub
1. Create an empty **public** repository on GitHub (e.g. `salesforce-crud-app`), no README or .gitignore.
2. In the project folder:
```bash
git init
git add .
git commit -m "feat: Salesforce CRUD app with OAuth 2.0"
git branch -M main
git remote add origin https://github.com/<your-username>/salesforce-crud-app.git
git push -u origin main
```
3. Check that `.env` is **not** in the repo (it is git-ignored). Never commit your consumer secret.

If Git asks for a password, use a Personal Access Token (GitHub > Settings > Developer settings) or `gh auth login`.

## 2. Deploy on Render
1. Sign in at https://render.com with GitHub.
2. **New > Web Service** > select your repo.
3. Settings: **Runtime** Node, **Build Command** `npm install && npm run build`, **Start Command** `npm start`, **Instance Type** Free. (Or use **New > Blueprint**, which reads `render.yaml`.)
4. Choose the service **name** first. Your URL will be `https://<name>.onrender.com`.
5. Add **Environment Variables**:
   - `SF_CLIENT_ID` = consumer key
   - `SF_CLIENT_SECRET` = consumer secret
   - `APP_URL` = `https://<name>.onrender.com` (no trailing slash)
   - `SF_LOGIN_URL` = `https://login.salesforce.com`
   - `NODE_VERSION` = `22`
6. Click **Create Web Service** and wait for "Live".
7. In Salesforce, add `https://<name>.onrender.com/auth/callback` to the External Client App callback URLs and save.
8. Open the URL and click **Log in with Salesforce**.

## 3. Free-tier notes
- The service sleeps after ~15 minutes idle; the first request then takes ~30-60 seconds. Open the link yourself shortly before you send it, and mention this in your email.
- A sleep or restart clears sessions, so you will simply log in again.
- Optional: ping `https://<name>.onrender.com/healthz` every 10 minutes (e.g. UptimeRobot) to keep it awake.

## 4. Submission checklist (from the assignment)
- Deployed link works and login completes
- Public Git repository link
- Updated resume
- Email all three to **careers@cloudvandana.com** within 10 working days
- The assignment says only graduated candidates may submit. Confirm you are eligible.

## Troubleshooting
| Problem | Fix |
| --- | --- |
| Build fails on Node version | Set `NODE_VERSION=22` |
| `redirect_uri_mismatch` after deploy | `APP_URL` and the Salesforce callback must match exactly, then redeploy |
| Login loops back to the login page | `APP_URL` must start with `https://` in production so the secure cookie is accepted |
| `git push` rejected | `git pull --rebase origin main`, then push again |

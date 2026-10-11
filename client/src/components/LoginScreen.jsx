import { Cloud, Lock, ListChecks, Zap } from 'lucide-react';

export default function LoginScreen({ error }) {
  return (
    <main className="login">
      <div className="login__card">
        <span className="logo"><Cloud size={28} aria-hidden="true" /></span>
        <h1>Salesforce CRUD Manager</h1>
        <p className="muted">Create, view, edit and delete Accounts, Opportunities, Leads, Contacts and Cases without opening Salesforce.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <a className="btn btn--large" href="/auth/login">Log in with Salesforce</a>
        <ul className="login__points">
          <li><Lock size={16} aria-hidden="true" /> OAuth 2.0 with PKCE. Your password never touches this app.</li>
          <li><ListChecks size={16} aria-hidden="true" /> Live field metadata, so forms always match your org.</li>
          <li><Zap size={16} aria-hidden="true" /> Loads 20 records at a time as you scroll.</li>
        </ul>
      </div>
    </main>
  );
}

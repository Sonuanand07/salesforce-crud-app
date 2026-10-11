import { useState } from 'react';
import Modal from './Modal.jsx';

export default function ConfirmDelete({ label, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Delete record?"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn--danger" onClick={confirm} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</button>
        </>
      }
    >
      <p>
        You are about to permanently delete <strong>{label}</strong> from Salesforce. This cannot be undone from this app.
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
    </Modal>
  );
}

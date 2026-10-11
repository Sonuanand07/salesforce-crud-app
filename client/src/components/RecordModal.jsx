import { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { api } from '../api.js';
import { formatValue } from '../format.js';
import Modal from './Modal.jsx';
import FieldInput from './FieldInput.jsx';

const toForm = (fields, record) =>
  Object.fromEntries(fields.map((f) => [f.name, record?.[f.name] ?? (f.type === 'boolean' ? false : '')]));

// One dialog for the three modes: view (read-only), edit and create.
export default function RecordModal({ meta, initialMode, recordId, onClose, onSaved }) {
  const { name, label, fields } = meta;
  const [mode, setMode] = useState(initialMode);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(() => toForm(fields, null));
  const [loading, setLoading] = useState(Boolean(recordId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!recordId) return undefined;
    let live = true;
    api
      .get(name, recordId)
      .then((r) => {
        if (!live) return;
        setRecord(r);
        setForm(toForm(fields, r));
        setLoading(false);
      })
      .catch((e) => {
        if (!live) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [name, recordId, fields]);

  const editable = useMemo(() => fields.filter((f) => (mode === 'create' ? f.createable : f.updateable)), [fields, mode]);
  const title = mode === 'create' ? `New ${label}` : mode === 'edit' ? `Edit ${label}` : `${label} details`;

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const values = {};
    for (const f of editable) {
      const current = form[f.name];
      const original = record?.[f.name] ?? (f.type === 'boolean' ? false : '');
      if (mode === 'create' || current !== original) values[f.name] = current;
    }
    if (mode === 'edit' && !Object.keys(values).length) return onClose();
    setSaving(true);
    try {
      if (mode === 'create') await api.create(name, values);
      else await api.update(name, recordId, values);
      return await onSaved(mode);
    } catch (err) {
      setError(err.message);
      return setSaving(false);
    }
  }

  const readOnly = mode === 'view';
  return (
    <Modal
      wide
      title={title}
      onClose={onClose}
      footer={
        readOnly ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
            <button type="button" className="btn" onClick={() => setMode('edit')} disabled={loading || !record}>
              <Pencil size={16} /> Edit
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" form="record-form" className="btn" disabled={saving || loading}>{saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}</button>
          </>
        )
      }
    >
      {loading && <p className="muted">Loading record…</p>}
      {!loading && readOnly && record && (
        <dl className="details">
          <div><dt>Record Id</dt><dd><code>{record.Id}</code></dd></div>
          {fields.map((f) => (
            <div key={f.name}><dt>{f.label}</dt><dd>{formatValue(f, record[f.name])}</dd></div>
          ))}
        </dl>
      )}
      {!loading && !readOnly && (
        <form id="record-form" className="form" onSubmit={submit}>
          {editable.map((f, i) => (
            <FieldInput key={f.name} field={f} value={form[f.name]} autoFocus={i === 0} disabled={saving} onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))} />
          ))}
        </form>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Modal>
  );
}

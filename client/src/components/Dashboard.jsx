import { useCallback, useRef, useState } from 'react';
import { LogOut, Plus, RefreshCw, Search, Cloud } from 'lucide-react';
import { api } from '../api.js';
import { OBJECT_OPTIONS } from '../constants.js';
import useDebounce from '../hooks/useDebounce.js';
import useObjectMeta from '../hooks/useObjectMeta.js';
import useRecords from '../hooks/useRecords.js';
import RecordTable from './RecordTable.jsx';
import RecordModal from './RecordModal.jsx';
import ConfirmDelete from './ConfirmDelete.jsx';
import Toasts from './Toasts.jsx';

const recordLabel = (meta, record) =>
  meta.fields.map((f) => record[f.name]).filter(Boolean).slice(0, 2).join(' ') || record.Id;

export default function Dashboard({ user, onLogout, onExpire }) {
  const [objectName, setObjectName] = useState(OBJECT_OPTIONS[0]);
  const [searchInput, setSearchInput] = useState('');
  const [modal, setModal] = useState(null); // { type: 'view' | 'edit' | 'create' | 'delete', record? }
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const search = useDebounce(searchInput.trim());
  const { meta, error: metaError } = useObjectMeta(objectName, onExpire);
  const list = useRecords(objectName, search, onExpire);

  const notify = useCallback((type, message) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const changeObject = (e) => {
    setObjectName(e.target.value);
    setSearchInput('');
    setModal(null);
  };

  async function onSaved(mode) {
    setModal(null);
    notify('success', mode === 'create' ? `${objectName} created` : `${objectName} updated`);
    list.refresh();
  }

  async function confirmDelete() {
    await api.remove(objectName, modal.record.Id);
    list.removeRecord(modal.record.Id);
    setModal(null);
    notify('success', `${objectName} deleted`);
  }

  return (
    <>
      <header className="topbar">
        <div className="brand"><span className="logo logo--sm"><Cloud size={18} aria-hidden="true" /></span> Salesforce CRUD Manager</div>
        <div className="topbar__user">
          <span className="user" title={user.email}>{user.name}</span>
          <button type="button" className="btn btn--ghost btn--small" onClick={onLogout}><LogOut size={14} /> Log out</button>
        </div>
      </header>

      <main className="page">
        <div className="toolbar">
          <div className="toolbar__group">
            <label htmlFor="object-select" className="sr-only">Salesforce object</label>
            <select id="object-select" className="select" value={objectName} onChange={changeObject}>
              {OBJECT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <div className="search">
              <Search size={16} aria-hidden="true" />
              <input type="search" placeholder={`Search ${objectName.toLowerCase()} by ${objectName === 'Case' ? 'subject' : 'name'}`} aria-label="Search records" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} maxLength={80} />
            </div>
          </div>
          <div className="toolbar__group">
            <button type="button" className="btn btn--ghost" onClick={list.refresh} aria-label="Refresh records"><RefreshCw size={16} /> Refresh</button>
            <button type="button" className="btn" disabled={!meta} onClick={() => setModal({ type: 'create' })}><Plus size={16} /> New {objectName}</button>
          </div>
        </div>

        {metaError && <p className="state state--error" role="alert">{metaError}</p>}
        {meta ? (
          <RecordTable
            fields={meta.fields}
            {...list}
            onLoadMore={list.loadMore}
            onView={(record) => setModal({ type: 'view', record })}
            onEdit={(record) => setModal({ type: 'edit', record })}
            onDelete={(record) => setModal({ type: 'delete', record })}
          />
        ) : (
          !metaError && <p className="state" role="status">Loading fields…</p>
        )}
      </main>

      {meta && modal && modal.type !== 'delete' && (
        <RecordModal key={`${modal.type}-${modal.record?.Id ?? 'new'}`} meta={meta} initialMode={modal.type} recordId={modal.record?.Id} onClose={() => setModal(null)} onSaved={onSaved} />
      )}
      {meta && modal?.type === 'delete' && <ConfirmDelete label={recordLabel(meta, modal.record)} onConfirm={confirmDelete} onClose={() => setModal(null)} />}
      <Toasts toasts={toasts} />
    </>
  );
}

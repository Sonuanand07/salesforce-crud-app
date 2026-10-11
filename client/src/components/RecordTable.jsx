import { useEffect, useRef } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { formatValue } from '../format.js';

export default function RecordTable({ fields, records, loading, hasMore, error, onLoadMore, onView, onEdit, onDelete }) {
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);

  // Infinite scroll: when the sentinel at the bottom of the scroll area becomes visible, load the next 20.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return undefined;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && onLoadMore(), { root: scrollRef.current, rootMargin: '160px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, records.length, onLoadMore]);

  const empty = !loading && !error && records.length === 0;

  return (
    <section className="table-card" aria-label="Records">
      <div className="table-scroll" ref={scrollRef} tabIndex={0}>
        <table>
          <thead>
            <tr>
              {fields.map((f) => <th key={f.name} scope="col">{f.label}</th>)}
              <th scope="col" className="sticky-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.Id}>
                {fields.map((f) => (
                  <td key={f.name} title={r[f.name] != null ? String(r[f.name]) : undefined}>{formatValue(f, r[f.name])}</td>
                ))}
                <td className="sticky-col">
                  <div className="row-actions">
                    <button type="button" className="btn btn--small btn--ghost" onClick={() => onView(r)}><Eye size={14} /> View</button>
                    <button type="button" className="btn btn--small btn--ghost" onClick={() => onEdit(r)}><Pencil size={14} /> Edit</button>
                    <button type="button" className="btn btn--small btn--danger-ghost" onClick={() => onDelete(r)}><Trash2 size={14} /> Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {loading && records.length === 0 && Array.from({ length: 6 }, (_, i) => (
              <tr key={`s${i}`} className="skeleton" aria-hidden="true">
                <td colSpan={fields.length + 1}><span /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {empty && <p className="state">No records found.</p>}
        {error && <p className="state state--error" role="alert">{error}</p>}
        <div ref={sentinelRef} className="sentinel" aria-hidden="true" />
        {loading && records.length > 0 && <p className="state" role="status">Loading more…</p>}
        {!hasMore && !loading && records.length > 0 && <p className="state muted">You have reached the end · {records.length} records</p>}
      </div>
    </section>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const initial = { records: [], cursor: null, hasMore: false, loading: true, error: null };

// Cursor-based pagination: 20 records per request, next page requested on scroll end.
export default function useRecords(objectName, search, onUnauthorized) {
  const [state, setState] = useState(initial);
  const requestId = useRef(0);
  const busy = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const fetchPage = useCallback(
    async (reset) => {
      const id = ++requestId.current;
      busy.current = true;
      setState((s) => ({ ...(reset ? initial : s), loading: true, error: null }));
      try {
        const cursor = reset ? null : stateRef.current.cursor;
        const data = await api.list(objectName, { cursor, q: search });
        if (id !== requestId.current) return;
        setState((s) => ({
          records: reset ? data.records : [...s.records, ...data.records],
          cursor: data.nextCursor,
          hasMore: data.hasMore,
          loading: false,
          error: null,
        }));
      } catch (e) {
        if (id !== requestId.current) return;
        if (e.status === 401) onUnauthorized();
        setState((s) => ({ ...s, loading: false, hasMore: false, error: e.message }));
      } finally {
        if (id === requestId.current) busy.current = false;
      }
    },
    [objectName, search, onUnauthorized]
  );

  useEffect(() => {
    fetchPage(true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!busy.current && stateRef.current.hasMore) fetchPage(false);
  }, [fetchPage]);
  const refresh = useCallback(() => fetchPage(true), [fetchPage]);
  const replaceRecord = useCallback((record) => setState((s) => ({ ...s, records: s.records.map((r) => (r.Id === record.Id ? record : r)) })), []);
  const removeRecord = useCallback((recordId) => setState((s) => ({ ...s, records: s.records.filter((r) => r.Id !== recordId) })), []);

  return { ...state, loadMore, refresh, replaceRecord, removeRecord };
}

import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function useObjectMeta(name, onUnauthorized) {
  const [state, setState] = useState({ meta: null, error: null });

  useEffect(() => {
    let live = true;
    setState({ meta: null, error: null });
    api
      .describe(name)
      .then((meta) => live && setState({ meta, error: null }))
      .catch((e) => {
        if (!live) return;
        if (e.status === 401) onUnauthorized();
        setState({ meta: null, error: e.message });
      });
    return () => {
      live = false;
    };
  }, [name, onUnauthorized]);

  return state;
}

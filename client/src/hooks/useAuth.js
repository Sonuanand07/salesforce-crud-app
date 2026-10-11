import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

export default function useAuth() {
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    let live = true;
    api
      .me()
      .then((d) => live && setState({ loading: false, user: d.user }))
      .catch(() => live && setState({ loading: false, user: null }));
    return () => {
      live = false;
    };
  }, []);

  const expire = useCallback(() => setState({ loading: false, user: null }), []);
  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setState({ loading: false, user: null });
    }
  }, []);

  return { ...state, logout, expire };
}

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, hasSupabase } from "../lib/supabase";

const AuthCtx = createContext({ session: null, loading: true });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  // Mock mode: no Supabase configured → treat as signed in so UI is workable.
  const [session, setSession] = useState(hasSupabase ? null : { user: { email: "mock@attesta.local" } });
  const [loading, setLoading] = useState(hasSupabase);

  useEffect(() => {
    if (!hasSupabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthCtx.Provider value={{ session, loading }}>{children}</AuthCtx.Provider>;
}

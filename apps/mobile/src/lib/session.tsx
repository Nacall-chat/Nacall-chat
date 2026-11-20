import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { accessStatus, type AccessStatus, type MfaGate } from './access';
import { supabase, supabaseConfigured } from './supabase';

type SessionValue = { status: AccessStatus; session: Session | null; signOut: () => Promise<void> };
const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(!supabaseConfigured);
  const [mfa, setMfa] = useState<MfaGate>('checking');

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoaded(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setMfa('checking');
      return;
    }
    let live = true;
    // Conta com 2FA só entra depois de confirmar o código (sessão aal2).
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (live) setMfa(data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2' ? 'challenge' : 'ok');
    });
    return () => {
      live = false;
    };
  }, [session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<SessionValue>(
    () => ({
      status: accessStatus(Boolean(session), mfa, loaded),
      session,
      signOut: async () => {
        await supabase?.auth.signOut();
      },
    }),
    [session, mfa, loaded],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession() {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession precisa estar dentro de <SessionProvider />');
  return value;
}

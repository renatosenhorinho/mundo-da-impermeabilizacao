import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  loginError: string | null;
  signOut: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<boolean>;
  fallbackLogin: (password: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        if (!supabase) {
          // Verify local fallback session if Supabase isn't configured
          const rawSession = localStorage.getItem('mdi_admin_session');
          if (rawSession) {
            const ls = JSON.parse(rawSession);
            if (ls && ls.value && ls.expiresAt > Date.now()) {
              setUser({ id: 'local-admin', email: 'admin@local' } as User);
            } else {
              localStorage.removeItem('mdi_admin_session');
            }
          }
          if (mounted) setIsLoading(false);
          return;
        }

        // 1. Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
        }

        // 2. Listen to auth changes (this handles auto-refresh behind the scenes)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
          if (mounted) {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            if (currentSession) {
              setLoginError(null);
            }
          }
        });

        if (mounted) setIsLoading(false);

        return () => subscription.unsubscribe();
      } catch (e) {
        console.error('Auth initialization error:', e);
        if (mounted) setIsLoading(false);
      }
    }

    initializeAuth();

    return () => { mounted = false; };
  }, []);

  const signIn = async (email: string, pass: string): Promise<boolean> => {
    setLoginError(null);
    if (!supabase) return false;
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setIsLoading(false);
    if (error) {
      setLoginError('Credenciais inválidas. Tente novamente.');
      return false;
    }
    return true;
  };

  const fallbackLogin = (pass: string): boolean => {
    const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY;
    if (ADMIN_KEY && pass === ADMIN_KEY) {
      localStorage.setItem('mdi_admin_session', JSON.stringify({
        value: true,
        expiresAt: Date.now() + 1000 * 60 * 60 * 6 // 6 horas
      }));
      setUser({ id: 'local-admin', email: 'admin@local' } as User);
      setLoginError(null);
      return true;
    }
    setLoginError('Senha incorreta.');
    return false;
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('mdi_admin_session');
    setSession(null);
    setUser(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ session, user, isLoading, loginError, signIn, fallbackLogin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

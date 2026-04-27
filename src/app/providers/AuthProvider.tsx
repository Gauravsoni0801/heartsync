import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';
import type { Profile } from '../../lib/types';

// Context Type Definition
type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
};

// Create Context
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔥 Optimized Fetch Profile with Redirect Logic
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      
      setProfile(data);

      // Current path check
      const path = window.location.pathname;

      // 🔄 PHASE 4 REDIRECTS
      if (data) {
        if (!data.is_paired && path === '/') {
          // Unpaired user dashboard par hai -> Send to Connect
          window.location.replace('/connect');
        } else if (data.is_paired && path === '/connect') {
          // Paired user connect page par hai -> Send to Dashboard
          window.location.replace('/');
        }
      }

    } catch (error) {
      console.error('Auth Error:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial Session Check
    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const currentSession = data.session;
      
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        await fetchProfile(currentSession.user.id);
      } else {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (newSession?.user) {
        fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
        setLoading(false);
        // Logout hone par auth page par bhej sakte ho agar chaho
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { useSyncStore } from '../../store/useSyncStore';

export const ProtectedRoute = () => {
  const { session, setSession, setActiveConnection } = useSyncStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndConnection = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      if (currentSession) {
        // Fetch active connection for this user
        const { data: connection } = await supabase
          .from('connections')
          .select('*')
          .or(`user_a_id.eq.${currentSession.user.id},user_b_id.eq.${currentSession.user.id}`)
          .eq('status', 'active')
          .maybeSingle();

        if (connection) {
          setActiveConnection(connection);
        } else {
          setActiveConnection(null);
        }
      }
      setLoading(false);
    };

    checkAuthAndConnection();
  }, [setSession, setActiveConnection]);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!session) return <Navigate to="/auth" />;

  return <Outlet />;
};
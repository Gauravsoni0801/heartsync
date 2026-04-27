import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../app/providers/AuthProvider';
import { SplashScreen } from '../../components/ui/SplashScreen';
import { connectionService } from '../../lib/connectionService';
import { Copy, UserPlus, Check, Loader2, LogOut } from 'lucide-react';
import type { ConnectionWithProfile } from '../../lib/types';
import toast from 'react-hot-toast'; 

export const ConnectPage = () => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<ConnectionWithProfile[]>([]);
  const [partnerIdInput, setPartnerIdInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadInvites = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await connectionService.getPendingInvites();
      if (!error && data) {
        setInvites(data as ConnectionWithProfile[]);
      }
    } catch (err) {
      console.error("Invite load error:", err);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    loadInvites().finally(() => setLoading(false));

    // 🔥 MASTER REALTIME CHANNEL
    // Dono tables (connections aur profiles) ko ek hi channel mein sunenge
    const syncChannel = supabase
      .channel('pairing-system')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections' },
        (payload: any) => {
          // Case 1: Partner ne accept kiya (status active hua)
          if (payload.new && payload.new.status === 'active') {
            const isMeInvolved = payload.new.user_a_id === userId || payload.new.user_b_id === userId;
            if (isMeInvolved) {
              toast.success("Hearts Synced! Redirecting...");
              setTimeout(() => window.location.replace('/'), 500);
            }
          }
          // Case 2: Nayi request aayi ya purani delete hui
          loadInvites();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          // Case 3: Profile table mein is_paired true hua (Backup check)
          if (payload.new.is_paired === true) {
            window.location.replace('/');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(syncChannel);
    };
  }, [session?.user?.id, loadInvites]);

  const handleSendInvite = async () => {
    if (!partnerIdInput.trim()) return;
    try {
      setActionLoading(true);
      const { error } = await connectionService.sendInvite(partnerIdInput.trim());
      if (error) {
        toast.error(error.message); 
      } else {
        setPartnerIdInput('');
        toast.success("Request sent! 🚀"); 
        loadInvites();
      }
    } catch (err: any) {
      toast.error("Failed to send request");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptInvite = async (connectionId: string) => {
    try {
      setActionLoading(true);
      const { error } = await connectionService.acceptInvite(connectionId);
      if (error) {
        toast.error(error.message); 
      } else {
        toast.success("Connection Accepted! 💖");
        // Redirection handle kar lega realtime listener
      }
    } catch (err) {
      toast.error("Accept failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <SplashScreen />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center relative overflow-x-hidden">
      {/* LogOut Button */}
      <button 
        onClick={() => supabase.auth.signOut()} 
        className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-zinc-900/60 border border-white/5 rounded-2xl text-zinc-400 hover:text-rose-500 hover:bg-zinc-800/80 transition-all backdrop-blur-md z-10"
      >
        <LogOut size={16} /> <span className="text-xs font-bold">Log Out</span>
      </button>

      <div className="max-w-md w-full space-y-8 mt-12 relative z-10">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-600 italic tracking-tighter">
            Connect
          </h1>
          <p className="text-zinc-500 text-sm font-medium">Share your ID to start syncing</p>
        </div>

        {/* User ID Card */}
        <div className="bg-zinc-900/40 p-5 rounded-[2rem] border border-white/5 backdrop-blur-xl shadow-2xl">
          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] ml-1">Your Unique ID</label>
          <div className="flex items-center mt-3 gap-2">
            <code className="flex-1 bg-black/40 p-3.5 rounded-2xl text-pink-500/90 text-[11px] truncate border border-white/5 font-mono">
              {session?.user?.id}
            </code>
            <button 
              onClick={() => { navigator.clipboard.writeText(session?.user?.id || ''); toast.success("ID Copied!"); }} 
              className="p-3.5 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 rounded-2xl transition-all border border-white/10 active:scale-90"
            >
              <Copy size={18} />
            </button>
          </div>
        </div>

        {/* Invite Input */}
        <div className="space-y-4">
          <div className="relative group">
            <input
              type="text"
              placeholder="Enter Partner's ID..."
              value={partnerIdInput}
              onChange={(e) => setPartnerIdInput(e.target.value)}
              className="w-full bg-zinc-900/40 border border-white/5 p-4.5 rounded-[1.8rem] focus:outline-none focus:border-pink-500/50 transition-all placeholder:text-zinc-700 text-sm backdrop-blur-md"
            />
          </div>
          <button 
            onClick={handleSendInvite} 
            disabled={actionLoading || !partnerIdInput.trim()} 
            className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:brightness-110 active:scale-[0.98] py-4.5 rounded-[1.8rem] font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-pink-900/20 text-sm disabled:opacity-50 disabled:grayscale"
          >
            {actionLoading ? <Loader2 className="animate-spin" /> : <UserPlus size={18} />} 
            Send Request
          </button>
        </div>

        {/* Requests List */}
        {invites.length > 0 && (
          <div className="space-y-4 mt-12 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] ml-3">Pending Requests</h2>
            <div className="space-y-3">
              {invites.map((invite) => (
                <div 
                  key={invite.id} 
                  className="bg-zinc-900/60 p-4 rounded-[1.8rem] border border-white/5 flex items-center justify-between group hover:bg-zinc-900/80 transition-all backdrop-blur-sm"
                >
                  <div className="ml-2">
                    <p className="text-sm font-bold text-zinc-200">{invite.profiles?.display_name || "New Partner"}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 font-medium italic">Wants to pair with you</p>
                  </div>
                  <button 
                    onClick={() => handleAcceptInvite(invite.id)} 
                    disabled={actionLoading} 
                    className="p-3.5 bg-pink-500/10 text-pink-500 rounded-2xl hover:bg-pink-500 hover:text-white transition-all border border-pink-500/20 active:scale-90"
                  >
                    {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check size={20} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Background Decor */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-600/10 blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
};
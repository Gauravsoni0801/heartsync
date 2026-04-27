import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile, Connection } from '../lib/types';

interface SyncState {
  session: Session | null;
  profile: Profile | null;
  activeConnection: Connection | null;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setActiveConnection: (connection: Connection | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  session: null,
  profile: null,
  activeConnection: null,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setActiveConnection: (activeConnection) => set({ activeConnection }),
}));
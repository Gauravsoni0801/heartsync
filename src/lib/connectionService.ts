import { supabase } from './supabase/client';

export const connectionService = {
  async sendInvite(partnerId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return { error: new Error("Authentication required") };
    if (userId === partnerId) return { error: new Error("Bhai, khud ko request nahi bhej sakte! 😅") };

    const { data: existing, error: checkError } = await supabase
      .from('connections').select('id')
      .or(`and(user_a_id.eq.${userId},user_b_id.eq.${partnerId}),and(user_a_id.eq.${partnerId},user_b_id.eq.${userId})`)
      .limit(1);

    if (checkError) return { error: checkError };
    if (existing && existing.length > 0) return { error: new Error("Request already exists or you're already connected!") };

    const { error } = await supabase.from('connections').insert({ user_a_id: userId, user_b_id: partnerId, status: 'pending' });
    return { error };
  },

  async getPendingInvites() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return { data: [], error: null };
    const { data, error } = await supabase
      .from('connections')
      .select(`*, profiles!connections_user_a_id_fkey (id, display_name, updated_at)`)
      .eq('user_b_id', session.user.id).eq('status', 'pending');
    return { data, error };
  },

  async acceptInvite(connectionId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return { error: new Error("Not logged in") };

    const { data: connection, error: fetchError } = await supabase.from('connections').select('*').eq('id', connectionId).single();
    if (fetchError || !connection) return { error: fetchError };

    const partnerId = connection.user_a_id === userId ? connection.user_b_id : connection.user_a_id;

    await supabase.from('connections').update({ status: 'active' }).eq('id', connectionId);
    await supabase.from('profiles').update({ is_paired: true }).in('id', [userId, partnerId]);
    return { error: null };
  },

  async updateMood(emoji: string, label: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return { error: new Error("Not logged in") };
    return await supabase.from('moods').upsert({ user_id: session.user.id, mood_emoji: emoji, mood_label: label, updated_at: new Date().toISOString() });
  },

  async sendNote(content: string, receiverId: string, replyToId: string | null = null) {
    const { data: { session } } = await supabase.auth.getSession();
    return await supabase.from('notes').insert({ sender_id: session?.user?.id, receiver_id: receiverId, content, reply_to_id: replyToId });
  },

  async updateNote(noteId: string, newContent: string) {
    return await supabase.from('notes').update({ content: newContent, is_edited: true }).eq('id', noteId);
  },

  async reactToNote(noteId: string, emoji: string) {
    return await supabase.from('notes').update({ reaction: emoji }).eq('id', noteId);
  },

  async deleteNote(noteId: string) {
    return await supabase.from('notes').delete().eq('id', noteId);
  },

  async uploadMemory(file: File, caption: string, receiverId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage.from('memories').upload(fileName, file);
    if (uploadError) return { error: uploadError };

    const { data: { publicUrl } } = supabase.storage.from('memories').getPublicUrl(fileName);
    return await supabase.from('photos').insert({ sender_id: session?.user?.id, receiver_id: receiverId, image_url: publicUrl, caption });
  },

  async deleteMemory(photoId: string, imageUrl: string) {
    const fileName = imageUrl.split('/').pop();
    if (!fileName) return { error: new Error("Invalid URL") };
    await supabase.storage.from('memories').remove([fileName]);
    return await supabase.from('photos').delete().eq('id', photoId);
  },

  async deleteAccount() {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return { error: new Error("Not logged in") };

    const { error: connError } = await supabase.from('connections').delete().or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
    if (connError) return { error: connError };

    return await supabase.from('profiles').delete().eq('id', userId);
  }
};
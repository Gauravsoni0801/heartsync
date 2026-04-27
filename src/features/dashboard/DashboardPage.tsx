import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../../app/providers/AuthProvider';
import { connectionService } from '../../lib/connectionService';
import { Heart, Send, Loader2, LogOut, Sparkles, Camera, Image as ImageIcon, X, MoreVertical, MessageCircle, Trash2, Edit2, Reply, Menu, Trash } from 'lucide-react';
import toast from 'react-hot-toast';

// Types (Cleaned up for Phase 4)
type Note = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string; is_edited?: boolean; reaction?: string; reply_to_id?: string; };
type Mood = { user_id: string; mood_emoji: string; mood_label: string; updated_at: string; };
type Profile = { id: string; display_name: string; };
type Photo = { id: string; sender_id: string; receiver_id: string; image_url: string; caption: string; created_at: string; };

const MOOD_OPTIONS = [
  { emoji: '😊', label: 'Happy' }, { emoji: '🥺', label: 'Missing You' },
  { emoji: '🥰', label: 'Loved' }, { emoji: '😈', label: 'Playful' }, { emoji: '😴', label: 'Sleepy' },
];

export const DashboardPage = () => {
  const { session } = useAuth(); 
  const navigate = useNavigate();
  const userId = session?.user?.id;

  // View & Sidebar States
  const [currentView, setCurrentView] = useState<'chat' | 'memories'>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  
  // Chat States
  const [notes, setNotes] = useState<Note[]>([]);
  const [myMood, setMyMood] = useState<Mood | null>(null);
  const [partnerMood, setPartnerMood] = useState<Mood | null>(null);
  const [newNote, setNewNote] = useState('');
  const [sendingNote, setSendingNote] = useState(false);
  
  // Advanced Chat States
  const [replyingTo, setReplyingTo] = useState<Note | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Photo States
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const notesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => { if(currentView === 'chat') notesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => { scrollToBottom(); }, [notes, currentView]);

  const fetchDashboardData = useCallback(async () => {
    if (!userId) return;
    try {
      // 1. Connection Check
      const { data: connection, error: connError } = await supabase.from('connections').select('*').eq('status', 'active').or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`).maybeSingle();
      if (connError) throw connError;
      if (!connection) return navigate('/connect');

      const pId = connection.user_a_id === userId ? connection.user_b_id : connection.user_a_id;

      // 2. Parallel Fetch (Removed sync_code logic)
      const [pProfile, notesData, moodsData, photoData] = await Promise.all([
        supabase.from('profiles').select('id, display_name').eq('id', pId).maybeSingle(),
        supabase.from('notes').select('*').order('created_at', { ascending: true }),
        supabase.from('moods').select('*').in('user_id', [userId, pId]),
        supabase.from('photos').select('*').order('created_at', { ascending: false })
      ]);

      if (pProfile.data) setPartner(pProfile.data);
      if (notesData.data) setNotes(notesData.data);
      if (moodsData.data) {
        setMyMood(moodsData.data.find(m => m.user_id === userId) || null);
        setPartnerMood(moodsData.data.find(m => m.user_id === pId) || null);
      }
      if (photoData.data) setPhotos(photoData.data as Photo[]);

    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [userId, navigate]);

  useEffect(() => {
    fetchDashboardData();
    if (!userId) return;

    let channel: ReturnType<typeof supabase.channel>;

    const setupRealtime = () => {
      channel = supabase.channel(`dashboard_realtime_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
            if (payload.eventType === 'INSERT') setNotes(prev => [...prev, payload.new as Note]);
            if (payload.eventType === 'UPDATE') setNotes(prev => prev.map(n => n.id === payload.new.id ? payload.new as Note : n));
            if (payload.eventType === 'DELETE') setNotes(prev => prev.filter(n => n.id !== payload.old.id));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'moods' }, (payload) => {
            const updatedMood = payload.new as Mood;
            if (updatedMood.user_id === userId) setMyMood(updatedMood);
            else setPartnerMood(updatedMood);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, (payload) => {
            if (payload.eventType === 'INSERT') setPhotos(prev => [payload.new as Photo, ...prev]);
            if (payload.eventType === 'DELETE') setPhotos(prev => prev.filter(p => p.id !== payload.old.id));
        });

        channel.subscribe();
    }

    setupRealtime();

    return () => { 
        if(channel) supabase.removeChannel(channel); 
    };
  }, [userId, fetchDashboardData]);

  // Actions
  const handleUpdateMood = async (emoji: string, label: string) => {
    const previousMood = myMood;
    setMyMood({ user_id: userId!, mood_emoji: emoji, mood_label: label, updated_at: new Date().toISOString() });
    
    const { error } = await connectionService.updateMood(emoji, label);
    if(error) {
        setMyMood(previousMood); 
        toast.error("Failed to update mood.");
    }
  };

  const handleSendOrUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !partner) return;

    setSendingNote(true);
    try {
      if (editingNote) {
        setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, content: newNote.trim(), is_edited: true } : n));
        await connectionService.updateNote(editingNote.id, newNote.trim());
        setEditingNote(null);
        toast.success("Message edited");
      } else {
        await connectionService.sendNote(newNote.trim(), partner.id, replyingTo?.id || null);
        setReplyingTo(null);
      }
      setNewNote('');
    } catch (err) {
      toast.error("Action failed.");
      fetchDashboardData(); 
    } finally {
      setSendingNote(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadPhoto = async () => {
    if (!selectedFile || !partner) return;
    setUploadingPhoto(true);
    try {
      await connectionService.uploadMemory(selectedFile, photoCaption, partner.id);
      toast.success("Memory saved! 📸");
      setSelectedFile(null);
      setPhotoCaption('');
    } catch (error) {
        toast.error("Failed to upload memory.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId: string, url: string) => {
    if(!confirm("Are you sure you want to delete this memory?")) return;
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    
    const { error } = await connectionService.deleteMemory(photoId, url);
    if(error) {
        toast.error("Failed to delete.");
        fetchDashboardData(); 
    } else {
        toast.success("Memory deleted.");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = window.confirm("Bhai, Dhyan Se! Ye aapki profile aur pairing database se mita dega. Karein?");
    if (!confirmation) return;

    try {
      setLoading(true);
      await connectionService.deleteAccount(); 
      await supabase.auth.signOut();
      window.localStorage.clear();
      toast.success("Account deleted. Hope to see you back soon!");
      navigate('/auth');
    } catch (err: any) {
      toast.error(err.message || "Deletion failed.");
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex justify-center items-center"><Loader2 className="w-10 h-10 text-pink-500 animate-spin" /></div>;
  if (errorMsg) return <div className="min-h-screen bg-[#0a0a0a] text-red-500 p-8 text-center">{errorMsg}</div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col relative pb-10 overflow-hidden">
      
      {/* HEADER */}
      <header className="px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-xl flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Heart className="text-pink-500 fill-pink-500 animate-pulse" size={24} />
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-rose-500">HeartSync</h1>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => setCurrentView(currentView === 'chat' ? 'memories' : 'chat')} className="text-zinc-300 hover:text-pink-400 transition-colors">
             {currentView === 'chat' ? <ImageIcon size={22} /> : <MessageCircle size={22} />}
          </button>
          <button onClick={() => setIsSidebarOpen(true)} className="text-zinc-300 hover:text-white transition-colors">
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* SIDEBAR */}
      <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
        <div className={`absolute top-0 right-0 h-full w-72 bg-[#0d0d0d] border-l border-white/10 shadow-2xl p-6 flex flex-col transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex justify-between items-center mb-8">
            <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Settings</span>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={20}/></button>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={async () => { await supabase.auth.signOut(); navigate('/auth'); }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 transition-all border border-white/5"
            >
              <LogOut size={20} /> <span className="font-semibold">Logout</span>
            </button>
            
            <button 
              onClick={handleDeleteAccount}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 transition-all border border-rose-500/20"
            >
              <Trash size={20} /> <span className="font-semibold">Delete Account</span>
            </button>
            <p className="px-4 text-[10px] text-zinc-600 leading-relaxed italic mt-4">
              *Note: Account delete karne se pairing khatam ho jayegi. Wapas login karke partner se connect karte hi purani yaadein wapas aa jayengi.
            </p>
          </div>
        </div>
      </div>

      <main className="flex-1 flex flex-col w-full max-w-lg mx-auto">
        {currentView === 'chat' ? (
          <>
            <section className="p-4 border-b border-white/5 bg-black/20">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {MOOD_OPTIONS.map((mood) => (
                  <button key={mood.label} onClick={() => handleUpdateMood(mood.emoji, mood.label)} className={`flex-shrink-0 px-4 py-2 rounded-full border transition-all ${myMood?.mood_label === mood.label ? 'bg-pink-500/20 border-pink-500/50 text-pink-100' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}>
                    {mood.emoji} <span className="ml-1 text-sm">{mood.label}</span>
                  </button>
                ))}
              </div>
              {partnerMood && (
                <div className="mt-4 p-3 bg-zinc-900/50 rounded-xl border border-white/5 flex items-center gap-3">
                  <div className="text-2xl bg-zinc-800 p-2 rounded-lg">{partnerMood.mood_emoji}</div>
                  <div><p className="text-xs text-zinc-500">{partner?.display_name}'s Mood</p><p className="font-semibold text-zinc-200">{partnerMood.mood_label}</p></div>
                </div>
              )}
            </section>

            <section className="flex-1 min-h-[50vh] overflow-y-auto p-4 flex flex-col gap-4 scrollbar-hide">
              {notes.length === 0 ? (
                <div className="text-center text-zinc-500 mt-4"><Sparkles className="mx-auto mb-2 opacity-30"/> No notes yet.</div>
              ) : (
                notes.map((note) => {
                  const isMine = note.sender_id === userId;
                  const repliedNote = note.reply_to_id ? notes.find(n => n.id === note.reply_to_id) : null;
                  return (
                    <div key={note.id} className={`flex w-full group relative ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className="flex flex-col max-w-[80%]">
                        {repliedNote && (
                          <div className={`mb-1 text-xs px-3 py-1.5 rounded-xl opacity-60 line-clamp-1 ${isMine ? 'bg-zinc-800 self-end mr-2' : 'bg-zinc-800 self-start ml-2'}`}>
                            <Reply size={10} className="inline mr-1"/> {repliedNote.content}
                          </div>
                        )}
                        <div className="relative group/bubble flex items-center gap-2">
                          {isMine && (
                            <div className="relative">
                              <button onClick={() => setActiveMenuId(activeMenuId === note.id ? null : note.id)} className="opacity-0 group-hover/bubble:opacity-100 p-1 hover:bg-zinc-800 rounded-full text-zinc-400 transition-opacity"><MoreVertical size={16} /></button>
                              {activeMenuId === note.id && (
                                <div className="absolute top-0 right-full mr-2 w-32 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-10 flex flex-col text-sm overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                  <button onClick={() => { setReplyingTo(note); setActiveMenuId(null); }} className="px-3 py-2 text-left hover:bg-zinc-800 flex gap-2"><Reply size={14}/> Reply</button>
                                  <button onClick={() => { setEditingNote(note); setNewNote(note.content); setActiveMenuId(null); }} className="px-3 py-2 text-left hover:bg-zinc-800 flex gap-2"><Edit2 size={14}/> Edit</button>
                                  <button onClick={() => { connectionService.deleteNote(note.id); setActiveMenuId(null); }} className="px-3 py-2 text-left text-red-400 hover:bg-red-500/10 flex gap-2"><Trash2 size={14}/> Unsend</button>
                                </div>
                              )}
                            </div>
                          )}
                          <div className={`p-3 rounded-2xl text-sm leading-relaxed relative ${isMine ? 'bg-gradient-to-br from-pink-600 to-rose-600 text-white rounded-tr-sm shadow-sm' : 'bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-tl-sm'}`}>
                            {note.content}
                            <div className={`text-[9px] mt-1 opacity-50 flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                              {new Date(note.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              {note.is_edited && <span>(edited)</span>}
                            </div>
                            {note.reaction && (
                              <div className={`absolute -bottom-3 ${isMine ? 'right-2' : 'left-2'} bg-zinc-900 border border-zinc-800 rounded-full px-1.5 py-0.5 text-xs shadow-sm`}>
                                {note.reaction}
                              </div>
                            )}
                          </div>
                          {!isMine && (
                            <div className="relative">
                              <button onClick={() => setActiveMenuId(activeMenuId === note.id ? null : note.id)} className="opacity-0 group-hover/bubble:opacity-100 p-1 hover:bg-zinc-800 rounded-full text-zinc-400 transition-opacity"><MoreVertical size={16} /></button>
                              {activeMenuId === note.id && (
                                <div className="absolute top-0 left-full ml-2 w-36 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-10 flex flex-col p-2 gap-1 animate-in fade-in zoom-in-95 duration-100">
                                  <div className="flex justify-around mb-2 pb-2 border-b border-zinc-800">
                                    {['❤️', '😂', '🥺'].map(emoji => (
                                      <button key={emoji} onClick={() => { connectionService.reactToNote(note.id, emoji); setActiveMenuId(null); }} className="hover:scale-125 transition-transform">{emoji}</button>
                                    ))}
                                  </div>
                                  <button onClick={() => { setReplyingTo(note); setActiveMenuId(null); }} className="px-2 py-1 text-sm text-left hover:bg-zinc-800 rounded-md flex gap-2 items-center"><Reply size={14}/> Reply</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={notesEndRef} />
            </section>

            <div className="p-3 bg-[#0a0a0a] border-t border-white/5 sticky bottom-0">
              {(replyingTo || editingNote) && (
                <div className="flex justify-between items-center bg-zinc-900 px-4 py-2 rounded-t-2xl border-x border-t border-zinc-800 text-xs text-zinc-400">
                  <span className="flex items-center gap-2">{replyingTo ? 'Replying to partner' : 'Editing message'}</span>
                  <button onClick={() => { setReplyingTo(null); setEditingNote(null); setNewNote(''); }} className="hover:text-white"><X size={14}/></button>
                </div>
              )}
              <form onSubmit={handleSendOrUpdateNote} className="flex gap-2 bg-zinc-900 border border-zinc-800 p-1 pl-4 rounded-full">
                <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Message..." className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-zinc-600" />
                <button type="submit" disabled={!newNote.trim() || sendingNote} className="bg-pink-600 hover:bg-pink-500 p-2 rounded-full disabled:opacity-50 transition-colors">
                   {sendingNote ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <section className="p-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-2xl font-bold">Gallery 📸</h2>
               <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={uploadingPhoto}
                  className="bg-pink-600 p-2 px-4 rounded-full flex items-center gap-2 font-bold text-sm shadow-lg shadow-pink-500/20 disabled:opacity-50"
                >
                 <Camera size={18} /> Upload
               </button>
               <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            </div>

            {selectedFile && (
              <div className="mb-6 p-4 border border-pink-500/30 rounded-2xl bg-pink-500/5 relative">
                <button onClick={() => { setSelectedFile(null); setPhotoCaption(''); }} className="absolute -top-2 -right-2 bg-zinc-800 p-1 rounded-full border border-zinc-700 hover:text-white"><X size={16} /></button>
                <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-full h-48 object-cover rounded-xl border border-white/10 mb-3" />
                <input type="text" value={photoCaption} onChange={(e) => setPhotoCaption(e.target.value)} placeholder="Add caption..." className="w-full bg-black/50 border border-zinc-800 p-3 rounded-xl text-sm mb-3 focus:outline-none focus:border-pink-500/50" />
                <button onClick={handleUploadPhoto} disabled={uploadingPhoto} className="w-full bg-pink-600 py-3 rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50">
                  {uploadingPhoto ? <Loader2 className="animate-spin" /> : "Save Memory"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {photos.map(photo => (
                <div key={photo.id} className="relative group rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 aspect-square">
                  <img src={photo.image_url} alt={photo.caption} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  {photo.sender_id === userId && (
                    <button onClick={() => handleDeletePhoto(photo.id, photo.image_url)} className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-black"><Trash2 size={14} /></button>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 p-3 flex flex-col justify-end transition-opacity duration-300">
                    <p className="text-xs font-medium text-white line-clamp-2">{photo.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
'use client';
import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { dayLabel, messageLayout } from '@/lib/message-groups';
import { MessageActions, ReactionBar, ReplyBar, ReplyQuote, useReactions } from './message-extras';
import dynamic from 'next/dynamic';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Hash, Headphones, Plus, Users, Radio, LogOut, Settings, ArrowRight, MessageCircle, SunMoon, Gamepad2, ShieldCheck, Menu, X, Compass, ShoppingBag } from 'lucide-react';
import {Landing} from './landing';
import {MfaChallenge,TwoFactorPrompt} from './mfa';
import {EmailUpdate,needsEmailUpdate} from './email-update';
import {CommunityCount} from './community-count';
import { getSupabase } from '@/lib/supabase';
import { errorText, messageSchema, nameSchema } from '@/lib/validation';
import type { Channel, DM, Friendship, Message, Profile, Server, Sticker } from '@/lib/types';
import { prepareAudio, uploadAudio } from '@/lib/chat-media';
import { clearSignedUrls } from '@/lib/signed-urls';
import { Composer } from './composer';
import { useMicGate } from './mic-gate';
import { useMediaQuery } from './use-media-query';
import { useUnread } from './use-unread';
import { usePresence } from './use-presence';
import { PresenceAvatar, ProfileHover, StatusMenu } from './presence-ui';
import { memberState, offlineInfo } from '@/lib/presence';
import { NotificationBell } from './notification-bell';
import { badgeText, unreadTotal } from '@/lib/unread';
import { shellCallClass } from '@/lib/nav';
import { useDrawerSwipe } from '@/lib/use-drawer-swipe';
import { useBackButton } from '@/lib/use-back-button';
import type { ProfileCall } from '@/lib/profile-info';
import { installPointerAnchor } from '@/lib/pointer-anchor';
import { MessageContent } from './message-content';
import type { Recording } from './use-audio-recorder';
import { WhatsNew } from './whats-new';
import {clockOffset as measureClockOffset,durationLabel,withLocalParticipant,type RoomSnapshot} from '@/lib/room-clock';
import {profileTag} from '@/lib/identity';
import {GroupIcon} from './group-icon';
import {LiveBadge,PersonStateIcons} from './live-badge';
import {isCurrentCall} from '@/lib/call-session';
import {shownFlags,type PersonFlags} from '@/lib/room-people';
import {InviteCard,inviteCode} from './invite';
import {checkoutReturn,checkoutReturnMessage,withoutCheckout} from '@/lib/checkout-return';
import type {ServerRole,MemberRole} from '@/lib/types';
import { Auth } from './auth';
import { Brand } from './brand';
import { Avatar, avatarUrl } from './avatar';
import {FriendsPanel,type FriendTab} from './friends-panel';
import {StorePanel} from './store-panel';
import {useStoreBenefits} from './use-store-benefits';
import type {VoiceSession} from './voice';
const Voice=dynamic(()=>import('./voice').then(m=>m.Voice),{ssr:false});
const ProfileSettings=dynamic(()=>import('./profile-settings').then(m=>m.ProfileSettings),{ssr:false});
const ProfileCard=dynamic(()=>import('./profile-card').then(m=>m.ProfileCard),{ssr:false});
const GroupSettings=dynamic(()=>import('./group-settings').then(m=>m.GroupSettings),{ssr:false});

export function App({initialScreen='landing'}:{initialScreen?:'landing'|'login'}) {
  const [db] = useState(getSupabase);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [pendingInvite,setPendingInvite]=useState<string|null>(null);
  useEffect(()=>{setPendingInvite(inviteCode(new URLSearchParams(window.location.search).get('invite')||''));},[]);
  const [recovery, setRecovery] = useState(false);
  const [mfaGate, setMfaGate] = useState<'checking'|'challenge'|'ok'>('checking');
  useEffect(() => {
    if (!db || !session) { setMfaGate('checking'); return; }
    let live = true;
    // Conta com 2FA ativo só entra no app depois de confirmar o código (sessão aal2).
    void db.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => { if (live) setMfaGate(data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2' ? 'challenge' : 'ok'); });
    return () => { live = false; };
  }, [db, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!db) return;
    void db.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = db.auth.onAuthStateChange((event, next) => { setSession(next); setReady(true); if (event === 'PASSWORD_RECOVERY') setRecovery(true); if (event === 'SIGNED_OUT') { setPendingInvite(null); window.history.replaceState({}, '', '/'); } });
    return () => data.subscription.unsubscribe();
  }, [db]);
  if (!db) return initialScreen==='landing'?<Landing/>:<main className="setup"><Brand/><h1>O lobby está<br/>aquecendo.</h1><p>O login está temporariamente indisponível. Tente de novo em instantes.</p><a href="/">Voltar para o início</a></main>;
  if (!ready) return initialScreen==='landing'?<Landing/>:<main className="setup" role="status">Abrindo seu espaço…</main>;
  if (!session) return initialScreen==='landing'&&!pendingInvite?<Landing/>:<>{pendingInvite&&<div className="invite-auth"><InviteCard db={db} code={pendingInvite} loggedIn={false}/></div>}<Auth db={db} /></>;
  if (mfaGate === 'checking') return <main className="setup" role="status">Conferindo sua segurança…</main>;
  if (mfaGate === 'challenge') return <MfaChallenge db={db} signOut={() => void db.auth.signOut()} />;
  // Conta do modelo antigo: não usa o app até confirmar um email válido. Contas novas nunca passam por aqui.
  if (needsEmailUpdate(session.user)) return <EmailUpdate db={db} user={session.user} signOut={() => void db.auth.signOut()} />;
  return <Workspace key={session.user.id} db={db} session={session} recovery={recovery} recovered={() => setRecovery(false)} />;
}

function Workspace({ db, session, recovery, recovered }: { db: SupabaseClient; session: Session; recovery: boolean; recovered: () => void }) {
  const me = session.user.id;
  const storeBenefits=useStoreBenefits(me);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [dms, setDms] = useState<DM[]>([]);
  const [serverId, setServerId] = useState<string | null>(null);
  const [homeView,setHomeView]=useState<'friends'|'store'|'communities'>('friends');const [friendTab,setFriendTab]=useState<FriendTab>('all');
  const [target, setTarget] = useState<{ id: string; type: 'channel' | 'dm'; name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [older, setOlder] = useState(false);
  const [notice, setNotice] = useState('');
  const [settings, setSettings] = useState(false);
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  useDrawerSwipe({open:mobileNavOpen,setOpen:setMobileNavOpen});
  useEffect(()=>installPointerAnchor(),[]);
  // Com uma call ativa, o painel da call só ocupa a tela quando a pessoa o abre (entrar na call, botão Call, tocar na barra de voz). Início, Amigos, servidores e conversas mostram a própria tela, a call segue conectada e os controles ficam na barra de voz.
  const [callView,setCallView]=useState(false);
  // Os controles da call ficam numa barra de voz, num lugar só (como no Discord): cartão acima do perfil na barra lateral; no celular, barra compacta acima do menu de baixo.
  const compactBar = useMediaQuery('(max-width:720px)');
  const [sideBar, setSideBar] = useState<HTMLElement | null>(null);
  const [dockBar, setDockBar] = useState<HTMLElement | null>(null);
  const voiceRef = useRef<VoiceSession | null>(null);
  const [settingsTab, setSettingsTab] = useState<'profile'|'appearance'|'security'|'2fa'>('profile');
  const[inspectedProfile,setInspectedProfile]=useState<Profile|null>(null);const[roomStates,setRoomStates]=useState<Record<string,RoomSnapshot>>({});const[clockNow,setClockNow]=useState(Date.now());const[clockOffset,setClockOffset]=useState(0);const[speakingIds,setSpeakingIds]=useState<string[]>([]);const[livePeople,setLivePeople]=useState<Record<string,PersonFlags>>({});
  const [voice, setVoice] = useState<VoiceSession | null>(null);
  voiceRef.current = voice;
  const [groupSettings,setGroupSettings]=useState(false);const[groupTab,setGroupTab]=useState("profile");
  const [roles,setRoles]=useState<ServerRole[]>([]);
  const [assignments,setAssignments]=useState<MemberRole[]>([]);
  const [pendingInvite,setPendingInvite]=useState<string|null>(()=>typeof window==='undefined'?null:inviteCode(new URLSearchParams(window.location.search).get('invite')||''));
  // Volta do checkout do Asaas (/?checkout=…): abre a Loja e diz o que aconteceu com o pagamento, em vez de cair em Amigos sem aviso.
  useEffect(()=>{const state=checkoutReturn(new URLSearchParams(window.location.search).get('checkout'));if(!state)return;setHomeView('store');setNotice(checkoutReturnMessage(state));window.history.replaceState({},'',withoutCheckout(window.location.href));},[]);
  const { ensureMic } = useMicGate();
  useEffect(() => { if (target) setCallView(false); }, [target]);
  const bottom = useRef<HTMLDivElement>(null);
  const historyLimit = useRef(50);
  const followMessages = useRef(true);
  const activeTarget = useRef(target);
  activeTarget.current = target;
  // Mensagens não lidas das DMs: bolinha vermelha, sino e som. A conversa que a pessoa está olhando é marcada como lida.
  const lastIncoming = [...messages].reverse().find(m => m.author_id !== me)?.id;
  const unread = useUnread({ db, me, dmIds: dms.map(d => d.id), openDm: target?.type === 'dm' ? target.id : null, lastIncoming });
  const acceptedIds = friends.filter(f => f.status === 'accepted').map(f => f.sender_id === me ? f.receiver_id : f.sender_id);
  // Presença: online só com o NACALL aberto. Amigos veem tudo (inclusive "visto por último"); no servidor aberto, os membros mostram só online, ausente ou offline.
  const presence = usePresence({ db, me, friendKey: acceptedIds.slice().sort().join(','), serverId });
  const infoOf = (id: string) => acceptedIds.includes(id) ? (presence.map[id] ?? offlineInfo) : undefined;
  const pendingIn = friends.filter(f => f.receiver_id === me && f.status === 'pending').length;
  const unreadByDm = Object.fromEntries(unread.items.map(u => [u.dm_id, u]));
  const unreadMessages = unreadTotal(unread.items);
  const server = servers.find(s => s.id === serverId);
  const owner = server?.owner_id === me;
  const myRoles=roles.filter(r=>r.server_id===serverId&&assignments.some(a=>a.user_id===me&&a.role_id===r.id));
  const can=(permission:string)=>owner||myRoles.some(r=>r.permissions.includes(permission));
  const profile = profiles[me];
  const getName = (id: string) => profileTag(profiles[id]);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    const onScroll = (e: Event) => {
      const element = e.target;
      if (element instanceof HTMLElement && element.classList.contains('message-list')) {
        followMessages.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
      }
    };
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, []);

  const load = useCallback(async () => {
    const results = await Promise.all([
      db.from('servers').select('*').order('created_at'),
      db.from('channels').select('*').order('created_at'),
      db.from('friendships').select('*'), db.from('dms').select('*'),
      db.from('server_members').select('user_id,server_id'),db.from('server_roles').select('*'),db.from('member_roles').select('*'),
    ]);
    const failure = results.find(r => r.error)?.error;
    if (failure) throw failure;
    const fs = (results[2].data ?? []) as Friendship[];
    const ds = (results[3].data ?? []) as DM[];
    const ids = new Set([me, ...fs.flatMap(f => [f.sender_id, f.receiver_id]), ...ds.flatMap(d => [d.user_a, d.user_b]), ...(results[4].data ?? []).map(m => m.user_id as string)]);
    const p = await db.from('profiles').select('*').in('id', [...ids]);
    if (p.error) throw p.error;
    setProfiles(Object.fromEntries((p.data ?? []).map(p => [p.id, p])));
    setRoles(results[5].data??[]);setAssignments(results[6].data??[]);
    setServers([...(results[0].data ?? [])].sort((a,b)=>Number(Boolean(b.is_official))-Number(Boolean(a.is_official)))); setChannels(results[1].data ?? []); setFriends(fs); setDms(ds);
  }, [db, me]);
  useEffect(() => { void load().catch(e => setNotice(errorText(e))); }, [load]);
  useEffect(() => {
    const sub = db.channel(`social-${me}`).on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => void load().catch(e => setNotice(errorText(e)))).on('postgres_changes', { event: '*', schema: 'public', table: 'dms' }, () => void load().catch(e => setNotice(errorText(e)))).subscribe();
    const refreshIfVisible=()=>{if(document.visibilityState==='visible')void load().catch(()=>{});};
    const timer=window.setInterval(refreshIfVisible,120000);
    document.addEventListener('visibilitychange',refreshIfVisible);
    return () => { window.clearInterval(timer);document.removeEventListener('visibilitychange',refreshIfVisible);void db.removeChannel(sub); };
  }, [db, me, load]);
  useEffect(() => {
    setMembers([]);
    if (!serverId) return;
    let current = true;
    void db.from('server_members').select('user_id').eq('server_id', serverId).then(({ data, error }) => { if (current) { if (error) setNotice(error.message); else setMembers((data ?? []).map(m => m.user_id)); } });
    return () => { current = false; };
  }, [serverId, db, servers]);
  useEffect(() => {
    setMessages([]); setOlder(false);
    setBody(''); setReplyTo(null); historyLimit.current = 50; followMessages.current = true;
    if (!target) return;
    let active = true;
    const field = target.type === 'channel' ? 'channel_id' : 'dm_id';
    async function fetchMessages() {
      const { data, error } = await db.from('messages').select('*').eq(field, target!.id).order('created_at', { ascending: false }).limit(historyLimit.current);
      if (!active) return;
      if (error) setNotice(error.message);
      else { const next = (data ?? []).reverse(); setMessages(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next); setOlder(data?.length === historyLimit.current); }
      setLoading(false);
    }
    setLoading(true);
    // Subscribe first, then query: re-query after reconnect also fills missed events.
    const sub = db.channel(`messages-${target.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `${field}=eq.${target.id}` }, () => void fetchMessages())
      .subscribe(status => { if (status === 'SUBSCRIBED') void fetchMessages(); if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { setNotice('Conexão em tempo real interrompida. Tentando reconectar; use Atualizar para buscar mensagens.'); setLoading(false); } });
    void fetchMessages();
    // DELETE events cannot be filtered reliably by Postgres Changes; reconcile periodically.
    const reconcile = window.setInterval(() => void fetchMessages(), 15000);
    return () => { active = false; window.clearInterval(reconcile); void db.removeChannel(sub); };
  }, [db, target]);
  useEffect(() => { if (followMessages.current) bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function act(task: () => Promise<void>) {
    setBusy(true); setNotice('');
    try { await task(); } catch (e) { setNotice(errorText(e)); } finally { setBusy(false); }
  }
  async function createServer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const name = String(new FormData(form).get('name'));
    await act(async () => { const { data, error } = await db.rpc('create_server', { server_name: nameSchema.parse(name) }); if (error) throw error; await load(); setServerId(data); setTarget(null); form.reset(); });
  }
  async function joinServer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const raw = String(new FormData(form).get('code')).trim();
    const code=inviteCode(raw);if(!code){setNotice('Cole um link de convite válido ou o código completo.');return;}setPendingInvite(code);window.scrollTo(0,0);
  }
  async function joined(id:string){await load();setServerId(id);setPendingInvite(null);window.history.replaceState({},'', '/');const first=await db.from('channels').select('*').eq('server_id',id).eq('kind','text').order('created_at').limit(1).maybeSingle();setTarget(first.data?{id:first.data.id,type:'channel',name:first.data.name}:null);setNotice('Você chegou! Pode entrar, o lobby é seu também.');
  }
  function requestFriend(id:string){if(id===me||friends.some(f=>f.sender_id===id||f.receiver_id===id))return;void act(async()=>{const {error}=await db.from('friendships').insert({sender_id:me,receiver_id:id});if(error)throw error;await load();setNotice('Solicitação enviada.');});}
  function acceptFriend(id:string){void act(async()=>{const {error}=await db.from('friendships').update({status:'accepted'}).eq('id',id).eq('receiver_id',me);if(error)throw error;await load();});}
  function removeFriend(id:string){void act(async()=>{const {error}=await db.from('friendships').delete().eq('id',id);if(error)throw error;await load();});}
  async function openDM(id: string) {
    await act(async () => { const { data, error } = await db.rpc('open_dm', { friend_id: id }); if (error) throw error; await load(); setServerId(null); setTarget({ id: data, type: 'dm', name: getName(id) }); });
  }
  // Texto, áudio e figurinha usam a mesma tabela `messages`; só mudam `kind` e os metadados da mídia.
  async function post(selected: NonNullable<typeof target>, fields: Record<string, unknown>) {
    const reply = replyTo && (replyTo.channel_id ?? replyTo.dm_id) === selected.id ? { reply_to: replyTo.id } : {};
    const result = await db.from('messages').insert({ ...fields, ...reply, [selected.type === 'channel' ? 'channel_id' : 'dm_id']: selected.id }).select().single();
    if (result.error) throw result.error;
    setReplyTo(null);
    if (activeTarget.current?.id !== selected.id) return;
    followMessages.current = true; setMessages(prev => prev.some(m => m.id === result.data.id) ? prev : [...prev, result.data]);
  }
  async function send(e: FormEvent) {
    e.preventDefault(); if (!target) return;
    const selected = target;
    await act(async () => { await post(selected, { body: messageSchema.parse(body) }); if (activeTarget.current?.id === selected.id) setBody(''); });
  }
  // Áudio e figurinha lançam o erro para a barra de envio, que mostra o aviso e deixa tentar de novo.
  async function sendAudio(recording: Recording) {
    if (!target) throw new Error('Abra uma conversa para enviar o áudio.');
    const selected = target;
    const path = await uploadAudio(db, me, selected.id, await prepareAudio(recording.blob));
    try { await post(selected, { kind: 'audio', body: '', media_path: path, media_duration_ms: Math.max(500, Math.round(recording.ms)) }); }
    catch (e) { void db.storage.from('chat-audio').remove([path]); throw e; }
  }
  async function sendSticker(sticker: Sticker) {
    if (!target) throw new Error('Abra uma conversa para enviar a figurinha.');
    await post(target, { kind: 'sticker', body: '', media_path: sticker.path });
  }
  useEffect(() => () => clearSignedUrls(), []);
  async function connect(channel: Channel) {
    if (voice?.channelId===channel.id){openCallView();return;}
    setMobileNavOpen(false);
    // Janela do NACALL: libera e escolhe o microfone na primeira vez; depois de liberado entra direto na call.
    if (!(await ensureMic())) return;
    await act(async () => {
      const { data: { session: fresh } } = await db.auth.getSession();
      const response = await fetch('/api/livekit/token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fresh?.access_token ?? ''}` }, body: JSON.stringify({ channelId: channel.id }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Falha ao conectar.');
      setTarget(null);setServerId(channel.server_id);setCallView(true);setVoice({ ...result, name: channel.name, channelId: channel.id, startedAt: result.startedAt??null, joinedAt: Date.now() + clockOffset });
    });
  }
  const roomIds=channels.filter(c=>c.kind==='voice').map(c=>c.id).sort().join(',');
  const activeIds=new Set(Object.values(roomStates).flatMap(room=>room.participants.map(p=>p.id)));
  const meInRoom={ id: me, name: profile?.display_name ?? 'Você', avatar: avatarUrl(profile?.avatar_path) };
  const roomOf=(id:string)=>voice?.channelId===id?withLocalParticipant(roomStates[id],id,meInRoom,voice.joinedAt??Date.now()+clockOffset):roomStates[id];
  // a chamada em que a pessoa está agora, entre as salas dos seus servidores (o cartão de perfil mostra e deixa entrar)
  const callOf=(id:string):ProfileCall|undefined=>{const c=channels.find(ch=>ch.kind==='voice'&&roomOf(ch.id)?.participants.some(p=>p.id===id));const room=c&&roomOf(c.id);if(!c||!room)return undefined;return{channelName:c.name,serverName:servers.find(sv=>sv.id===c.server_id)?.name??'',people:room.participants,join:voice?.channelId===c.id?undefined:()=>{setInspectedProfile(null);setMobileNavOpen(false);void connect(c);}};};
  const nowServer=clockNow+clockOffset;
  const serverCallCount=(id:string)=>new Set(channels.filter(c=>c.server_id===id&&c.kind==='voice').flatMap(c=>(roomStates[c.id]?.participants??[]).map(p=>p.id))).size;
  useEffect(()=>{let active=true;let inFlight=false;let queued=false;if(!roomIds){setRoomStates({});return;}const read=async()=>{if(document.visibilityState==='hidden')return;if(inFlight){queued=true;return;}inFlight=true;const sentAt=Date.now();try{const{data:{session:current}}=await db.auth.getSession();const ids=roomIds.split(',');const batches=Array.from({length:Math.ceil(ids.length/30)},(_,i)=>ids.slice(i*30,i*30+30));const parts=await Promise.all(batches.map(async channelIds=>{const r=await fetch('/api/livekit/rooms',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+current?.access_token},body:JSON.stringify({channelIds})});if(!r.ok)throw new Error();return r.json();}));const data={rooms:parts.flatMap(p=>p.rooms)};const serverNow=parts.find(p=>typeof p.serverNow==='number')?.serverNow;if(active&&typeof serverNow==='number')setClockOffset(measureClockOffset(serverNow,sentAt,Date.now()));if(active)setRoomStates(previous=>{const next=Object.fromEntries(data.rooms.map((r:RoomSnapshot)=>[r.channelId,r]));return JSON.stringify(previous)===JSON.stringify(next)?previous:next;});}catch{}finally{inFlight=false;if(queued){queued=false;void read();}}};void read();const timer=setInterval(()=>void read(),12000);const tick=setInterval(()=>setClockNow(Date.now()),1000);const refresh=()=>void read();window.addEventListener('nacall-room-refresh',refresh);document.addEventListener('visibilitychange',refresh);return()=>{active=false;clearInterval(timer);clearInterval(tick);window.removeEventListener('nacall-room-refresh',refresh);document.removeEventListener('visibilitychange',refresh);};},[db,roomIds]);
  async function loadOlder() {
    if (!target || !messages.length) return;
    const selected = target;
    await act(async () => { const { data, error } = await db.from('messages').select('*').eq(selected.type === 'channel' ? 'channel_id' : 'dm_id', selected.id).lt('created_at', messages[0].created_at).order('created_at', { ascending: false }).limit(50); if (error) throw error; if (activeTarget.current?.id !== selected.id) return; followMessages.current = false; historyLimit.current += data?.length ?? 0; setMessages(prev => [...(data ?? []).reverse(), ...prev]); setOlder(data?.length === 50); });
  }
  const inCallView = Boolean(voice) && callView && !target;
  const reactions = useReactions(db, messages.map(m => m.id), me, setNotice);
  // Linha de membro: a mesma na coluna da direita (telas largas) e na gaveta (celular e telas até 1300px, onde a coluna some).
  const memberRow = (id: string) => <div className="member" key={id}><button className="profile-avatar-button" aria-label={`Ver perfil de ${getName(id)}`} onClick={()=>setInspectedProfile(profiles[id])}>{server?<PresenceAvatar profile={profiles[id]} state={memberState(id,me,presence.mine,acceptedIds.includes(id)?presence.map:{},presence.serverMap)}/>:<Avatar profile={profiles[id]}/>}</button><div><strong>{getName(id)}</strong><small>{id === server?.owner_id ? 'Proprietário' : id === me ? 'Você' : !server?'Em call':roles.filter(r=>r.server_id===serverId&&assignments.some(a=>a.user_id===id&&a.role_id===r.id)).sort((a,b)=>b.position-a.position)[0]?.name||'Membro'}</small></div></div>;
  // Celular: Voltar fecha a gaveta, depois a conversa ou o painel da call (a call segue conectada), em vez de sair do site e derrubar a call.
  useBackButton(compactBar && (mobileNavOpen || Boolean(target) || inCallView), () => { if (mobileNavOpen) setMobileNavOpen(false); else if (target) setTarget(null); else setCallView(false); });
  function openCallView() { setTarget(null); const c = channels.find(c => c.id === voice?.channelId); if (c) setServerId(c.server_id); setCallView(true); setMobileNavOpen(false); }
  // Sair da call (botão, queda ou troca de sala): quem avisa é a call de uma sala; se já há outra no lugar dela, o aviso é ignorado.
  function leaveCall(channelId: string) { if (!isCurrentCall(voiceRef.current, channelId)) return; setVoice(null); setCallView(false); window.dispatchEvent(new Event('nacall-room-refresh')); }
  return <div className={`shell ${mobileNavOpen?'nav-open':''} ${shellCallClass({ voice: Boolean(voice), callView, target: Boolean(target) })}`}>
    <button className="mobile-nav-toggle" aria-label={mobileNavOpen?'Fechar canais':'Abrir canais e conversas'} aria-expanded={mobileNavOpen} aria-controls="workspace-sidebar" onClick={()=>setMobileNavOpen(v=>!v)}>{mobileNavOpen?<X size={21}/>:<Menu size={21}/>}{!mobileNavOpen&&unreadMessages+pendingIn>0&&<span className="nav-toggle-badge" aria-label={`${unreadMessages+pendingIn} novidades`}>{badgeText(unreadMessages+pendingIn)}</span>}</button>
    {mobileNavOpen&&<button className="mobile-nav-shade" aria-label="Fechar navegação" onClick={()=>setMobileNavOpen(false)}/>}
    <nav className="rail" aria-label="Navegação principal"><button className="logo-button" title="Início" onClick={() => { setServerId(null); setTarget(null); setCallView(false); setHomeView('friends');setMobileNavOpen(false); }}><Brand compact/></button><div className="rail-line" />
      <button className={!serverId ? 'selected' : ''} title="Amigos" aria-label="Início, amigos e mensagens" onClick={() => { setServerId(null); setTarget(null); setCallView(false); setHomeView('friends');setMobileNavOpen(true); }}><Users size={22} />{unreadMessages > 0 && <span className="rail-badge" aria-label={`${unreadMessages} mensagens não lidas`}>{badgeText(unreadMessages)}</span>}</button>
      {servers.map(s => <button key={s.id} className={serverId === s.id ? 'selected' : ''} title={s.name} onClick={() => { setServerId(s.id); setTarget(null); setCallView(false); setMobileNavOpen(true); }}><GroupIcon server={s}/>{serverCallCount(s.id)>0&&<span className="server-voice-badge" aria-label={`${serverCallCount(s.id)} pessoas em call`}><Headphones size={10}/>{serverCallCount(s.id)}</span>}</button>)}
      <button title="Criar ou entrar em servidor" onClick={() => { setServerId(null); setTarget(null); setCallView(false); setHomeView('communities');setMobileNavOpen(false); }}><Plus size={23} /></button>
      <button className="rail-theme" title="Escolher tema" aria-label="Escolher tema" onClick={() => {setSettingsTab('appearance');setSettings(true);}}><SunMoon size={21}/></button><span className="rail-bottom">NACALL</span></nav>
    <div className="voice-dock-bar" ref={setDockBar} />
    <aside className="sidebar" id="workspace-sidebar"><header><Brand/></header>
      <div className="side-content"><div className="section-label">{server ? 'COMUNIDADE' : 'CONEXÕES'}</div><h2>{server?.name || 'Seu ponto de encontro'}</h2>
        {server ? <><div className="group-sidebar-profile"><GroupIcon server={server}/><p className="muted small">{server.description||"O lobby dessa galera."}</p></div><div className="section-label">CANAIS DE TEXTO</div>{channels.filter(c => c.server_id === serverId && c.kind === 'text').map(c => <button className={`nav-item ${target?.id === c.id ? 'active' : ''}`} key={c.id} onClick={() => {setTarget({ id: c.id, type: 'channel', name: c.name });setMobileNavOpen(false);}}><Hash size={18} />{c.name}</button>)}
          <div className="section-label">SALAS DE VOZ</div>{channels.filter(c => c.server_id === serverId && c.kind === 'voice').map(c => { const room = roomOf(c.id); return <div key={c.id}><button disabled={busy} className={`nav-item ${voice?.channelId === c.id ? 'active' : ''}`} key={c.id} onClick={() => void connect(c)}><Headphones size={18} />{c.name}<span className="tiny">{room?.count?durationLabel(room.startedAt,nowServer):"Entrar na call"}</span></button>{Boolean(room?.count)&&<div className="voice-roster">{room.participants.map(p=>{const flags=shownFlags(p,voice?.channelId===c.id?livePeople[p.id]:undefined);return <button type="button" className={`voice-roster-person ${speakingIds.includes(p.id)?'speaking':''}`} key={p.id} onClick={()=>profiles[p.id]&&setInspectedProfile(profiles[p.id])}><Avatar profile={profiles[p.id]} name={p.name} url={p.avatar}/><span className="roster-name">{p.name}</span>{flags.sharing&&<LiveBadge/>}<PersonStateIcons muted={flags.muted} deaf={flags.deaf}/></button>;})}</div>}</div>; })}
          {!server.is_official&&<button className="nav-item" onClick={()=>{setGroupTab("profile");setGroupSettings(true);}}><Settings size={17}/>Configurações do grupo</button>}
          {can('manage_invites')&&<button className="nav-item" onClick={()=>{setGroupTab("invites");setGroupSettings(true);}}><Plus size={17}/>Convidar amigos</button>}
          <div className="side-members"><div className="section-label">MEMBROS · {members.length}</div>{members.map(memberRow)}</div>
        </> : <><button className={`nav-item ${!target&&!inCallView&&homeView==='friends'?'active':''}`} onClick={()=>{setTarget(null);setCallView(false);setHomeView('friends');setFriendTab('all');setMobileNavOpen(false);}}><Users size={18}/>Amigos{pendingIn>0&&<span className="unread-badge" aria-label={`${pendingIn} solicitações de amizade pendentes`}>{badgeText(pendingIn)}</span>}</button><button className={`nav-item ${!target&&!inCallView&&homeView==='store'?'active':''}`} onClick={()=>{setTarget(null);setCallView(false);setHomeView('store');setMobileNavOpen(false);}}><ShoppingBag size={18}/>Loja</button><button className={`nav-item ${!target&&!inCallView&&homeView==='communities'?'active':''}`} onClick={()=>{setTarget(null);setCallView(false);setHomeView('communities');setMobileNavOpen(false);}}><Compass size={18}/>Comunidades</button><div className="section-label">MENSAGENS DIRETAS</div>{dms.length === 0 && <p className="muted small">Suas conversas vão aparecer aqui.</p>}{dms.map(d => { const id = d.user_a === me ? d.user_b : d.user_a; return <ProfileHover key={d.id} className="block" profile={profiles[id]} info={infoOf(id)}><button className={`nav-item ${target?.id === d.id ? 'active' : ''} ${unreadByDm[d.id] ? 'has-unread' : ''}`} onClick={() => {setTarget({ id: d.id, type: 'dm', name: getName(id) });setMobileNavOpen(false);}}><PresenceAvatar profile={profiles[id]} state={infoOf(id)?.state}/><span className="nav-name">{getName(id)}</span>{unreadByDm[d.id] && <span className="unread-badge" aria-label={`${unreadByDm[d.id].unread} mensagens não lidas`}>{badgeText(unreadByDm[d.id].unread)}</span>}</button></ProfileHover>; })}</>}
      </div><div className="voice-bar-slot" ref={setSideBar} /><div className="account"><StatusMenu profile={profiles[me]} status={presence.mine} setStatus={presence.setStatus} onError={setNotice}/><div><strong>{getName(me)}</strong><small>@{profile?.username || '…'}</small></div><button title="Configurações" onClick={() => {setSettingsTab('profile');setSettings(true);}}><Settings size={17} /></button><button title="Sair da conta" onClick={() => void act(async () => { setVoice(null); const { error } = await db.auth.signOut(); if (error) throw error; })}><LogOut size={17} /></button></div></aside>
    <main className={`main ${voice && !target && serverId && channels.some(c => c.id === voice.channelId && c.server_id === serverId) ? "show-call" : ""}`}><header className="topbar"><div className="row"><span className="accent">{target ? <Hash size={22} /> : <Radio size={22} />}</span><strong>{target?.name || server?.name || (homeView==='store'?'Loja':homeView==='friends'?'Amigos':'Comunidades')}</strong><span className="divider" /><span className="muted small">{target ? 'Sem spam. Só a resenha.' : 'Sua call. Seu squad. Seu caos organizado.'}</span></div><div className="topbar-actions"><NotificationBell userId={me} me={me} items={unread.items} dms={dms} profiles={profiles} getName={getName} openConversation={dmId => { const dm = dms.find(d => d.id === dmId); if (!dm) return; const other = dm.user_a === me ? dm.user_b : dm.user_a; setServerId(null); setTarget({ id: dm.id, type: 'dm', name: getName(other) }); setMobileNavOpen(false); }} /><button disabled={busy} onClick={() => { void act(load); setTarget(t => t ? { ...t } : t); }}>Atualizar</button></div></header>
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Fechar aviso" onClick={() => setNotice('')}>×</button></div>}
      {inspectedProfile&&<ProfileCard presence={infoOf(inspectedProfile.id)} profile={inspectedProfile} close={()=>setInspectedProfile(null)} own={inspectedProfile.id===me} friendship={friends.find(f=>f.sender_id===inspectedProfile.id||f.receiver_id===inspectedProfile.id)} me={me} busy={busy} request={()=>requestFriend(inspectedProfile.id)} accept={acceptFriend} remove={removeFriend} message={()=>{void openDM(inspectedProfile.id);setInspectedProfile(null);}} call={callOf(inspectedProfile.id)} edit={()=>{setInspectedProfile(null);setSettingsTab('profile');setSettings(true);}}/>}
      {groupSettings&&server&&<GroupSettings key={server.id+groupTab} initialTab={groupTab} db={db} server={server} me={me} profiles={profiles} members={members} channels={channels.filter(c=>c.server_id===serverId)} close={()=>setGroupSettings(false)} reload={load}/>}
      <TwoFactorPrompt db={db} userId={me} open={() => {setSettingsTab('2fa');setSettings(true);}} />
      {!recovery && !pendingInvite && <WhatsNew userId={me} accountCreatedAt={profile?.created_at} />}
      {pendingInvite&&<InviteCard db={db} code={pendingInvite} loggedIn joined={joined} dismiss={()=>{setPendingInvite(null);window.history.replaceState({},'', '/');}}/>}
      {(settings || recovery) && <ProfileSettings key={settingsTab} db={db} profile={profile} close={() => {setSettings(false); recovered();}} reload={load} report={setNotice} recovery={recovery} recovered={recovered} initialTab={settingsTab} />}
      {!target&&!server&&homeView==='friends'?<FriendsPanel db={db} me={me} profiles={profiles} friends={friends} activeIds={activeIds} tab={friendTab} setTab={setFriendTab} inspect={setInspectedProfile} request={requestFriend} accept={acceptFriend} remove={removeFriend} openDM={id=>void openDM(id)} busy={busy} infoOf={infoOf}/>:!target&&!server&&homeView==='store'?<StorePanel/>:!target ? <div className="dashboard">{server?<><CommunityCount compact/><section className="welcome"><span className="eyebrow"><Gamepad2 size={15}/> O LOBBY É NOSSO.</span><h1>Salve,<br /><em>{getName(me)}.</em></h1><p className="muted">O plano é ganhar. Se não rolar, a resenha tá garantida.<br />Chama sua galera e puxa uma cadeira no lobby.</p><div className="welcome-mark" aria-hidden="true"><img src="/brand/jacall-avatar.webp" width="180" height="180" alt=""/></div></section>
        <section className="card"><h2>Bem-vindo a {server.name}</h2><p className="muted">Escolha um canal de texto para conversar ou uma sala de voz para entrar na call.</p><p>{members.length} membro(s) nesta comunidade.</p></section></> : <>
          {/* Comunidades: entrar por convite e criar ficam no topo; amigos têm a tela própria (Amigos > Adicionar), sem formulário duplicado aqui. */}
          <section className="communities-head"><span className="eyebrow"><Compass size={15}/> COMUNIDADES</span><h1>Suas comunidades</h1><p className="muted">Entre com um convite ou monte o lobby da sua galera.</p></section>
          <div className="grid"><section className="card"><span className="section-label">RECEBEU A CONVOCAÇÃO?</span><h2>Tenho um convite</h2><form className="row" onSubmit={joinServer}><input name="code" aria-label="Link ou código do convite" placeholder="Cole o link ou código do convite" required defaultValue={typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('invite') || '' : ''} /><button className="primary" disabled={busy}>Entrar</button></form></section><section className="card"><span className="section-label">UM LUGAR SÓ SEU</span><h2>Criar comunidade</h2><form className="row" onSubmit={createServer}><input id="new-server" name="name" aria-label="Nome da comunidade" placeholder="Nome da sua comunidade" required minLength={2} maxLength={60} /><button className="primary" disabled={busy} aria-label="Criar comunidade"><Plus size={18} /></button></form></section></div>
          <section className="card"><h2>Onde você está <span className="count">{servers.length}</span></h2>{servers.length === 0 ? <p className="muted">Você ainda não entrou em nenhuma comunidade. Use um convite ou crie a sua.</p> : <ul className="community-list">{servers.map(s => <li key={s.id}><button className="community-row" onClick={() => { setServerId(s.id); setTarget(null); setCallView(false); }}><GroupIcon server={s}/><strong>{s.name}</strong><ArrowRight size={16} aria-hidden="true"/></button></li>)}</ul>}</section>
          <p className="muted small">Procurando um amigo? <button type="button" className="link" onClick={() => { setHomeView('friends'); setFriendTab('add'); }}>Adicionar em Amigos</button></p></>}
      </div> : <><div className="message-list" aria-live="polite">{older && <button disabled={busy} onClick={() => void loadOlder()}>Carregar anteriores</button>}{loading && <div className="msg-skeleton-list" role="status" aria-label="Carregando mensagens">{[70, 45, 85].map(w => <div className="msg-skeleton" key={w}><i className="av" /><div><i className="ln" style={{ width: '30%' }} /><i className="ln" style={{ width: `${w}%` }} /></div></div>)}</div>}{!loading && !messages.length && <div className="empty-chat"><MessageCircle size={40} /><h2>Aqui ainda tá quietinho. Suspeito.</h2><p className="muted">Mande a primeira mensagem em {target.name}.</p></div>}{messages.map((m, i) => { const lay = messageLayout(messages[i - 1], m); return <Fragment key={m.id}>{lay.newDay && <div className="date-sep" role="separator"><span>{dayLabel(m.created_at)}</span></div>}<article className={`message ${m.author_id === me ? 'mine' : 'theirs'} ${lay.grouped ? 'grouped' : ''}`} data-kind={m.kind ?? 'text'} id={`msg-${m.id}`}><button className="profile-avatar-button" aria-label={`Ver perfil de ${getName(m.author_id)}`} onClick={()=>setInspectedProfile(profiles[m.author_id])}><Avatar profile={profiles[m.author_id]}/></button><div className="grow bubble"><div className="row"><strong>{getName(m.author_id)}</strong><time className="muted small" dateTime={m.created_at}>{new Date(m.created_at).toLocaleString('pt-BR')}</time>{m.author_id === me && <button className="link small" disabled={busy} onClick={() => void act(async () => { const { error } = await db.from('messages').delete().eq('id', m.id); if (error) throw error; if (m.kind === 'audio' && m.media_path) void db.storage.from('chat-audio').remove([m.media_path]); setMessages(prev => prev.filter(x => x.id !== m.id)); })}>Excluir</button>}</div>{m.reply_to && <ReplyQuote original={messages.find(x => x.id === m.reply_to)} author={getName(messages.find(x => x.id === m.reply_to)?.author_id ?? '')} onJump={() => document.getElementById(`msg-${m.reply_to}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />}<MessageContent db={db} message={m} /><ReactionBar items={reactions.byMessage[m.id]} onToggle={emoji => void reactions.toggle(m.id, emoji)} /></div><MessageActions canCopy={(m.kind ?? 'text') === 'text'} onReply={() => setReplyTo(m)} onReact={emoji => void reactions.toggle(m.id, emoji)} onCopy={() => void navigator.clipboard?.writeText(m.body).then(() => setNotice('Texto copiado.'), () => setNotice('Não deu para copiar o texto.'))} /></article></Fragment>; })}<div ref={bottom} /></div>{replyTo && <ReplyBar original={replyTo} author={getName(replyTo.author_id)} onCancel={() => setReplyTo(null)} />}<Composer key={target.id} db={db} placeholder={`Conversar em ${target.name}…`} value={body} setValue={setBody} busy={busy} onSubmit={send} sendAudio={sendAudio} sendSticker={sendSticker} report={setNotice} /></>}
      
    </main>{notice&&inCallView&&<div className="notice notice-call" role="status"><span>{notice}</span><button aria-label="Fechar aviso" onClick={() => setNotice('')}>×</button></div>}{voice&&<aside className={`call-dock ${storeBenefits.pro?"store-pro-call":""}`} aria-label="Chamada atual"><Voice key={voice.channelId} session={voice} focused={inCallView} bar={compactBar?dockBar:sideBar} barVariant={compactBar?'dock':'side'} snapshot={roomOf(voice.channelId)} clockOffset={clockOffset} onSpeaking={setSpeakingIds} onPeople={setLivePeople} openCall={openCallView} leave={()=>leaveCall(voice.channelId)} report={setNotice} db={db} profile={profile}/></aside>}<aside className="members"><div className="section-label">{server ? `MEMBROS · ${members.length}` : 'ATIVO AGORA'}</div>{(server ? members : friends.filter(f=>f.status==='accepted').map(f=>f.sender_id===me?f.receiver_id:f.sender_id).filter(id=>activeIds.has(id))).map(memberRow)}<div className="member-note"><Headphones size={24} /><h3>Só mais uma call.</h3><p>Crie seu canto, convide a galera e descubra quem esqueceu o mic aberto.</p></div></aside>
  </div>;
}


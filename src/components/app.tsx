'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Hash, Headphones, Plus, Users, Radio, LogOut, Settings, ArrowRight, MessageCircle, SunMoon, Gamepad2, ShieldCheck, Menu, X } from 'lucide-react';
import {Landing} from './landing';
import {CommunityCount} from './community-count';
import { getSupabase } from '@/lib/supabase';
import { errorText, messageSchema, nameSchema, usernameSchema } from '@/lib/validation';
import type { Channel, DM, Friendship, Message, Profile, Server } from '@/lib/types';
import {durationLabel,type RoomSnapshot} from '@/lib/room-clock';
import {profileTag,friendNumber} from '@/lib/identity';
import {GroupIcon} from './group-icon';
import {InviteCard,inviteCode} from './invite';
import type {ServerRole,MemberRole} from '@/lib/types';
import { Auth } from './auth';
import { Brand } from './brand';
import { Avatar } from './avatar';
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
  useEffect(() => {
    if (!db) return;
    void db.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = db.auth.onAuthStateChange((event, next) => { setSession(next); setReady(true); if (event === 'PASSWORD_RECOVERY') setRecovery(true); if (event === 'SIGNED_OUT') { setPendingInvite(null); window.history.replaceState({}, '', '/'); } });
    return () => data.subscription.unsubscribe();
  }, [db]);
  if (!db) return initialScreen==='landing'?<Landing/>:<main className="setup"><Brand/><h1>O lobby está<br/>aquecendo.</h1><p>O login está temporariamente indisponível. Tente de novo em instantes.</p><a href="/">Voltar para o início</a></main>;
  if (!ready) return initialScreen==='landing'?<Landing/>:<main className="setup" role="status">Abrindo seu espaço…</main>;
  if (!session) return initialScreen==='landing'&&!pendingInvite?<Landing/>:<>{pendingInvite&&<div className="invite-auth"><InviteCard db={db} code={pendingInvite} loggedIn={false}/></div>}<Auth db={db} /></>;
  return <Workspace key={session.user.id} db={db} session={session} recovery={recovery} recovered={() => setRecovery(false)} />;
}

function Workspace({ db, session, recovery, recovered }: { db: SupabaseClient; session: Session; recovery: boolean; recovered: () => void }) {
  const me = session.user.id;
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [dms, setDms] = useState<DM[]>([]);
  const [serverId, setServerId] = useState<string | null>(null);
  const [target, setTarget] = useState<{ id: string; type: 'channel' | 'dm'; name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [older, setOlder] = useState(false);
  const [notice, setNotice] = useState('');
  const [settings, setSettings] = useState(false);
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile'|'appearance'>('profile');
  const[inspectedProfile,setInspectedProfile]=useState<Profile|null>(null);const[roomStates,setRoomStates]=useState<Record<string,RoomSnapshot>>({});const[clockNow,setClockNow]=useState(Date.now());
  const [voice, setVoice] = useState<VoiceSession | null>(null);
  const [groupSettings,setGroupSettings]=useState(false);const[groupTab,setGroupTab]=useState("profile");
  const [roles,setRoles]=useState<ServerRole[]>([]);
  const [assignments,setAssignments]=useState<MemberRole[]>([]);
  const [pendingInvite,setPendingInvite]=useState<string|null>(()=>typeof window==='undefined'?null:inviteCode(new URLSearchParams(window.location.search).get('invite')||''));
  const bottom = useRef<HTMLDivElement>(null);
  const historyLimit = useRef(50);
  const followMessages = useRef(true);
  const activeTarget = useRef(target);
  activeTarget.current = target;
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
    setBody(''); historyLimit.current = 50; followMessages.current = true;
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
  async function addFriend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const raw = String(new FormData(form).get('username'));
    await act(async () => {
      const number=friendNumber(raw);
      const query=db.from('profiles').select('id');
      const { data, error } = await (number!==null?query.eq('user_number',number):query.eq('username',usernameSchema.parse(raw.trim().replace(/^@/,'')))).single();
      if (error || !data) throw new Error('Usuário não encontrado.');
      if (data.id === me) throw new Error('Use o identificador de um amigo.');
      const result = await db.from('friendships').insert({ sender_id: me, receiver_id: data.id });
      if (result.error) { if(result.error.code==='23505') throw new Error('Já existe uma amizade ou solicitação entre vocês. Confira sua lista.'); throw result.error; } await load(); form.reset(); setNotice('Solicitação enviada.');
    });
  }
  async function openDM(id: string) {
    await act(async () => { const { data, error } = await db.rpc('open_dm', { friend_id: id }); if (error) throw error; await load(); setServerId(null); setTarget({ id: data, type: 'dm', name: getName(id) }); });
  }
  async function send(e: FormEvent) {
    e.preventDefault(); if (!target) return;
    const selected = target;
    await act(async () => { const result = await db.from('messages').insert({ body: messageSchema.parse(body), [selected.type === 'channel' ? 'channel_id' : 'dm_id']: selected.id }).select().single(); if (result.error) throw result.error; if (activeTarget.current?.id !== selected.id) return; setBody(''); followMessages.current = true; setMessages(prev => prev.some(m => m.id === result.data.id) ? prev : [...prev, result.data]); });
  }
  async function connect(channel: Channel) {
    if (voice?.channelId===channel.id){setTarget(null);setServerId(channel.server_id);return;}
    if (voice) { setNotice('Saia da chamada atual antes de entrar em outra sala.'); return; }
    setMobileNavOpen(false);
    await act(async () => {
      const { data: { session: fresh } } = await db.auth.getSession();
      const response = await fetch('/api/livekit/token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fresh?.access_token ?? ''}` }, body: JSON.stringify({ channelId: channel.id }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Falha ao conectar.');
      setTarget(null);setServerId(channel.server_id);setVoice({ ...result, name: channel.name, channelId: channel.id, startedAt: result.startedAt??null });
    });
  }
  const roomIds=channels.filter(c=>c.kind==='voice'&&(c.server_id===serverId||c.id===voice?.channelId)).map(c=>c.id).sort().join(',');
  useEffect(()=>{let active=true;let inFlight=false;if(!roomIds){setRoomStates({});return;}const read=async()=>{if(inFlight||document.visibilityState==='hidden')return;inFlight=true;try{const{data:{session:current}}=await db.auth.getSession();const r=await fetch('/api/livekit/rooms',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+current?.access_token},body:JSON.stringify({channelIds:roomIds?roomIds.split(','):[]})});if(!r.ok)throw new Error();const data=await r.json();if(active)setRoomStates(previous=>{const next=Object.fromEntries(data.rooms.map((r:RoomSnapshot)=>[r.channelId,r]));return JSON.stringify(previous)===JSON.stringify(next)?previous:next;});}catch{}finally{inFlight=false;}};void read();const timer=setInterval(()=>void read(),5000);const tick=setInterval(()=>setClockNow(Date.now()),1000);const refresh=()=>void read();window.addEventListener('nacall-room-refresh',refresh);document.addEventListener('visibilitychange',refresh);return()=>{active=false;clearInterval(timer);clearInterval(tick);window.removeEventListener('nacall-room-refresh',refresh);document.removeEventListener('visibilitychange',refresh);};},[db,roomIds]);
  async function loadOlder() {
    if (!target || !messages.length) return;
    const selected = target;
    await act(async () => { const { data, error } = await db.from('messages').select('*').eq(selected.type === 'channel' ? 'channel_id' : 'dm_id', selected.id).lt('created_at', messages[0].created_at).order('created_at', { ascending: false }).limit(50); if (error) throw error; if (activeTarget.current?.id !== selected.id) return; followMessages.current = false; historyLimit.current += data?.length ?? 0; setMessages(prev => [...(data ?? []).reverse(), ...prev]); setOlder(data?.length === 50); });
  }
  return <div className={`shell ${mobileNavOpen?'nav-open':''} ${voice?target?"has-call call-chat":"has-call call-focus":""}`}>
    <button className="mobile-nav-toggle" aria-label={mobileNavOpen?'Fechar canais':'Abrir canais e conversas'} aria-expanded={mobileNavOpen} aria-controls="workspace-sidebar" onClick={()=>setMobileNavOpen(v=>!v)}>{mobileNavOpen?<X size={21}/>:<Menu size={21}/>}</button>
    {mobileNavOpen&&<button className="mobile-nav-shade" aria-label="Fechar navegação" onClick={()=>setMobileNavOpen(false)}/>}
    <nav className="rail" aria-label="Navegação principal"><button className="logo-button" title="Início" onClick={() => { setServerId(null); setTarget(null); setMobileNavOpen(false); }}><Brand compact/></button><div className="rail-line" />
      <button className={!serverId ? 'selected' : ''} title="Amigos" onClick={() => { setServerId(null); setTarget(null); setMobileNavOpen(false); }}><Users size={22} /></button>
      {servers.map(s => <button key={s.id} className={serverId === s.id ? 'selected' : ''} title={s.name} onClick={() => { setServerId(s.id); setTarget(null); setMobileNavOpen(true); }}><GroupIcon server={s}/></button>)}
      <button title="Criar ou entrar em servidor" onClick={() => { setServerId(null); setTarget(null); document.getElementById('new-server')?.focus(); }}><Plus size={23} /></button>
      <button className="rail-theme" title="Escolher tema" aria-label="Escolher tema" onClick={() => {setSettingsTab('appearance');setSettings(true);}}><SunMoon size={21}/></button><span className="rail-bottom">NACALL</span></nav>
    <aside className="sidebar" id="workspace-sidebar"><header><Brand/></header>
      <div className="side-content"><div className="section-label">{server ? 'COMUNIDADE' : 'CONEXÕES'}</div><h2>{server?.name || 'Seu ponto de encontro'}</h2>
        {server ? <><div className="group-sidebar-profile"><GroupIcon server={server}/><p className="muted small">{server.description||"O lobby dessa galera."}</p></div><div className="section-label">CANAIS DE TEXTO</div>{channels.filter(c => c.server_id === serverId && c.kind === 'text').map(c => <button className={`nav-item ${target?.id === c.id ? 'active' : ''}`} key={c.id} onClick={() => {setTarget({ id: c.id, type: 'channel', name: c.name });setMobileNavOpen(false);}}><Hash size={18} />{c.name}</button>)}
          <div className="section-label">SALAS DE VOZ</div>{channels.filter(c => c.server_id === serverId && c.kind === 'voice').map(c => <div key={c.id}><button disabled={busy} className={`nav-item ${voice?.channelId === c.id ? 'active' : ''}`} key={c.id} onClick={() => void connect(c)}><Headphones size={18} />{c.name}<span className="tiny">{roomStates[c.id]?.count?durationLabel(roomStates[c.id].startedAt,clockNow):"Entrar na call"}</span></button>{Boolean(roomStates[c.id]?.count)&&<div className="voice-roster">{roomStates[c.id].participants.map(p=><div key={p.id}><Avatar profile={profiles[p.id]} name={p.name} url={p.avatar}/><span>{p.name}</span></div>)}</div>}</div>)}
          {!server.is_official&&<button className="nav-item" onClick={()=>{setGroupTab("profile");setGroupSettings(true);}}><Settings size={17}/>Configurações do grupo</button>}
          {can('manage_invites')&&<button className="nav-item" onClick={()=>{setGroupTab("invites");setGroupSettings(true);}}><Plus size={17}/>Convidar amigos</button>}
        </> : <><button className={`nav-item ${!target ? 'active' : ''}`} onClick={() => setTarget(null)}><Users size={18} />Amigos e comunidades</button><div className="section-label">MENSAGENS DIRETAS</div>{dms.length === 0 && <p className="muted small">Suas conversas vão aparecer aqui.</p>}{dms.map(d => { const id = d.user_a === me ? d.user_b : d.user_a; return <button className={`nav-item ${target?.id === d.id ? 'active' : ''}`} key={d.id} onClick={() => {setTarget({ id: d.id, type: 'dm', name: getName(id) });setMobileNavOpen(false);}}><MessageCircle size={17} />{getName(id)}</button>; })}</>}
      </div><div className="account"><Avatar profile={profiles[me]}/><div><strong>{getName(me)}</strong><small>@{profile?.username || '…'}</small></div><button title="Configurações" onClick={() => {setSettingsTab('profile');setSettings(true);}}><Settings size={17} /></button><button title="Sair da conta" onClick={() => void act(async () => { setVoice(null); const { error } = await db.auth.signOut(); if (error) throw error; })}><LogOut size={17} /></button></div></aside>
    <main className={`main ${voice && !target && serverId && channels.some(c => c.id === voice.channelId && c.server_id === serverId) ? "show-call" : ""}`}><header className="topbar"><div className="row"><span className="accent">{target ? <Hash size={22} /> : <Radio size={22} />}</span><strong>{target?.name || server?.name || 'Lobby da galera'}</strong><span className="divider" /><span className="muted small">{target ? 'Sem spam. Só a resenha.' : 'Sua call. Seu squad. Seu caos organizado.'}</span></div><button disabled={busy} onClick={() => { void act(load); setTarget(t => t ? { ...t } : t); }}>Atualizar</button></header>
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Fechar aviso" onClick={() => setNotice('')}>×</button></div>}
      {inspectedProfile&&<ProfileCard profile={inspectedProfile} close={()=>setInspectedProfile(null)}/>}
      {groupSettings&&server&&<GroupSettings key={server.id+groupTab} initialTab={groupTab} db={db} server={server} me={me} profiles={profiles} members={members} channels={channels.filter(c=>c.server_id===serverId)} close={()=>setGroupSettings(false)} reload={load}/>}
      {pendingInvite&&<InviteCard db={db} code={pendingInvite} loggedIn joined={joined} dismiss={()=>{setPendingInvite(null);window.history.replaceState({},'', '/');}}/>}
      {(settings || recovery) && <ProfileSettings key={settingsTab} db={db} profile={profile} close={() => {setSettings(false); recovered();}} reload={load} report={setNotice} recovery={recovery} recovered={recovered} initialTab={settingsTab} />}
      {!target ? <div className="dashboard"><CommunityCount compact/><section className="welcome"><span className="eyebrow"><Gamepad2 size={15}/> O LOBBY É NOSSO.</span><h1>Salve,<br /><em>{getName(me)}.</em></h1><p className="muted">O plano é ganhar. Se não rolar, a resenha tá garantida.<br />Chama sua galera e puxa uma cadeira no lobby.</p><div className="welcome-mark" aria-hidden="true"><img src="/brand/symbol.svg" width="130" height="130" alt=""/></div></section>
        {server ? <section className="card"><h2>Bem-vindo a {server.name}</h2><p className="muted">Escolha um canal de texto para conversar ou uma sala de voz para entrar na call.</p><p>{members.length} membro(s) nesta comunidade.</p></section> : <><div className="grid"><section className="card"><span className="section-label">SUA GALERA</span><h2>Chamar pro squad</h2><p className="muted small">Encontre alguém por @username ou Nome #00001.</p><form className="row" onSubmit={addFriend}><input name="username" aria-label="Username do amigo" placeholder="Never #00001 ou @username" required maxLength={80} /><button className="primary" disabled={busy} aria-label="Enviar solicitação"><ArrowRight size={18} /></button></form></section><section className="card"><span className="section-label">UM LUGAR SÓ SEU</span><h2>Montar meu lobby</h2><form className="row" onSubmit={createServer}><input id="new-server" name="name" aria-label="Nome do servidor" placeholder="Nome da sua comunidade" required minLength={2} maxLength={60} /><button className="primary" disabled={busy} aria-label="Criar servidor"><Plus size={18} /></button></form></section></div>
          <section className="card"><h2>Amigos <span className="count">{friends.filter(f => f.status === 'accepted').length}</span></h2>{friends.length === 0 && <p className="muted">Sua lista ainda está no tutorial. Chame um amigo pelo usuário.</p>}{friends.map(f => { const id = f.sender_id === me ? f.receiver_id : f.sender_id; const incoming = f.receiver_id === me && f.status === 'pending'; return <div className="friend-row" key={f.id}><Avatar profile={profiles[id]}/><div className="grow"><strong>{getName(id)}</strong><small>@{profiles[id]?.username} · {f.status === 'accepted' ? 'Amigo' : incoming ? 'Quer ser seu amigo' : 'Solicitação enviada'}</small></div>{incoming && <button disabled={busy} onClick={() => void act(async () => { const { error } = await db.from('friendships').update({ status: 'accepted' }).eq('id', f.id); if (error) throw error; await load(); })}>Aceitar</button>}{f.status === 'accepted' && <button disabled={busy} onClick={() => void openDM(id)}>Conversar</button>}<button disabled={busy} className="link" onClick={() => void act(async () => { const { error } = await db.from('friendships').delete().eq('id', f.id); if (error) throw error; await load(); })}>{f.status === 'accepted' ? 'Remover' : incoming ? 'Recusar' : 'Cancelar'}</button></div>; })}</section>
          <section className="card"><h2>Recebeu a convocação?</h2><form className="row" onSubmit={joinServer}><input name="code" aria-label="Código ou link do convite" placeholder="Cole o link do grupo e veja o convite" required defaultValue={typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('invite') || '' : ''} /><button disabled={busy}>Entrar</button></form></section></>}
      </div> : <><div className="message-list" aria-live="polite">{older && <button disabled={busy} onClick={() => void loadOlder()}>Carregar anteriores</button>}{loading && <p className="muted">Carregando mensagens…</p>}{!loading && !messages.length && <div className="empty-chat"><MessageCircle size={40} /><h2>Aqui ainda tá quietinho. Suspeito.</h2><p className="muted">Mande a primeira mensagem em {target.name}.</p></div>}{messages.map(m => <article className="message" key={m.id}><button className="profile-avatar-button" aria-label={`Ver perfil de ${getName(m.author_id)}`} onClick={()=>setInspectedProfile(profiles[m.author_id])}><Avatar profile={profiles[m.author_id]}/></button><div className="grow"><div className="row"><strong>{getName(m.author_id)}</strong><time className="muted small" dateTime={m.created_at}>{new Date(m.created_at).toLocaleString('pt-BR')}</time>{m.author_id === me && <button className="link small" disabled={busy} onClick={() => void act(async () => { const { error } = await db.from('messages').delete().eq('id', m.id); if (error) throw error; setMessages(prev => prev.filter(x => x.id !== m.id)); })}>Excluir</button>}</div><p>{m.body}</p></div></article>)}<div ref={bottom} /></div><form className="composer" onSubmit={send}><input aria-label="Mensagem" placeholder={`Conversar em ${target.name}…`} maxLength={4000} required value={body} onChange={e => setBody(e.target.value)} /><button className="primary" disabled={busy || !body.trim()}>Enviar <ArrowRight size={16} /></button></form></>}
      
    </main>{voice&&<aside className={`call-dock ${target?"docked":"focused"}`} aria-label="Chamada atual"><Voice session={voice} compact={Boolean(target)} snapshot={roomStates[voice.channelId]} openCall={()=>{setTarget(null);const c=channels.find(c=>c.id===voice.channelId);if(c)setServerId(c.server_id);}} leave={()=>{setVoice(null);window.dispatchEvent(new Event("nacall-room-refresh"));}} report={setNotice} db={db} profile={profile}/></aside>}<aside className="members"><div className="section-label">{server ? `MEMBROS · ${members.length}` : 'SEU PERFIL'}</div>{(server ? members : [me]).map(id => <div className="member" key={id}><button className="profile-avatar-button" aria-label={`Ver perfil de ${getName(id)}`} onClick={()=>setInspectedProfile(profiles[id])}><Avatar profile={profiles[id]}/></button><div><strong>{getName(id)}</strong><small>{id === server?.owner_id ? 'Proprietário' : id === me ? 'Você' : roles.filter(r=>r.server_id===serverId&&assignments.some(a=>a.user_id===id&&a.role_id===r.id)).sort((a,b)=>b.position-a.position)[0]?.name||'Membro'}</small></div></div>)}<div className="member-note"><Headphones size={24} /><h3>Só mais uma call.</h3><p>Crie seu canto, convide a galera e descubra quem esqueceu o mic aberto.</p></div></aside>
  </div>;
}


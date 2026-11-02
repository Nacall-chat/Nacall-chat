'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Music2,Play,Pause,RefreshCw,X,Volume2,VolumeX,Link2} from 'lucide-react';
import {youtubeId,musicPosition,loadYoutube,type MusicState,type YoutubePlayer} from '@/lib/youtube';
import {errorText} from '@/lib/validation';
export function Music({db,channelId,deaf,visible}:{db:SupabaseClient;channelId:string;deaf:boolean;visible:boolean}){
 const[state,setState]=useState<MusicState|null>(null);const[enabled,setEnabled]=useState(false);const[link,setLink]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[volume,setVolume]=useState(35);const[ready,setReady]=useState(false);
 const[localMuted,setLocalMuted]=useState(false);const[title,setTitle]=useState('');
 const container=useRef<HTMLDivElement>(null);const player=useRef<YoutubePlayer|null>(null);const latest=useRef(state);latest.current=state;
 useEffect(()=>{setTitle('');if(!state?.video_id)return;const abort=new AbortController();void fetch(`/api/music/info?id=${state.video_id}`,{signal:abort.signal}).then(r=>r.json()).then(data=>{if(!abort.signal.aborted)setTitle(data.title||'Música no YouTube');}).catch(()=>{});return()=>abort.abort();},[state?.video_id]);
 useEffect(()=>{let active=true;const read=async()=>{const{data,error}=await db.from('room_media').select('*').eq('channel_id',channelId).maybeSingle();if(!active)return;if(error)setError(error.message);else setState(data);};void read();const sub=db.channel(`music-${channelId}`).on('postgres_changes',{event:'*',schema:'public',table:'room_media',filter:`channel_id=eq.${channelId}`},()=>void read()).subscribe(status=>{if(status==='SUBSCRIBED')void read();});const timer=setInterval(()=>void read(),10000);return()=>{active=false;clearInterval(timer);void db.removeChannel(sub);};},[db,channelId]);
 function sync(){const value=latest.current;const p=player.current;if(!value||!p||!ready)return;try{const target=musicPosition(value);if(Math.abs((p.getCurrentTime()||0)-target)>3)p.seekTo(target,true);if(value.playing)p.playVideo();else p.pauseVideo();}catch{}}
 useEffect(()=>{
  setReady(false);
  if(!enabled||localMuted||!visible||!state?.video_id||!container.current)return;
  let active=true;const node=document.createElement('div');container.current.replaceChildren(node);
  void loadYoutube().then(api=>{
   if(!active)return;
   player.current=new api.Player(node,{
    host:'https://www.youtube-nocookie.com',videoId:state.video_id,width:'100%',height:'100%',
    playerVars:{controls:1,playsinline:1,origin:window.location.origin},
    events:{
     onReady:()=>{if(active){setReady(true);setError('');setTitle(player.current?.getVideoData?.().title||'Vídeo do YouTube');}},
     onError:()=>setError('Esse vídeo não pode tocar aqui. Pode estar restrito, indisponível ou ter incorporação bloqueada. Tente outro link.'),
     onAutoplayBlocked:()=>setError('Seu navegador pediu um clique: use o botão de play do vídeo para liberar o áudio.')
    }
   });
  }).catch(e=>setError(errorText(e)));
  return()=>{active=false;player.current?.destroy();player.current=null;};
 },[enabled,localMuted,visible,state?.video_id]);
 useEffect(()=>{if(!ready)return;player.current?.setVolume(volume);if(deaf)player.current?.mute();else player.current?.unMute();},[ready,volume,deaf]);
 useEffect(()=>{sync();if(!ready)return;const timer=setInterval(sync,5000);return()=>clearInterval(timer);},[state,ready]);
 async function update(video:string|null,playing:boolean,position:number){setBusy(true);setError('');try{const{data,error}=await db.rpc('set_room_media',{room_channel:channelId,youtube_id:video,is_playing:playing,seek_seconds:Math.min(86399,Math.max(0,position)),expected_revision:state?.revision??null});if(error)throw error;setState(data);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 function submit(e:FormEvent){e.preventDefault();const id=youtubeId(link);if(!id){setError('Cole um link válido do YouTube ou youtu.be.');return;}void update(id,true,0);setLink('');}
 return <section className="music-panel" aria-label="Música compartilhada"><header><div><Music2 size={20}/><strong>DJ do lobby</strong></div><span className="tag">YouTube junto</span></header><p className="muted small">Você decide se quer ouvir. Silenciar aqui não muda a música para a galera.</p><form className="row" onSubmit={submit}><Link2 size={17}/><input type="url" aria-label="Link da música no YouTube" placeholder="https://youtu.be/…" value={link} onChange={e=>setLink(e.target.value)} required maxLength={2048}/><button disabled={busy} aria-label="Colocar música na sala"><Play size={17}/></button></form>
 {state?.video_id&&<><div className="music-track"><Music2 size={24}/><div><strong>{title||"Música compartilhada no YouTube"}</strong><small>{state.playing?"Tocando no lobby":"Pausada no lobby"} · <a href={`https://www.youtube.com/watch?v=${state.video_id}`} target="_blank" rel="noreferrer">Ver no YouTube</a></small></div></div><button aria-pressed={localMuted} onClick={()=>setLocalMuted(!localMuted)}>{localMuted?<Volume2 size={17}/>:<VolumeX size={17}/>} {localMuted?"Voltar a ouvir":"Não quero ouvir · só para mim"}</button><div className="music-actions"><button disabled={busy} onClick={()=>void update(state.video_id,!state.playing,player.current?.getCurrentTime()||musicPosition(state))}>{state.playing?<Pause size={16}/>:<Play size={16}/>} {state.playing?'Pausar pra todos':'Tocar pra todos'}</button><button onClick={sync} disabled={!ready} title="Sincronizar meu player"><RefreshCw size={16}/></button><button disabled={busy} onClick={()=>void update(null,false,0)} title="Remover música da sala"><X size={16}/></button></div>{(!enabled||localMuted)?<button className="primary" onClick={()=>{setLocalMuted(false);setEnabled(true);}}><Volume2 size={16}/>Ativar player e ouvir</button>:<><div className="youtube-player" ref={container}/><label className="volume-control"><Volume2 size={16}/>Meu volume<input type="range" min={0} max={100} value={volume} onChange={e=>setVolume(Number(e.target.value))}/><span>{volume}%</span></label><button className="link" onClick={()=>setEnabled(false)}>Desativar player neste dispositivo</button></>}</>}
 {!state?.video_id&&<div className="music-empty">Ainda sem trilha. O DJ está decidindo se é lo-fi ou abertura de anime.</div>}{error&&<p className="form-feedback" role="status">{error}</p>}<small>Modo leve por padrão: o vídeo só carrega ao ativar a escuta. Silenciar ou fechar o DJ descarrega o player neste dispositivo. O YouTube exige player visível durante a reprodução. Anúncios, restrições e bloqueios de reprodução podem variar por pessoa; não há extração de áudio nem promessa de sincronização exata.</small></section>;
}

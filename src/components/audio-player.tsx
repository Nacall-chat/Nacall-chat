'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Pause,Play,RotateCw} from 'lucide-react';
import {formatClock} from '@/lib/chat-media';
import {readMicPrefs} from '@/lib/mic';
import {useSignedUrl} from './use-signed-url';

let current:HTMLAudioElement|null=null; // só um áudio toca por vez

/** Player da mensagem de áudio: play/pause, barra com seek, tempo atual e duração total. O link é assinado e renovado sozinho. */
export function AudioPlayer({db,path,durationMs}:{db:SupabaseClient;path:string;durationMs:number}){
 const audio=useRef<HTMLAudioElement>(null);
 const fixing=useRef(false);
 const resume=useRef(0);
 const retried=useRef('');
 const{url,error:signError,retry}=useSignedUrl(db,'chat-audio',path);
 const[playing,setPlaying]=useState(false);
 const[time,setTime]=useState(0);
 const[broken,setBroken]=useState(false);
 useEffect(()=>{ // toca na saída de áudio escolhida na janela do microfone (onde o navegador permite)
  const el=audio.current as (HTMLAudioElement&{setSinkId?:(id:string)=>Promise<void>})|null;const out=readMicPrefs().outputId;
  if(el?.setSinkId&&out)void el.setSinkId(out).catch(()=>{});
 },[url]);
 const total=Math.max(durationMs/1000,0.1);
 const shown=Math.min(time,total);
 const failed=signError||broken;
 function toggle(){
  const el=audio.current;if(!el||!url)return;
  if(!el.paused){el.pause();return;}
  if(current&&current!==el)current.pause();
  current=el;
  void el.play().catch(()=>setBroken(true));
 }
 function seek(seconds:number){
  const el=audio.current;setTime(seconds);
  if(el&&url){try{el.currentTime=seconds;}catch{/* ainda sem metadados: vale no próximo play */}}
 }
 function reload(){setBroken(false);retried.current='';retry();}
 return <div className="audio-player" role="group" aria-label={`Mensagem de áudio de ${formatClock(durationMs)}`}>
  <audio ref={audio} src={url||undefined} preload="none"
   onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}
   onEnded={()=>{setPlaying(false);setTime(0);if(audio.current)audio.current.currentTime=0;}}
   onLoadedMetadata={e=>{ // gravações do navegador chegam sem duração (Infinity): ir ao fim e voltar faz o navegador medir o arquivo e liberar o seek
    const el=e.currentTarget;
    if(el.duration===Infinity){fixing.current=true;resume.current=el.currentTime;el.currentTime=1e7;}
   }}
   onTimeUpdate={e=>{
    const el=e.currentTarget;
    if(fixing.current){fixing.current=false;el.currentTime=resume.current;return;}
    setTime(el.currentTime);
   }}
   onError={()=>{ // link vencido ou arquivo ainda propagando: tenta um link novo uma vez
    if(retried.current!==url){retried.current=url;retry();}else setBroken(true);
   }}/>
  {failed?<button type="button" className="audio-play" aria-label="Tentar carregar o áudio de novo" onClick={reload}><RotateCw size={18}/></button>
   :<button type="button" className="audio-play primary" aria-label={playing?'Pausar áudio':'Ouvir áudio'} disabled={!url} onClick={toggle}>{playing?<Pause size={18} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}</button>}
  <div className="audio-body">
   {failed?<span className="audio-fail">Não foi possível carregar o áudio.</span>
    :<input className="audio-seek" type="range" min={0} max={total} step={0.05} value={shown} disabled={!url} aria-label="Posição do áudio" aria-valuetext={`${formatClock(shown*1000)} de ${formatClock(durationMs)}`} style={{'--p':`${Math.min(100,(shown/total)*100)}%`} as CSSProperties} onChange={e=>seek(Number(e.target.value))}/>}
   <span className="audio-time"><time>{formatClock(shown*1000)}</time> / <time>{formatClock(durationMs)}</time></span>
  </div>
 </div>;
}

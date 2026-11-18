'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {AUDIO_BITRATE,AUDIO_MAX_MS,pickAudioMime} from '@/lib/chat-media';

export type Recording={blob:Blob;ms:number};
export type RecorderPhase='idle'|'requesting'|'recording';
type Session={recorder:MediaRecorder;stream:MediaStream;chunks:Blob[];startedAt:number;endedMs:number;timer:number;raf:number;ctx:AudioContext|null;finished:Promise<Recording>|null;failure:Error|null};

export const recorderSupported=()=>typeof window!=='undefined'&&Boolean(navigator.mediaDevices?.getUserMedia)&&typeof MediaRecorder!=='undefined';

/** Traduz o erro do navegador em uma mensagem que diz o que fazer. */
export function microphoneError(error:unknown):Error{
 const name=error&&typeof error==='object'&&'name' in error?String(error.name):'';
 if(name==='NotAllowedError'||name==='SecurityError')return new Error('O navegador bloqueou o microfone. Libere a permissão no cadeado da barra de endereço e tente de novo.');
 if(name==='NotFoundError'||name==='OverconstrainedError')return new Error('Nenhum microfone foi encontrado neste dispositivo.');
 if(name==='NotReadableError'||name==='AbortError')return new Error('Não consegui abrir o microfone. Ele pode estar em uso por outro programa.');
 return new Error('Não foi possível iniciar a gravação. Tente de novo.');
}

/**
 * Grava áudio com MediaRecorder. `start` pede a permissão do microfone, `finish` encerra e devolve o arquivo,
 * `cancel` descarta tudo. Nada é enviado aqui: quem chama decide quando enviar.
 */
export function useAudioRecorder(){
 const[phase,setPhase]=useState<RecorderPhase>('idle');
 const[elapsed,setElapsed]=useState(0);
 const[levels,setLevels]=useState<number[]>([]);
 const[limitReached,setLimitReached]=useState(false);
 const session=useRef<Session|null>(null);
 const wantsCancel=useRef(false);

 const release=useCallback((s:Session)=>{
  window.clearInterval(s.timer);cancelAnimationFrame(s.raf);
  s.stream.getTracks().forEach(track=>track.stop());
  void s.ctx?.close().catch(()=>{});
 },[]);

 const finish=useCallback((): Promise<Recording>=>{
  const s=session.current;
  if(!s)return Promise.reject(new Error('Nenhuma gravação em andamento.'));
  s.finished??=new Promise<Recording>((resolve,reject)=>{
   s.endedMs||=Math.min(AUDIO_MAX_MS,Math.round(performance.now()-s.startedAt));
   const done=()=>{
    release(s);
    const blob=new Blob(s.chunks,{type:s.recorder.mimeType||'audio/webm'});
    if(s.failure&&!blob.size)reject(s.failure);else resolve({blob,ms:s.endedMs});
   };
   if(s.recorder.state==='inactive'){done();return;}
   s.recorder.onstop=done;
   try{s.recorder.stop();}catch{reject(new Error('Não foi possível encerrar a gravação.'));}
  });
  return s.finished;
 },[release]);

 const cancel=useCallback(()=>{
  wantsCancel.current=true;
  const s=session.current;
  if(s){
   s.recorder.ondataavailable=null;s.recorder.onstop=null;s.recorder.onerror=null;
   try{if(s.recorder.state!=='inactive')s.recorder.stop();}catch{/* já parou */}
   release(s);session.current=null;
  }
  setPhase('idle');setElapsed(0);setLevels([]);setLimitReached(false);
 },[release]);

 const start=useCallback(async()=>{
  if(session.current)return;
  if(!recorderSupported())throw new Error('Este navegador não suporta gravar áudio. Tente o Chrome, o Edge, o Firefox ou o Safari atualizados.');
  wantsCancel.current=false;
  setPhase('requesting');
  let stream:MediaStream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
  catch(error){setPhase('idle');throw microphoneError(error);}
  if(wantsCancel.current){stream.getTracks().forEach(track=>track.stop());return;}
  let recorder:MediaRecorder;
  try{
   const mimeType=pickAudioMime(type=>MediaRecorder.isTypeSupported(type));
   try{recorder=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),audioBitsPerSecond:AUDIO_BITRATE});}
   catch{recorder=new MediaRecorder(stream);}
  }catch{stream.getTracks().forEach(track=>track.stop());setPhase('idle');throw new Error('Este navegador não consegue gravar áudio.');}
  const s:Session={recorder,stream,chunks:[],startedAt:performance.now(),endedMs:0,timer:0,raf:0,ctx:null,finished:null,failure:null};
  recorder.ondataavailable=event=>{if(event.data.size)s.chunks.push(event.data);};
  recorder.onerror=()=>{s.failure=new Error('A gravação foi interrompida por um erro do navegador.');};
  try{recorder.start(1000);}
  catch{stream.getTracks().forEach(track=>track.stop());setPhase('idle');throw new Error('Não foi possível iniciar a gravação. Tente de novo.');}
  session.current=s;
  setElapsed(0);setLevels([]);setLimitReached(false);setPhase('recording');
  s.timer=window.setInterval(()=>{
   const ms=Math.min(AUDIO_MAX_MS,performance.now()-s.startedAt);
   setElapsed(ms);
   if(ms>=AUDIO_MAX_MS&&!s.finished){setLimitReached(true);void finish().catch(()=>{});}
  },200);
  try{ // medidor de nível: só enfeite, a gravação segue sem ele
   const Context=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
   if(Context){
    const ctx=new Context();const source=ctx.createMediaStreamSource(stream);const analyser=ctx.createAnalyser();analyser.fftSize=256;source.connect(analyser);s.ctx=ctx;
    const data=new Uint8Array(analyser.fftSize);let last=0;
    const tick=(time:number)=>{
     if(session.current!==s||s.finished)return;
     if(time-last>80){analyser.getByteTimeDomainData(data);let sum=0;for(const value of data){const d=(value-128)/128;sum+=d*d;}last=time;setLevels(previous=>[...previous.slice(-39),Math.min(1,Math.sqrt(sum/data.length)*3.4)]);}
     s.raf=requestAnimationFrame(tick);
    };
    s.raf=requestAnimationFrame(tick);
   }
  }catch{/* sem medidor */}
 },[finish]);

 useEffect(()=>()=>{ // trocar de conversa ou fechar a aba solta o microfone
  const s=session.current;
  if(s){s.recorder.ondataavailable=null;s.recorder.onstop=null;try{if(s.recorder.state!=='inactive')s.recorder.stop();}catch{/* já parou */}release(s);session.current=null;}
  wantsCancel.current=true;
 },[release]);

 return {phase,elapsed,levels,limitReached,start,finish,cancel};
}

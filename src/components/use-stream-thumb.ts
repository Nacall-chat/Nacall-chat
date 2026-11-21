'use client';
import {useEffect,useRef} from 'react';
import type {LocalParticipant} from 'livekit-client';
import {THUMB_ATTRIBUTE,THUMB_FIRST_MS,THUMB_INTERVAL_MS,THUMB_STEPS,thumbSize,thumbValue} from '@/lib/stream-thumb';

/** Um quadro do vídeo no menor tamanho que cabe no limite. Nulo se o vídeo ainda não tem imagem. */
function snapshot(video:HTMLVideoElement,canvas:HTMLCanvasElement,fromStep:number):string|null{
 const context=canvas.getContext('2d');
 if(!context||video.readyState<2)return null;
 for(let i=Math.min(fromStep,THUMB_STEPS.length-1);i<THUMB_STEPS.length;i++){
  const size=thumbSize(video.videoWidth,video.videoHeight,THUMB_STEPS[i]!.width);
  if(!size)return null;
  canvas.width=size.width;canvas.height=size.height;
  context.drawImage(video,0,0,size.width,size.height);
  const value=thumbValue(canvas.toDataURL('image/jpeg',THUMB_STEPS[i]!.quality));
  if(value)return value;
 }
 return null;
}

/** Quem transmite a tela publica, a cada poucos segundos, um quadro minúsculo da própria transmissão para a prévia dos
 * outros (o cartão "AO VIVO" antes de clicar em Assistir). Só roda enquanto transmite E há alguém na sala que não está
 * assistindo; o quadro some do atributo quando a transmissão acaba. Nada é gravado, só fica na memória da call. */
export function useStreamThumbPublisher({participant,track,wanted,connected}:{participant:LocalParticipant;track:MediaStreamTrack|undefined;wanted:boolean;connected:boolean}){
 const step=useRef(0);
 const sharing=Boolean(track);
 useEffect(()=>{
  if(!track||!wanted||!connected)return;
  step.current=0;
  const video=document.createElement('video');
  video.muted=true;video.playsInline=true;video.srcObject=new MediaStream([track]);
  // Fora da tela mas dentro da página: alguns navegadores não decodificam vídeo que não está no documento.
  video.setAttribute('aria-hidden','true');
  Object.assign(video.style,{position:'fixed',left:'-9999px',top:'0',width:'2px',height:'2px',opacity:'0',pointerEvents:'none'});
  document.body.appendChild(video);
  void video.play().catch(()=>{});
  const canvas=document.createElement('canvas');
  let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;
  const tick=()=>{
   if(stopped)return;
   const value=snapshot(video,canvas,step.current);
   const next=()=>{if(!stopped)timer=setTimeout(tick,THUMB_INTERVAL_MS);};
   if(!value){timer=setTimeout(tick,THUMB_FIRST_MS);return;}
   // Se o servidor recusar (limite de tamanho), as próximas tentativas já saem mais leves.
   participant.setAttributes({[THUMB_ATTRIBUTE]:value}).catch(()=>{step.current=Math.min(step.current+1,THUMB_STEPS.length-1);}).finally(next);
  };
  timer=setTimeout(tick,THUMB_FIRST_MS);
  return()=>{stopped=true;if(timer)clearTimeout(timer);video.pause();video.srcObject=null;video.remove();};
 },[participant,track,wanted,connected]);
 // A prévia vive só enquanto a transmissão existe.
 useEffect(()=>{
  if(sharing||!connected||!participant.attributes[THUMB_ATTRIBUTE])return;
  void participant.setAttributes({[THUMB_ATTRIBUTE]:''}).catch(()=>{});
 },[sharing,connected,participant]);
}

'use client';
import {useEffect,useRef,useState} from 'react';
import {Eye,Loader2,MonitorUp} from 'lucide-react';
import {LiveBadge} from './live-badge';
import {viewersLabel} from '@/lib/stream';

/** Depois disso sem receber nenhum quadro, o cartão deixa de dizer "carregando" (quem transmite pode estar numa versão sem prévia). */
const WAIT_MS=12_000;

/** Cartão da transmissão de outra pessoa na grade da call: mesmo tamanho, proporção (16:9) e ordem dos cartões dos
 * participantes, com a última imagem da tela como prévia. O cartão inteiro é o botão de assistir. */
/** A sua própria tela, ao vivo e sem som, direto da faixa que já está no seu navegador (não gera nem envia nada). */
function LocalPreview({track}:{track:MediaStreamTrack}){
 const ref=useRef<HTMLVideoElement>(null);
 useEffect(()=>{const video=ref.current;if(!video)return;video.srcObject=new MediaStream([track]);void video.play().catch(()=>{});return()=>{video.srcObject=null;};},[track]);
 return <video ref={ref} muted playsInline autoPlay aria-hidden="true"/>;
}

export function StreamTile({name,isLocal,thumb,viewers,onWatch,localTrack}:{name:string;isLocal:boolean;thumb:string|null;viewers:number;onWatch:()=>void;localTrack?:MediaStreamTrack}){
 const[waited,setWaited]=useState(false);
 useEffect(()=>{if(thumb)return;const timer=setTimeout(()=>setWaited(true),WAIT_MS);return()=>clearTimeout(timer);},[thumb]);
 const action=isLocal?'Ver a prévia da sua transmissão':`Assistir à transmissão de ${name}`;
 const count=viewersLabel(viewers);
 return <article className="participant stream-tile">
  <button type="button" className="stream-tile-view" aria-label={`${action}. ${count}.`} title={action} onClick={onWatch}>
   {thumb?<img src={thumb} alt="" draggable={false}/>:isLocal&&localTrack?<LocalPreview track={localTrack}/>:<span className="stream-tile-wait" role="status">{waited?<><MonitorUp size={22} aria-hidden="true"/>Sem prévia</>:<><Loader2 size={20} className="spin" aria-hidden="true"/>Carregando prévia…</>}</span>}
   <span className="stream-tile-top"><LiveBadge/></span>
   <span className="stream-tile-cta"><Eye size={14} aria-hidden="true"/>{isLocal?'Ver prévia':'Assistir'}</span>
  </button>
  <div className="participant-label"><span><strong>{isLocal?'Você':name}</strong><small>transmitindo a tela</small></span><span className="participant-state stream-tile-viewers" title={count}><Eye size={13} aria-hidden="true"/>{count}</span></div>
 </article>;
}

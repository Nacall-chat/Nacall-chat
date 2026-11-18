'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowRight,Clock,Flag,Hand,Heart,ImagePlus,Lightbulb,Mic,Pause,PawPrint,Pencil,Play,Plane,RotateCw,Search,Smile,Star,Trash2,Trophy,Upload,Utensils,X} from 'lucide-react';
import {clampSlide,nextLabel,whatsNewKey,whatsNewSlides,type WhatsNewSlide} from '@/lib/novidades';

const seenNow=new Set<string>(); // se o navegador não guarda dados, vale ao menos até recarregar
function alreadySeen(key:string){try{return localStorage.getItem(key)==='1'||seenNow.has(key);}catch{return seenNow.has(key);}}
function markSeen(key:string){seenNow.add(key);try{localStorage.setItem(key,'1');}catch{/* sem armazenamento */}}

/* Miniaturas das telas, desenhadas com as mesmas cores e classes do chat para acompanhar o tema escolhido. */
const Btn=({children,primary=false}:{children:ReactNode;primary?:boolean})=><span className={`wn-btn ${primary?'primary':''}`} aria-hidden="true">{children}</span>;
const bars=[.25,.4,.3,.6,.85,.5,.7,.35,.55,.9,.45,.3,.6,.4,.25,.5,.75,.35,.2,.4];
const sampleEmojis=['😀','😂','🥹','😍','😎','🤩','🥳','😴','🤔','😅','🙌','🔥','🎉','💜','🐱','🍕'];
const sampleStickers=[['😎','#fbbf24'],['🥳','#f472b6'],['😂','#60a5fa'],['🔥','#fb923c'],['🐱','#a78bfa'],['💜','#34d399'],['🤩','#f87171'],['😴','#818cf8'],['🎉','#2dd4bf'],['👍','#facc15']] as const;

function Visual({id}:{id:WhatsNewSlide['id']}){
 if(id==='barra')return <div className="wn-screen"><div className="wn-composer">
  <Btn><Smile size={20}/></Btn><span className="wn-input">Conversar em chat-geral…</span><Btn><Mic size={19}/></Btn><Btn primary><ArrowRight size={19}/></Btn></div>
  <ol className="wn-legend"><li><b>1</b> Emojis e figurinhas</li><li><b>2</b> Mensagem</li><li><b>3</b> Gravar áudio</li><li><b>4</b> Enviar</li></ol></div>;
 if(id==='audio')return <div className="wn-screen">
  <div className="wn-composer"><Btn><Trash2 size={19}/></Btn><span className="wn-rec"><i className="wn-dot"/><b>0:07</b><span className="wn-wave">{bars.map((h,i)=><i key={i} style={{height:`${h*100}%`}}/>)}</span></span><Btn primary><ArrowRight size={19}/></Btn></div>
  <div className="wn-bubble"><div className="audio-player wn-player"><span className="audio-play primary wn-btn" aria-hidden="true"><Play size={17} fill="currentColor"/></span>
   <div className="audio-body"><span className="wn-seek"><i/></span><span className="audio-time">0:03 / 0:07</span></div></div></div></div>;
 if(id==='emojis')return <div className="wn-screen"><div className="wn-picker">
  <div className="wn-tabs"><span className="selected">Emojis</span><span>Figurinhas</span></div>
  <div className="wn-search"><Search size={14}/> coração</div>
  <div className="wn-cats">{[Clock,Smile,Hand,PawPrint,Utensils,Trophy,Plane,Lightbulb,Heart,Flag].map((Icon,i)=><span key={i} className={i===1?'selected':''}><Icon size={15}/></span>)}</div>
  <div className="wn-emojis">{sampleEmojis.map(e=><span key={e}>{e}</span>)}</div></div></div>;
 if(id==='figurinhas')return <div className="wn-screen"><div className="wn-picker small">
  <div className="wn-tabs"><span>Emojis</span><span className="selected">Figurinhas</span></div>
  <div className="wn-toolbar"><small>10/200 figurinhas</small><span><Btn><Upload size={13}/></Btn><Btn><ImagePlus size={13}/></Btn><Btn><Pencil size={13}/></Btn></span></div>
  <div className="wn-stickers">{sampleStickers.map(([e,c],i)=><span key={e} style={{background:c}}>{e}{i===0&&<Star size={11} fill="currentColor" className="wn-star"/>}</span>)}</div></div></div>;
 return <div className="wn-screen"><div className="wn-editor">
  <div className="wn-canvas"><span className="wn-art">😎</span></div>
  <div className="wn-controls"><span className="wn-slider"><i/></span><div className="wn-seg"><span className="selected">Preencher</span><span>Inteira</span><span><RotateCw size={12}/></span></div>
   <div className="wn-seg"><span>Quadrado</span><span>Arredondado</span><span className="selected">Círculo</span></div><span className="wn-check"><i/> Remover fundo liso</span></div></div></div>;
}

/** Janela de novidades: carrossel com X no topo, Voltar e Próximo (que vira Fechar no último passo). Aparece uma vez por conta. */
export function WhatsNew({userId}:{userId:string}){
 const key=whatsNewKey(userId);
 const[open,setOpen]=useState(false);
 const[index,setIndex]=useState(0);
 const dialog=useRef<HTMLDivElement>(null);
 const total=whatsNewSlides.length;
 const last=index===total-1;
 useEffect(()=>{if(!alreadySeen(key))setOpen(true);},[key]);
 useEffect(()=>{const reopen=()=>{setIndex(0);setOpen(true);};window.addEventListener('nacall-open-novidades',reopen);return()=>window.removeEventListener('nacall-open-novidades',reopen);},[]); // botão "Ver novidades" do sino
 const close=()=>{markSeen(key);setOpen(false);};
 const go=(to:number)=>setIndex(clampSlide(to,total));
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null;
  dialog.current?.querySelector<HTMLElement>('[data-next]')?.focus();
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();markSeen(key);setOpen(false);}
   else if(e.key==='ArrowRight'){e.preventDefault();setIndex(i=>clampSlide(i+1,total));}
   else if(e.key==='ArrowLeft'){e.preventDefault();setIndex(i=>clampSlide(i-1,total));}
   else if(e.key==='Tab'){ // mantém o foco dentro da janela
    const items=[...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled])')??[])];
    if(!items.length)return;
    const first=items[0],end=items[items.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}
    else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}
   }
  };
  document.addEventListener('keydown',onKey);
  return()=>{document.removeEventListener('keydown',onKey);previous?.focus?.();};
 },[open,key,total]);
 if(!open)return null;
 const slide=whatsNewSlides[index];
 return createPortal(<div className="whatsnew-overlay" role="presentation" onPointerDown={e=>{if(e.target===e.currentTarget)close();}}>
  <div className="whatsnew" role="dialog" aria-modal="true" aria-labelledby="whatsnew-title" ref={dialog}>
   <header className="whatsnew-head"><span className="eyebrow">NOVIDADES · {index+1} DE {total}</span>
    <button type="button" className="icon-button whatsnew-x" aria-label="Fechar novidades" onClick={close}><X size={19}/></button></header>
   <div className="whatsnew-slide" key={slide.id} aria-live="polite">
    <div className="whatsnew-visual"><Visual id={slide.id}/></div>
    <h2 id="whatsnew-title">{slide.title}</h2>
    <p className="muted">{slide.text}</p>
    <ul>{slide.points.map(p=><li key={p}>{p}</li>)}</ul>
   </div>
   <footer className="whatsnew-foot">
    <button type="button" disabled={index===0} onClick={()=>go(index-1)}><ArrowLeft size={16}/>Voltar</button>
    <div className="whatsnew-dots" role="group" aria-label="Ir para uma novidade">{whatsNewSlides.map((s,i)=><button type="button" key={s.id} className={i===index?'on':''} aria-label={`Novidade ${i+1}: ${s.title}`} aria-current={i===index} onClick={()=>go(i)}/>)}</div>
    <button type="button" className="primary" data-next onClick={()=>last?close():go(index+1)}>{nextLabel(index,total)}{!last&&<ArrowRight size={16}/>}</button>
   </footer>
  </div>
 </div>,document.body);
}

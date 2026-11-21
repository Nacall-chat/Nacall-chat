'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Keyboard,RotateCcw} from 'lucide-react';
import {DEFAULT_PTT_KEY,isDefaultPttKey,validatePttKey} from '@/lib/ptt-key';
import {usePreferences} from './preferences';

type Message={tone:'error'|'warn'|'ok';text:string};

/** Campo "pressione a tecla" do apertar para falar: captura a próxima tecla, mostra o nome dela, deixa trocar e voltar ao padrão.
 * Enquanto captura, a tecla é consumida aqui (nada dispara por baixo) e o Esc só cancela. */
export function PttKeyField(){
 const{voice,setVoice}=usePreferences();
 const key=voice.pushToTalkKey;
 const[capturing,setCapturing]=useState(false);
 const[message,setMessage]=useState<Message|null>(null);
 const button=useRef<HTMLButtonElement>(null);
 const messageId=useId();
 useEffect(()=>{
  if(!capturing)return;
  // Fase de captura, antes de qualquer outro atalho da página.
  const onKey=(e:KeyboardEvent)=>{
   e.preventDefault();e.stopImmediatePropagation();
   if(e.repeat)return;
   if(e.code==='Escape'){setCapturing(false);setMessage(null);return;}
   const result=validatePttKey(e);
   if(!result.ok){setMessage({tone:'error',text:result.reason});return;}
   setVoice({pushToTalkKey:result.key});
   setCapturing(false);
   setMessage(result.warning?{tone:'warn',text:result.warning}:{tone:'ok',text:`Pronto: agora é a tecla ${result.key.label}.`});
  };
  const swallow=(e:KeyboardEvent)=>{e.preventDefault();e.stopImmediatePropagation();};
  window.addEventListener('keydown',onKey,true);window.addEventListener('keyup',swallow,true);
  return()=>{window.removeEventListener('keydown',onKey,true);window.removeEventListener('keyup',swallow,true);};
 },[capturing,setVoice]);
 const start=()=>{setMessage(null);setCapturing(true);button.current?.focus();};
 const reset=()=>{setVoice({pushToTalkKey:{...DEFAULT_PTT_KEY}});setCapturing(false);setMessage({tone:'ok',text:`Voltou ao padrão: tecla ${DEFAULT_PTT_KEY.label}.`});};
 return <div className="ptt-key-field">
  <div className="ptt-key-row">
   <span className="ptt-key-name"><Keyboard size={15} aria-hidden="true"/>Tecla de apertar para falar</span>
   <button ref={button} type="button" className={`ptt-key-button ${capturing?'capturing':''}`} aria-describedby={messageId} onClick={()=>capturing?setCapturing(false):start()} onBlur={()=>setCapturing(false)}>
    {capturing?'Pressione uma tecla… (Esc cancela)':<><kbd>{key.label}</kbd>Trocar tecla</>}
   </button>
   {!isDefaultPttKey(key)&&<button type="button" className="ptt-key-reset" onClick={reset}><RotateCcw size={13} aria-hidden="true"/>Voltar ao padrão ({DEFAULT_PTT_KEY.label})</button>}
  </div>
  <p id={messageId} className={`ptt-key-message ${message?.tone??''}`} role={message?.tone==='error'?'alert':'status'}>{capturing&&!message?'Aperte a tecla que quer usar. Letras, números, setas, teclas F e do teclado numérico funcionam.':message?.text??''}</p>
 </div>;
}

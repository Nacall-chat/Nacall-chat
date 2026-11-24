'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Keyboard,X} from 'lucide-react';
import {checkBind,type BindName} from '@/lib/voice-binds';
import {usePreferences} from './preferences';

type Message={tone:'error'|'warn'|'ok';text:string};

/** Campo de um atalho opcional da call (microfone ou fone): captura a próxima tecla, recusa as problemáticas e as já usadas
 * por outro atalho, e deixa remover. Enquanto captura, a tecla é consumida aqui (nada dispara por baixo) e o Esc só cancela. */
export function KeybindField({name,label}:{name:'muteKey'|'deafenKey';label:string}){
 const{voice,setVoice}=usePreferences();
 const key=voice[name];
 const[capturing,setCapturing]=useState(false);
 const[message,setMessage]=useState<Message|null>(null);
 const button=useRef<HTMLButtonElement>(null);
 const messageId=useId();
 useEffect(()=>{
  if(!capturing)return;
  const onKey=(e:KeyboardEvent)=>{
   e.preventDefault();e.stopImmediatePropagation();
   if(e.repeat)return;
   if(e.code==='Escape'){setCapturing(false);setMessage(null);return;}
   const binds:Partial<Record<BindName,typeof key>>={pushToTalkKey:voice.pushToTalk?voice.pushToTalkKey:null,muteKey:voice.muteKey,deafenKey:voice.deafenKey};
   const result=checkBind(e,name,binds);
   if(!result.ok){setMessage({tone:'error',text:result.reason});return;}
   setVoice({[name]:result.key});
   setCapturing(false);
   setMessage(result.warning?{tone:'warn',text:result.warning}:{tone:'ok',text:`Pronto: ${label.split(' (')[0].toLowerCase()} na tecla ${result.key.label}.`});
  };
  const swallow=(e:KeyboardEvent)=>{e.preventDefault();e.stopImmediatePropagation();};
  window.addEventListener('keydown',onKey,true);window.addEventListener('keyup',swallow,true);
  return()=>{window.removeEventListener('keydown',onKey,true);window.removeEventListener('keyup',swallow,true);};
 },[capturing,setVoice,name,label,voice.pushToTalk,voice.pushToTalkKey,voice.muteKey,voice.deafenKey]);
 const start=()=>{setMessage(null);setCapturing(true);button.current?.focus();};
 const clear=()=>{setVoice({[name]:null});setCapturing(false);setMessage({tone:'ok',text:'Atalho removido.'});};
 return <div className="ptt-key-field">
  <div className="ptt-key-row">
   <span className="ptt-key-name"><Keyboard size={15} aria-hidden="true"/>{label}</span>
   <button ref={button} type="button" className={`ptt-key-button ${capturing?'capturing':''}`} aria-describedby={messageId} onClick={()=>capturing?setCapturing(false):start()} onBlur={()=>setCapturing(false)}>
    {capturing?'Pressione uma tecla… (Esc cancela)':key?<><kbd>{key.label}</kbd>Trocar tecla</>:'Escolher tecla'}
   </button>
   {key&&<button type="button" className="ptt-key-reset" onClick={clear}><X size={13} aria-hidden="true"/>Remover atalho</button>}
  </div>
  <p id={messageId} className={`ptt-key-message ${message?.tone??''}`} role={message?.tone==='error'?'alert':'status'}>{capturing&&!message?'Aperte a tecla que quer usar. Letras, números, setas, teclas F e do teclado numérico funcionam.':message?.text??''}</p>
 </div>;
}

/** Os dois atalhos opcionais da call. Só fazem sentido com teclado físico. */
export function VoiceShortcuts(){
 return <div className="voice-shortcuts">
  <KeybindField name="muteKey" label="Atalho do microfone"/>
  <KeybindField name="deafenKey" label="Atalho do fone (também fecha o microfone)"/>
 </div>;
}

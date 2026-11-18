'use client';
import {useEffect,useLayoutEffect,useRef,useState,type FormEvent} from 'react';
import dynamic from 'next/dynamic';
import type {SupabaseClient} from '@supabase/supabase-js';
import {ArrowRight,Loader2,Mic,RotateCw,Smile,Trash2} from 'lucide-react';
import {AUDIO_MIN_MS,addSticker,formatClock,insertAtCursor,prepareSticker} from '@/lib/chat-media';
import type {Sticker} from '@/lib/types';
import {errorText} from '@/lib/validation';
import {recorderSupported,useAudioRecorder,type Recording} from './use-audio-recorder';
const ChatPicker=dynamic(()=>import('./chat-picker').then(m=>m.ChatPicker),{ssr:false});
const StickerEditor=dynamic(()=>import('./sticker-editor').then(m=>m.StickerEditor),{ssr:false});

type Props={db:SupabaseClient;placeholder:string;value:string;setValue:(value:string)=>void;busy:boolean;onSubmit:(e:FormEvent)=>void;sendAudio:(recording:Recording)=>Promise<void>;sendSticker:(sticker:Sticker)=>Promise<void>;report:(text:string)=>void};

/** Barra de envio: emojis/figurinhas · campo de texto · microfone · enviar. Gravar áudio troca a barra pela interface de gravação. */
export function Composer({db,placeholder,value,setValue,busy,onSubmit,sendAudio,sendSticker,report}:Props){
 const wrap=useRef<HTMLDivElement>(null);
 const input=useRef<HTMLInputElement>(null);
 const selection=useRef<{start:number;end:number}|null>(null);
 const latest=useRef(value);latest.current=value;
 const pendingCursor=useRef<number|null>(null);
 useLayoutEffect(()=>{ // depois que o React grava o novo texto, devolve o cursor para logo depois do emoji
  const el=input.current,at=pendingCursor.current;
  if(!el||at===null)return;
  pendingCursor.current=null;
  if(window.matchMedia('(pointer:fine)').matches)el.focus({preventScroll:true});
  try{el.setSelectionRange(at,at);}catch{/* campo sem foco */}
 });
 const[open,setOpen]=useState(false);
 const[editor,setEditor]=useState(false);
 const[stickersVersion,setStickersVersion]=useState(0);
 const[sending,setSending]=useState(false);
 const[draft,setDraft]=useState<Recording|null>(null);
 const recorder=useAudioRecorder();
 const[supported,setSupported]=useState(true);
 useEffect(()=>setSupported(recorderSupported()),[]);

 useEffect(()=>{ // o painel fecha com Esc ou ao tocar fora, mas não ao escolher itens
  if(!open)return;
  const outside=(e:PointerEvent)=>{const target=e.target as HTMLElement|null;if(!target||wrap.current?.contains(target)||target.closest('.sticker-editor-overlay'))return;setOpen(false);};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);input.current?.focus({preventScroll:true});}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};
 },[open]);

 const remember=()=>{const el=input.current;if(el)selection.current={start:el.selectionStart??el.value.length,end:el.selectionEnd??el.value.length};};
 function addEmoji(emoji:string){
  const where=selection.current??{start:null,end:null};
  const result=insertAtCursor(latest.current,where.start,where.end,emoji);
  if(!result.inserted){report('Limite de 4.000 caracteres por mensagem.');return;}
  latest.current=result.value;selection.current={start:result.cursor,end:result.cursor};setValue(result.value);
  pendingCursor.current=result.cursor;
 }
 async function pickSticker(sticker:Sticker){
  if(sending)return;setSending(true);
  try{await sendSticker(sticker);setOpen(false);}catch(e){report(errorText(e));}finally{setSending(false);}
 }
 async function saveCreated(blob:Blob){
  await addSticker(db,await prepareSticker(blob));
  setStickersVersion(v=>v+1);report('Figurinha salva na sua coleção.');
 }

 async function startRecording(){
  setOpen(false);setDraft(null);
  try{await recorder.start();}catch(e){report(errorText(e));}
 }
 async function sendRecording(){
  if(sending)return;
  if(!draft&&recorder.phase==='recording'&&recorder.elapsed<AUDIO_MIN_MS){report('Áudio muito curto. Segure um pouco mais antes de enviar.');return;}
  setSending(true);
  try{
   const recording=draft??await recorder.finish();
   setDraft(recording);
   await sendAudio(recording);
   setDraft(null);recorder.cancel();
  }catch(e){report(errorText(e));/* a gravação fica guardada para tentar de novo */ if(recorder.phase!=='idle')recorder.cancel();}
  finally{setSending(false);}
 }
 function discard(){setDraft(null);recorder.cancel();}

 const recordingUi=recorder.phase!=='idle'||draft;
 return <div className="composer-wrap" ref={wrap}>
  {open&&!recordingUi&&<ChatPicker db={db} onEmoji={addEmoji} onSticker={pickSticker} createSticker={()=>setEditor(true)} stickersVersion={stickersVersion} stickerSending={sending||busy} report={report} close={()=>setOpen(false)}/>}
  {editor&&<StickerEditor onClose={()=>setEditor(false)} onSave={saveCreated}/>}
  <form className="composer" onSubmit={onSubmit}>
  {recordingUi?<div className="cmp-recorder" role="group" aria-label="Gravação de áudio">
    {draft&&!sending&&recorder.phase==='idle'?<>
     <button type="button" className="cmp-btn cmp-cancel" aria-label="Descartar áudio" onClick={discard}><Trash2 size={20}/></button>
     <div className="cmp-rec-status" role="alert"><span className="cmp-fail">Áudio de {formatClock(draft.ms)} não enviado.</span></div>
     <button type="button" className="cmp-btn cmp-send primary" aria-label="Tentar enviar o áudio de novo" onClick={()=>void sendRecording()}><RotateCw size={19}/></button>
    </>:<>
     <button type="button" className="cmp-btn cmp-cancel" aria-label="Cancelar gravação" disabled={sending} onClick={discard}><Trash2 size={20}/></button>
     <div className="cmp-rec-status" role="status">
      {recorder.phase==='requesting'?<span className="cmp-wait">Permita o microfone no navegador…</span>:<>
       <span className="cmp-rec-dot" aria-hidden="true"/>
       <time className="cmp-rec-time" role="timer" aria-live="off">{formatClock(draft?draft.ms:recorder.elapsed)}</time>
       <span className="cmp-wave" aria-hidden="true">{recorder.levels.map((level,i)=><i key={i} style={{height:`${Math.max(8,Math.round(level*100))}%`}}/>)}</span>
       {recorder.limitReached&&<span className="small muted">Limite de 5 min</span>}</>}
     </div>
     <button type="button" className="cmp-btn cmp-send primary" aria-label="Concluir e enviar áudio" disabled={sending||recorder.phase==='requesting'} onClick={()=>void sendRecording()}>{sending?<Loader2 size={19} className="spin"/>:<ArrowRight size={20}/>}</button>
    </>}
   </div>
  :<>
   <button type="button" className="cmp-btn cmp-emoji" aria-label="Emojis e figurinhas" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{remember();setOpen(v=>!v);}}><Smile size={22}/></button>
   <input ref={input} className="cmp-input" aria-label="Mensagem" placeholder={placeholder} maxLength={4000} required value={value} onChange={e=>{setValue(e.target.value);remember();}} onSelect={remember} onKeyUp={remember} onClick={remember} onBlur={remember}/>
   <button type="button" className="cmp-btn cmp-mic" aria-label="Gravar mensagem de áudio" title={supported?'Gravar mensagem de áudio':'Este navegador não suporta gravar áudio'} disabled={busy||!supported} onClick={()=>void startRecording()}><Mic size={21}/></button>
   <button className="cmp-btn cmp-send primary" aria-label="Enviar mensagem" disabled={busy||!value.trim()}><ArrowRight size={20}/></button>
  </>}
  </form>
 </div>;
}

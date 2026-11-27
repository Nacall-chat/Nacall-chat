'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Copy,CornerUpLeft,MoreHorizontal,SmilePlus,X} from 'lucide-react';
import type {Message} from '@/lib/types';
import {QUICK_REACTIONS,groupReactions,replySnippet,type Reaction} from '@/lib/message-extras';

/** Reações das mensagens carregadas: busca, tempo real (a tabela é pequena; o filtro por id fica no cliente) e marcar/desmarcar. */
export function useReactions(db:SupabaseClient,messageIds:string[],me:string,report:(s:string)=>void){
 const[rows,setRows]=useState<Reaction[]>([]);
 const key=messageIds.join(',');
 const ids=useRef<Set<string>>(new Set());
 useEffect(()=>{ids.current=new Set(messageIds);},[key]);// eslint-disable-line react-hooks/exhaustive-deps
 const fetchAll=useCallback(async()=>{
  const list=[...ids.current];if(!list.length){setRows([]);return;}
  const{data,error}=await db.from('message_reactions').select('message_id,user_id,emoji').in('message_id',list.slice(-200));
  if(!error)setRows((data??[]) as Reaction[]);
 },[db]);
 useEffect(()=>{void fetchAll();},[key,fetchAll]);
 useEffect(()=>{
  const sub=db.channel(`reactions-${me}`).on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},payload=>{
   const row=(payload.new&&Object.keys(payload.new).length?payload.new:payload.old) as Partial<Reaction>;
   if(row.message_id&&ids.current.has(row.message_id))void fetchAll();
  }).subscribe();
  return()=>{void db.removeChannel(sub);};
 },[db,me,fetchAll]);
 const byMessage=useMemo(()=>groupReactions(rows,me),[rows,me]);
 async function toggle(messageId:string,emoji:string){
  const mine=rows.some(r=>r.message_id===messageId&&r.user_id===me&&r.emoji===emoji);
  // otimista: a interface responde na hora e o tempo real confirma
  setRows(prev=>mine?prev.filter(r=>!(r.message_id===messageId&&r.user_id===me&&r.emoji===emoji)):[...prev,{message_id:messageId,user_id:me,emoji}]);
  const{error}=mine
   ?await db.from('message_reactions').delete().eq('message_id',messageId).eq('user_id',me).eq('emoji',emoji)
   :await db.from('message_reactions').insert({message_id:messageId,emoji});
  if(error){report(error.message.includes('demais')||error.message.includes('bastante')?error.message:'Não deu para reagir agora. Tente de novo.');void fetchAll();}
 }
 return{byMessage,toggle};
}

/** Chips de reação embaixo do balão: emoji, quantidade e destaque quando você reagiu. */
export function ReactionBar({items,onToggle}:{items:ReturnType<typeof groupReactions>[string]|undefined;onToggle:(emoji:string)=>void}){
 if(!items?.length)return null;
 return <div className="reaction-bar">{items.map(r=><button type="button" key={r.emoji} className={`reaction-chip ${r.mine?'mine':''}`} aria-pressed={r.mine} aria-label={`${r.emoji} ${r.count} ${r.count===1?'reação':'reações'}${r.mine?', inclusive a sua':''}`} onClick={()=>onToggle(r.emoji)}><span aria-hidden="true">{r.emoji}</span><b>{r.count}</b></button>)}</div>;
}

/** Ações da mensagem: no computador aparecem ao passar o mouse; no toque, pelo botão "mais". */
export function MessageActions({canCopy,onReply,onReact,onCopy}:{canCopy:boolean;onReply:()=>void;onReact:(emoji:string)=>void;onCopy:()=>void}){
 const[open,setOpen]=useState(false);const[picking,setPicking]=useState(false);
 const close=()=>{setOpen(false);setPicking(false);};
 return <div className={`msg-actions ${open?'open':''}`} onMouseLeave={()=>setPicking(false)}>
  <button type="button" className="msg-actions-more" aria-label="Ações da mensagem" aria-expanded={open} onClick={()=>setOpen(o=>!o)}><MoreHorizontal size={16}/></button>
  <div className="msg-actions-bar" role="toolbar" aria-label="Ações da mensagem">
   {picking?<>{QUICK_REACTIONS.map(e=><button type="button" key={e} className="msg-react" aria-label={`Reagir com ${e}`} onClick={()=>{onReact(e);close();}}>{e}</button>)}<button type="button" aria-label="Fechar reações" onClick={()=>setPicking(false)}><X size={15}/></button></>
   :<><button type="button" aria-label="Reagir" title="Reagir" onClick={()=>setPicking(true)}><SmilePlus size={16}/></button><button type="button" aria-label="Responder" title="Responder" onClick={()=>{onReply();close();}}><CornerUpLeft size={16}/></button>{canCopy&&<button type="button" aria-label="Copiar texto" title="Copiar texto" onClick={()=>{onCopy();close();}}><Copy size={15}/></button>}</>}
  </div>
 </div>;
}

/** Citação dentro da resposta: quem escreveu e um trecho; tocar leva até a original, se ela estiver carregada. */
export function ReplyQuote({original,author,onJump}:{original?:Message;author:string;onJump:()=>void}){
 return <button type="button" className="reply-quote" onClick={onJump} aria-label={original?`Respondendo a ${author}: ${replySnippet(original)}. Ir para a mensagem`:'Respondendo a uma mensagem anterior'}>
  <CornerUpLeft size={13} aria-hidden="true"/><strong>{original?author:'Mensagem'}</strong><span>{original?replySnippet(original):'anterior ou apagada'}</span>
 </button>;
}

/** Barra acima do campo de digitar enquanto você responde. Esc cancela. */
export function ReplyBar({original,author,onCancel}:{original:Message;author:string;onCancel:()=>void}){
 useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')onCancel();};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc);},[onCancel]);
 return <div className="reply-bar" role="status"><CornerUpLeft size={15} aria-hidden="true"/><span>Respondendo a <strong>{author}</strong>: {replySnippet(original)}</span><button type="button" aria-label="Cancelar resposta" onClick={onCancel}><X size={16}/></button></div>;
}

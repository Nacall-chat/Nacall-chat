'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {ArrowLeft,ArrowRight,ImagePlus,Pencil,Star,Trash2,Upload} from 'lucide-react';
import {STICKER_LIMIT,addSticker,prepareSticker} from '@/lib/chat-media';
import type {Sticker} from '@/lib/types';
import {errorText} from '@/lib/validation';
import {StickerImage} from './message-content';

/** Aba "Figurinhas": coleção pessoal (listar, importar, criar, favoritar, reordenar, excluir) e envio com um toque. */
export function StickerPanel({db,version,create,send,report,sending}:{db:SupabaseClient;version:number;create:()=>void;send:(sticker:Sticker)=>void;report:(text:string)=>void;sending:boolean}){
 const[items,setItems]=useState<Sticker[]|null>(null);
 const[organize,setOrganize]=useState(false);
 const[working,setWorking]=useState('');
 const[confirming,setConfirming]=useState('');
 const file=useRef<HTMLInputElement>(null);

 const load=useCallback(async()=>{
  const {data,error}=await db.from('stickers').select('*').order('favorite',{ascending:false}).order('position',{ascending:true});
  if(error){report(errorText(error));setItems(current=>current??[]);return;}
  setItems((data??[]) as Sticker[]);
 },[db,report]);
 useEffect(()=>{void load();},[load,version]);

 async function importFiles(list:FileList|null){
  const files=[...(list??[])];if(!files.length)return;
  const room=STICKER_LIMIT-(items?.length??0);
  if(room<=0){report('Sua coleção chegou ao limite de 200 figurinhas. Exclua alguma para adicionar outra.');return;}
  let done=0;const failures:string[]=[];
  for(const [index,source] of files.slice(0,room).entries()){
   setWorking(`Importando ${index+1} de ${Math.min(files.length,room)}…`);
   try{await addSticker(db,await prepareSticker(source));done++;}
   catch(e){failures.push(`${source.name.slice(0,30)}: ${errorText(e)}`);}
  }
  setWorking('');
  if(files.length>room)failures.push(`${files.length-room} arquivo(s) ficaram de fora: limite de ${STICKER_LIMIT} figurinhas.`);
  report(failures.length?`${done?`${done} importada(s). `:''}Não deu para importar: ${failures.join(' · ')}`:`${done} figurinha(s) importada(s).`);
  await load();
 }
 async function toggleFavorite(item:Sticker){
  const{error}=await db.from('stickers').update({favorite:!item.favorite}).eq('id',item.id);
  if(error)report(errorText(error));await load();
 }
 async function move(item:Sticker,step:-1|1){
  const list=items??[];const group=list.filter(s=>s.favorite===item.favorite);
  const from=group.findIndex(s=>s.id===item.id),to=from+step;
  if(to<0||to>=group.length)return;
  const reordered=[...group];[reordered[from],reordered[to]]=[reordered[to],reordered[from]];
  const ids=[...(item.favorite?reordered:list.filter(s=>s.favorite)),...(item.favorite?list.filter(s=>!s.favorite):reordered)].map(s=>s.id);
  setItems(current=>current&&ids.map(id=>current.find(s=>s.id===id)!));
  const{error}=await db.rpc('reorder_stickers',{ids});
  if(error){report(errorText(error));await load();}
 }
 async function remove(item:Sticker){
  setConfirming('');
  const{error}=await db.from('stickers').delete().eq('id',item.id);
  if(error){report(errorText(error));return;}
  await db.storage.from('stickers').remove([item.path]); // o Storage mantém o arquivo se alguma mensagem ainda o usa
  await load();
 }

 const count=items?.length??0;
 return <div className="sticker-panel">
  <div className="sticker-toolbar">
   <span className="small muted" aria-live="polite">{working||`${count}/${STICKER_LIMIT} figurinhas`}</span>
   <div className="row wrap">
    <button type="button" disabled={Boolean(working)} onClick={()=>file.current?.click()}><Upload size={15}/>Importar</button>
    <button type="button" disabled={Boolean(working)} onClick={create}><ImagePlus size={15}/>Criar</button>
    <button type="button" aria-pressed={organize} className={organize?'selected':''} disabled={!count} onClick={()=>{setOrganize(v=>!v);setConfirming('');}}><Pencil size={15}/>{organize?'Pronto':'Organizar'}</button>
   </div>
   <input ref={file} type="file" hidden multiple accept="image/webp,image/png,image/jpeg,image/gif" onChange={e=>{void importFiles(e.target.files);e.target.value='';}}/>
  </div>
  {items===null?<p className="picker-empty muted">Carregando suas figurinhas…</p>
   :!count?<div className="picker-empty"><strong>Sua coleção está vazia.</strong><p className="muted small">Importe figurinhas do WhatsApp salvas no aparelho (arquivos WEBP, PNG, JPEG ou GIF) ou crie a sua com “Criar”.</p></div>
   :<ul className={`sticker-grid ${organize?'organizing':''}`}>
    {items.map((item,index)=>{const group=items.filter(s=>s.favorite===item.favorite);const at=group.findIndex(s=>s.id===item.id);return <li key={item.id} className="sticker-tile">
     <button type="button" className="sticker-send" aria-label={organize?'Figurinha':'Enviar figurinha'} disabled={organize||sending} onClick={()=>send(item)}><StickerImage db={db} path={item.path} className="sticker-thumb"/>{item.favorite&&<Star size={12} className="sticker-fav" fill="currentColor" aria-label="Favorita"/>}</button>
     {organize&&<div className="sticker-tools" role="group" aria-label={`Organizar figurinha ${index+1}`}>
      <button type="button" aria-label={item.favorite?'Tirar das favoritas':'Favoritar'} aria-pressed={item.favorite} onClick={()=>void toggleFavorite(item)}><Star size={14} fill={item.favorite?'currentColor':'none'}/></button>
      <button type="button" aria-label="Mover para antes" disabled={at===0} onClick={()=>void move(item,-1)}><ArrowLeft size={14}/></button>
      <button type="button" aria-label="Mover para depois" disabled={at===group.length-1} onClick={()=>void move(item,1)}><ArrowRight size={14}/></button>
      {confirming===item.id?<button type="button" className="danger" aria-label="Confirmar exclusão" onClick={()=>void remove(item)}>Excluir?</button>:<button type="button" aria-label="Excluir figurinha" onClick={()=>setConfirming(item.id)}><Trash2 size={14}/></button>}
     </div>}
    </li>;})}
   </ul>}
 </div>;
}

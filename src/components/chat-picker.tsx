'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Clock,Flag,Hand,Heart,Lightbulb,PawPrint,Plane,Search,Smile,Trophy,Utensils,X,type LucideIcon} from 'lucide-react';
import {emojiCategories,loadEmojis,pushRecentEmoji,readRecentEmojis,searchEmojis,type EmojiItem} from '@/lib/emoji';
import type {Sticker} from '@/lib/types';
import {StickerPanel} from './sticker-panel';

const icons:LucideIcon[]=[Smile,Hand,PawPrint,Utensils,Trophy,Plane,Lightbulb,Heart,Flag];

/** Painel flutuante com duas abas, Emojis e Figurinhas, que continua aberto enquanto se escolhe mais de um item. */
export function ChatPicker({db,onEmoji,onSticker,createSticker,stickersVersion,stickerSending,report,close}:{db:SupabaseClient;onEmoji:(emoji:string)=>void;onSticker:(sticker:Sticker)=>void;createSticker:()=>void;stickersVersion:number;stickerSending:boolean;report:(text:string)=>void;close:()=>void}){
 const[tab,setTab]=useState<'emoji'|'sticker'>('emoji');
 const[stickersSeen,setStickersSeen]=useState(false);
 return <div className="chat-picker" role="dialog" aria-label="Emojis e figurinhas">
  <div className="picker-tabs" role="tablist" aria-label="Tipo de conteúdo">
   <button type="button" role="tab" id="tab-emoji" aria-selected={tab==='emoji'} aria-controls="panel-emoji" className={tab==='emoji'?'selected':''} onClick={()=>setTab('emoji')}>Emojis</button>
   <button type="button" role="tab" id="tab-sticker" aria-selected={tab==='sticker'} aria-controls="panel-sticker" className={tab==='sticker'?'selected':''} onClick={()=>{setTab('sticker');setStickersSeen(true);}}>Figurinhas</button>
   <button type="button" className="picker-close" aria-label="Fechar painel" onClick={close}><X size={16}/></button>
  </div>
  <div role="tabpanel" id="panel-emoji" aria-labelledby="tab-emoji" hidden={tab!=='emoji'} className="picker-body"><EmojiTab onEmoji={onEmoji}/></div>
  {stickersSeen&&<div role="tabpanel" id="panel-sticker" aria-labelledby="tab-sticker" hidden={tab!=='sticker'} className="picker-body"><StickerPanel db={db} version={stickersVersion} create={createSticker} send={onSticker} report={report} sending={stickerSending}/></div>}
 </div>;
}

function EmojiTab({onEmoji}:{onEmoji:(emoji:string)=>void}){
 const[groups,setGroups]=useState<EmojiItem[][]|null>(null);
 const[failed,setFailed]=useState(false);
 const[recents,setRecents]=useState<string[]>([]);
 const[query,setQuery]=useState('');
 const[category,setCategory]=useState<number|'recent'|null>(null);
 const grid=useRef<HTMLDivElement>(null);
 useEffect(()=>{const saved=readRecentEmojis();setRecents(saved);setCategory(saved.length?'recent':0);loadEmojis().then(setGroups).catch(()=>setFailed(true));},[]);
 const active:number|'recent'=category??0;
 const searching=query.trim().length>0;
 const results=useMemo(()=>groups&&searching?searchEmojis(groups,query):[],[groups,query,searching]);
 const shown:{emoji:string;label:string}[]=searching?results:active==='recent'?recents.map(emoji=>({emoji,label:emoji})):(groups?.[active]??[]);
 const title=searching?'Resultados':active==='recent'?'Usados recentemente':emojiCategories[active].label;
 function pick(emoji:string){setRecents(current=>pushRecentEmoji(emoji,current));onEmoji(emoji);}
 function chooseCategory(next:number|'recent'){setCategory(next);setQuery('');grid.current?.scrollTo({top:0});}
 return <>
  <label className="picker-search"><Search size={15} aria-hidden="true"/><input type="search" aria-label="Buscar emoji" placeholder="Buscar emoji (ex.: coração, gato, festa)" value={query} onChange={e=>setQuery(e.target.value)} autoComplete="off" maxLength={40}/></label>
  <div className="picker-cats" role="group" aria-label="Categorias de emoji">
   <button type="button" title="Recentes" aria-label="Recentes" aria-pressed={!searching&&active==='recent'} className={!searching&&active==='recent'?'selected':''} onClick={()=>chooseCategory('recent')}><Clock size={17}/></button>
   {emojiCategories.map((c,i)=>{const Icon=icons[i];return <button type="button" key={c.id} title={c.label} aria-label={c.label} aria-pressed={!searching&&active===i} className={!searching&&active===i?'selected':''} onClick={()=>chooseCategory(i)}><Icon size={17}/></button>;})}
  </div>
  <div className="picker-scroll" ref={grid}>
   <h3 className="picker-title">{title}</h3>
   {failed?<p className="picker-empty muted">Não foi possível carregar os emojis. Feche e abra o painel de novo.</p>
    :!groups?<p className="picker-empty muted">Carregando emojis…</p>
    :!shown.length?<p className="picker-empty muted">{searching?'Nenhum emoji encontrado para essa busca.':'Os emojis que você usar aparecem aqui.'}</p>
    :<div className="emoji-grid">{shown.map(item=><button type="button" key={item.emoji} className="emoji-btn" aria-label={item.label} title={item.label} onClick={()=>pick(item.emoji)}>{item.emoji}</button>)}</div>}
  </div>
 </>;
}

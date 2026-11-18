'use client';
import {useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {isEmojiOnly} from '@/lib/chat-media';
import type {Message} from '@/lib/types';
import {AudioPlayer} from './audio-player';
import {useSignedUrl} from './use-signed-url';

/** Imagem de uma figurinha guardada no bucket privado. Se o link vencer, pede outro uma vez. */
export function StickerImage({db,path,className='chat-sticker'}:{db:SupabaseClient;path:string;className?:string}){
 const{url,error,retry}=useSignedUrl(db,'stickers',path);
 const[failedUrl,setFailedUrl]=useState('');
 const retried=useRef('');
 if(error||(url&&failedUrl===url))return <span className="sticker-missing">Figurinha indisponível</span>;
 return url?<img className={className} src={url} alt="Figurinha" loading="lazy" onError={()=>{if(retried.current!==url){retried.current=url;retry();}else setFailedUrl(url);}}/>:<span className={`${className} sticker-loading`} aria-hidden="true"/>;
}

/** Corpo de uma mensagem: texto, só emojis (maiores), áudio ou figurinha. */
export function MessageContent({db,message}:{db:SupabaseClient;message:Message}){
 if(message.kind==='audio'&&message.media_path)return <AudioPlayer db={db} path={message.media_path} durationMs={message.media_duration_ms??0}/>;
 if(message.kind==='sticker'&&message.media_path)return <StickerImage db={db} path={message.media_path}/>;
 return <p className={isEmojiOnly(message.body)?'emoji-only':undefined}>{message.body}</p>;
}

'use client';
import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Camera,Pencil,Trash2,X} from 'lucide-react';
import type {Profile} from '@/lib/types';
import {coverUrl} from './profile-card';
import {errorText} from '@/lib/validation';
export function ProfileCoverEditor({db,profile,reload,report}:{db:SupabaseClient;profile?:Profile;reload:()=>Promise<void>;report:(text:string)=>void}){
 const[busy,setBusy]=useState(false);const[open,setOpen]=useState(false);const tools=useRef<HTMLDivElement>(null);
 // o lápis abre a câmera e a lixeira ao lado; fecha ao tocar fora ou com Esc
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!tools.current?.contains(e.target as Node))setOpen(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);};},[open]);
 async function save(file?:File){if(!profile||!file)return;setBusy(true);try{
  if(!['image/gif','image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Use GIF, PNG, JPG ou WebP de até 5 MB.');
  let blob:Blob=file;let extension='gif';
  if(file.type==='image/gif'){const header=new TextDecoder().decode(await file.slice(0,6).arrayBuffer());if(!['GIF87a','GIF89a'].includes(header))throw new Error('O arquivo não é um GIF válido.');}
  else {extension='webp';const bitmap=await createImageBitmap(file);try{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=400;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Falha ao preparar capa.');const scale=Math.max(1200/bitmap.width,400/bitmap.height);const width=bitmap.width*scale,height=bitmap.height*scale;ctx.drawImage(bitmap,(1200-width)/2,(400-height)/2,width,height);blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha na conversão da capa.')),'image/webp',.86));}finally{bitmap.close();}}
  const path=`${profile.id}/${crypto.randomUUID()}.${extension}`;const uploaded=await db.storage.from('profile-covers').upload(path,blob,{contentType:extension==='gif'?'image/gif':'image/webp'});if(uploaded.error)throw uploaded.error;
  const updated=await db.from('profiles').update({cover_path:path}).eq('id',profile.id);if(updated.error){await db.storage.from('profile-covers').remove([path]);throw updated.error;}
  if(profile.cover_path)await db.storage.from('profile-covers').remove([profile.cover_path]);await reload();report('Capa atualizada. Seu perfil entrou no clima.');
 }catch(e){report(errorText(e));}finally{setBusy(false);}}
 async function remove(){if(!profile)return;setBusy(true);try{const r=await db.from('profiles').update({cover_path:''}).eq('id',profile.id);if(r.error)throw r.error;if(profile.cover_path)await db.storage.from('profile-covers').remove([profile.cover_path]);await reload();report('Capa removida.');}catch(e){report(errorText(e));}finally{setBusy(false);}}
 return <section className="cover-editor"><div className="profile-cover">{coverUrl(profile?.cover_path)?<img src={coverUrl(profile?.cover_path)} alt="Sua capa de perfil"/>:<span>Sua capa. Seu clima.</span>}<div className={`cover-actions ${open?'open':''}`} ref={tools}><div className="cover-tools" inert={!open}><label className="cover-action icon-only" title={profile?.cover_path?'Trocar capa':'Adicionar capa'}><Camera size={16}/><span className="sr-only">{profile?.cover_path?'Trocar capa':'Adicionar capa'}</span><input disabled={busy} type="file" accept="image/gif,image/png,image/jpeg,image/webp" onChange={e=>{void save(e.target.files?.[0]);e.target.value='';setOpen(false);}}/></label>{profile?.cover_path&&<button className="cover-action icon-only" disabled={busy} aria-label="Remover capa" title="Remover capa" onClick={()=>{void remove();setOpen(false);}}><Trash2 size={16}/></button>}</div><button className="cover-action icon-only cover-edit" aria-label="Editar capa" aria-expanded={open} title="Editar capa" onClick={()=>setOpen(v=>!v)}>{open?<X size={16}/>:<Pencil size={16}/>}</button></div></div></section>;
}

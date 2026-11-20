'use client';
import {createPortal} from 'react-dom';
import {useRef,useEffect,useLayoutEffect,useState,type TouchEvent} from 'react';
import {X,UserPlus,MessageCircle,Headphones,CalendarDays,Pencil} from 'lucide-react';
import type {Profile,Friendship} from '@/lib/types';
import {profileTag} from '@/lib/identity';
import {Avatar} from './avatar';
import {useStoreBenefits} from './use-store-benefits';
import {presenceLine,type PresenceInfo} from '@/lib/presence';
import {StatusDot} from './presence-ui';
import {memberSinceLabel,type ProfileCall} from '@/lib/profile-info';
import {placeBeside} from '@/lib/popover-place';
import {recentAnchor} from '@/lib/pointer-anchor';
export function coverUrl(path?:string){return path&&/^[0-9a-f-]+\/[0-9a-f-]+\.(webp|gif)$/.test(path)?`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-covers/${path}`:'';}
export function ProfileCard({profile,close,own,friendship,me,busy,request,accept,remove,message,presence,call,edit}:{presence?:PresenceInfo;profile:Profile;close:()=>void;own?:boolean;friendship?:Friendship;me?:string;busy?:boolean;request?:()=>void;accept?:(id:string)=>void;remove?:(id:string)=>void;message?:()=>void;call?:ProfileCall;edit?:()=>void}){
 const benefit=useStoreBenefits(profile.id);const ref=useRef<HTMLDialogElement>(null);const drag=useRef<{y:number;dy:number}|null>(null);
 const[place,setPlace]=useState<{left:number;top:number}|null>(null);
 // desktop: o cartão abre ao lado de quem foi clicado (esquerda da tela → à direita; lista de membros → à esquerda); no celular é a folha de baixo
 useLayoutEffect(()=>{const node=ref.current;if(!node)return;if(!node.open)node.showModal();const anchor=window.matchMedia('(min-width:721px)').matches?recentAnchor():null;if(anchor){const r=node.getBoundingClientRect();setPlace(placeBeside(anchor,{width:r.width,height:r.height},{width:window.innerWidth,height:window.innerHeight}));}return()=>node.close();},[]);
 const since=memberSinceLabel(profile.created_at);
 // celular: a folha acompanha o dedo ao arrastar a capa para baixo e fecha se passar de ~110 px
 const down=(e:TouchEvent<HTMLDivElement>)=>{drag.current={y:e.touches[0].clientY,dy:0};};
 const move=(e:TouchEvent<HTMLDivElement>)=>{const d=drag.current,node=ref.current;if(!d||!node)return;d.dy=Math.max(0,e.touches[0].clientY-d.y);node.style.transition='none';node.style.transform=`translateY(${d.dy}px)`;};
 const up=()=>{const d=drag.current,node=ref.current;drag.current=null;if(!d||!node)return;node.style.transition='transform 180ms ease';if(d.dy>110){node.style.transform='translateY(100%)';window.setTimeout(()=>node.close(),170);}else node.style.transform='';};
 return createPortal(<dialog ref={ref} onClose={e=>{if(!e.currentTarget.open)close();}} onClick={e=>{if(e.target===e.currentTarget)e.currentTarget.close();}} className={`profile-card-dialog ${benefit.plus?"store-plus-profile":""}`} aria-label={`Perfil de ${profile.display_name}`} style={place?{left:place.left,top:place.top,right:'auto',bottom:'auto',margin:0}:undefined}>
  <div className="pc-top" onTouchStart={down} onTouchMove={move} onTouchEnd={up} onTouchCancel={up}><span className="pc-grabber" aria-hidden="true"/><div className="profile-cover">{coverUrl(profile.cover_path)&&<img src={coverUrl(profile.cover_path)} alt="Capa do perfil"/>}<button className="icon-button" onClick={close} aria-label="Fechar perfil"><X size={18}/></button></div></div>
  <div className="profile-card-content"><Avatar profile={profile} className={benefit.plus?'store-plus-avatar':''}/><h2>{profileTag(profile)}</h2>{(benefit.plus||benefit.pro)&&<div className="store-badges">{benefit.plus&&<span>✦ Jacall Plus</span>}{benefit.pro&&<span>Call Pro</span>}</div>}<p className="muted">@{profile.username}</p>{presence&&<p className="hc-status"><StatusDot state={presence.state} className="inline"/>{presenceLine(presence)}</p>}
   {own?(edit&&<div className="profile-social-actions"><button className="primary" onClick={edit}><Pencil size={17}/>Editar perfil</button></div>):request&&<div className="profile-social-actions">{!friendship?<button className="primary" disabled={busy} onClick={request}><UserPlus size={17}/>Enviar solicitação</button>:friendship.status==='accepted'?<button className="primary" disabled={busy} onClick={message}><MessageCircle size={17}/>Mensagem</button>:friendship.receiver_id===me?<><button className="primary" disabled={busy} onClick={()=>accept?.(friendship.id)}>Aceitar</button><button disabled={busy} onClick={()=>remove?.(friendship.id)}>Recusar</button></>:<button disabled={busy} onClick={()=>remove?.(friendship.id)}>Cancelar solicitação enviada</button>}</div>}
   {call&&<section className="pc-section pc-call"><h3>Em voz</h3><div className="pc-call-row"><div className="pc-call-people">{call.people.slice(0,4).map(p=><Avatar key={p.id} name={p.name} url={p.avatar}/>)}</div><div><strong>{call.channelName}</strong><small>em {call.serverName}</small></div></div>{call.join&&<button className="primary pc-join" disabled={busy} onClick={call.join}><Headphones size={17}/>Entrar na chamada de voz</button>}</section>}
   <section className="pc-section"><h3>Sobre mim</h3><p className="pc-bio">{profile.bio||'Essa lenda ainda não escreveu a bio.'}</p></section>
   {since&&<section className="pc-section"><h3>Membro do NACALL desde</h3><p className="pc-since"><CalendarDays size={16}/>{since}</p></section>}
  </div></dialog>,document.body);}

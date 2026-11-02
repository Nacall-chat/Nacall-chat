'use client';
import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Users,ArrowRight,X} from 'lucide-react';
import {GroupIcon} from './group-icon';
import type {Server} from '@/lib/types';
import {errorText} from '@/lib/validation';
export function inviteCode(raw:string){try{const value=raw.trim();const code=value.includes('://')?new URL(value).searchParams.get('invite'):value;return code&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)?code:null;}catch{return null;}}
export function InviteCard({db,code,loggedIn,joined,dismiss}:{db:SupabaseClient;code:string;loggedIn:boolean;joined?:(id:string)=>Promise<void>;dismiss?:()=>void}){
 const[group,setGroup]=useState<(Server&{member_count:number})|null>(null);const[error,setError]=useState('');const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);void db.rpc('preview_invite',{invite_code:code}).then(({data,error})=>{if(!active)return;setGroup(data?.[0]??null);setError(error?'Não foi possível abrir o convite.':!data?.length?'Esse convite expirou, foi revogado ou chegou ao limite.':'');setLoading(false);});return()=>{active=false;};},[db,code]);
 async function accept(){setBusy(true);setError('');try{const{data,error}=await db.rpc('join_server',{invite_code:code});if(error)throw error;await joined?.(data);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 return <section className="invite-card" aria-label="Convite para grupo"><header><span className="eyebrow">SEU SQUAD TE CHAMOU</span>{dismiss&&<button className="icon-button" aria-label="Fechar convite" onClick={dismiss}><X size={18}/></button>}</header>{loading?<p role="status">Abrindo convite…</p>:group?<><GroupIcon server={group}/><h2>{group.name}</h2>{group.description&&<p>{group.description}</p>}<p className="muted"><Users size={16}/> {group.member_count} membro(s)</p>{loggedIn?<button className="primary" disabled={busy} onClick={()=>void accept()}>{busy?'Preparando sua cadeira…':'Aceitar convite e entrar'}<ArrowRight size={17}/></button>:<p className="muted">Entre ou crie sua conta abaixo. Seu convite fica guardado para você aceitar em um clique.</p>}</>:null}{error&&<p role="status" className="form-feedback">{error}</p>}</section>;
}

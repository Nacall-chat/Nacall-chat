'use client';
import {useState,type FormEvent} from 'react';
import type {SupabaseClient,User} from '@supabase/supabase-js';
import {LogOut,Mail} from 'lucide-react';
import {postJson} from './auth-fields';
import {errorText} from '@/lib/validation';
const PLACEHOLDER='@accounts.nacall.invalid';
/** Conta do modelo antigo: marcada pelo servidor em app_metadata (a pessoa não consegue editar). Contas novas nunca têm a marca. */
export const needsEmailUpdate=(user:Pick<User,'app_metadata'>)=>user.app_metadata?.email_pending===true;
async function accessToken(db:SupabaseClient){const{data:{session}}=await db.auth.getSession();if(!session)throw new Error('Sua sessão expirou. Entre de novo.');return session.access_token;}
const digits=(v:string)=>v.replace(/\D/g,'').slice(0,6);
/** Tela que segura o app até a conta antiga confirmar um email válido (código enviado ao endereço informado). */
export function EmailUpdate({db,user,signOut}:{db:SupabaseClient;user:User;signOut:()=>void}){
 const saved=user.email&&!user.email.toLowerCase().endsWith(PLACEHOLDER)?user.email:'';
 const[email,setEmail]=useState(saved);const[sent,setSent]=useState('');const[code,setCode]=useState('');const[busy,setBusy]=useState(false);const[feedback,setFeedback]=useState('');
 async function request(e?:FormEvent){e?.preventDefault();setBusy(true);setFeedback('');try{const target=(sent||email).trim().toLowerCase();await postJson('/api/auth/email',{action:'request',email:target},await accessToken(db));setSent(target);setCode('');setFeedback(`Enviamos um código de 6 dígitos para ${target}. Confira também o spam.`);}catch(error){setFeedback(errorText(error));}finally{setBusy(false);}}
 async function confirm(e:FormEvent){e.preventDefault();setBusy(true);setFeedback('');try{await postJson('/api/auth/email',{action:'confirm',email:sent,code},await accessToken(db));const{error}=await db.auth.refreshSession();if(error)throw error;}catch(error){setFeedback(errorText(error));setCode('');}finally{setBusy(false);}}
 return <main className="auth-page jacall-auth"><div className="auth-layout solo"><section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="email-update-title"><span className="eyebrow"><Mail size={16}/> ATUALIZE SEU EMAIL</span><h2 id="email-update-title">Sua conta é antiga.<br/>Falta um email de verdade.</h2>
 <p className="muted">{sent?`Digite o código que enviamos para ${sent}. Ele vale por 10 minutos e só funciona uma vez.`:'Para continuar usando o NACALL, confirme um email que você acessa. Ele serve para recuperar sua senha e proteger sua conta. Seu usuário, senha, grupos e amigos continuam iguais.'}</p>
 {sent?<form onSubmit={confirm} aria-busy={busy}><label>Código de 6 dígitos<input className="code-input" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={e=>setCode(digits(e.target.value))} autoFocus/></label><button className="primary" disabled={busy}>{busy?'Conferindo…':'Confirmar email'}</button></form>
 :<form onSubmit={request} aria-busy={busy}><label>Email<input type="email" autoComplete="email" required maxLength={254} placeholder="voce@exemplo.com" value={email} onChange={e=>setEmail(e.target.value)} autoFocus/></label><button className="primary" disabled={busy}>{busy?'Enviando…':'Enviar código'}</button></form>}
 <div className="auth-links">{sent&&<><button className="link" disabled={busy} onClick={()=>void request()}>Reenviar código</button><button className="link" onClick={()=>{setSent('');setFeedback('');setCode('');}}>Usar outro email</button></>}<button className="link" onClick={signOut}><LogOut size={14}/> Sair</button></div>
 {feedback&&<p className="form-feedback" role="alert">{feedback}</p>}</section></div></main>;
}

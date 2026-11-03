'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import type {SupabaseClient} from '@supabase/supabase-js';
import {ArrowRight,Gamepad2,Headphones,MonitorPlay,ShieldCheck,SunMoon} from 'lucide-react';
import {Brand} from './brand';
import {ThemeSelector} from './preferences';
import {PasswordField,postJson,type ApiError} from './auth-fields';
import {authSchema,passwordIssue} from '@/lib/auth-schema';
import {errorText} from '@/lib/validation';
type Credentials={access_token:string;refresh_token:string};
type Mode='login'|'signup'|'verify'|'recover'|'recover-confirm';
const copy:Record<Mode,{eyebrow:string;title:React.ReactNode;text:string}>={
 login:{eyebrow:'O LOBBY ESTÁ ABERTO',title:<>Sumiu, né?<br/>Chega NACALL.</>,text:'Entra com seu usuário ou email. A senha a gente não adivinha.'},
 signup:{eyebrow:'SEU PRÓXIMO PONTO DE ENCONTRO',title:<>Seu nick.<br/>Sua galera.</>,text:'Escolha seu usuário, seu email e uma senha forte. Vamos confirmar o email com um código.'},
 verify:{eyebrow:'CONFIRME SEU EMAIL',title:<>Olha o email.<br/>Tem código lá.</>,text:'Digite os 6 dígitos que enviamos. O código vale por poucos minutos e só funciona uma vez.'},
 recover:{eyebrow:'ESQUECEU A SENHA?',title:<>Acontece até<br/>com pro.</>,text:'Informe o email da conta. Se ela existir, enviamos um código de 6 dígitos.'},
 'recover-confirm':{eyebrow:'QUASE LÁ',title:<>Código e<br/>senha nova.</>,text:'Digite o código do email e escolha a nova senha. Ela precisa ter pelo menos 12 caracteres.'},
};
export function Auth({db}:{db:SupabaseClient}){
 const router=useRouter();
 const[mode,setMode]=useState<Mode>('login');
 const[identifier,setIdentifier]=useState('');const[username,setUsername]=useState('');const[name,setName]=useState('');const[email,setEmail]=useState('');
 const[password,setPassword]=useState('');const[confirm,setConfirm]=useState('');const[code,setCode]=useState('');
 const[busy,setBusy]=useState(false);const[feedback,setFeedback]=useState('');const[themeOpen,setThemeOpen]=useState(false);const[cooldown,setCooldown]=useState(0);
 useEffect(()=>{if(cooldown<=0)return;const timer=setTimeout(()=>setCooldown(cooldown-1),1000);return()=>clearTimeout(timer);},[cooldown]);
 const newPassword=mode==='signup'||mode==='recover-confirm';
 const passwordHint=newPassword&&password?passwordIssue(password)??undefined:undefined;
 const mismatch=newPassword&&confirm&&confirm!==password?'As senhas não conferem.':undefined;
 function go(next:Mode,message=''){setMode(next);setFeedback(message);setPassword('');setConfirm('');setCode('');}
 async function enter(session:Credentials){const{error}=await db.auth.setSession(session);if(error)throw error;router.replace('/');}
 // A mesma validação do servidor roda aqui antes de enviar, para o erro aparecer sem esperar a rede.
 function validated<T extends {action:string}>(body:T):T{const result=authSchema.safeParse(body);if(!result.success)throw new Error(result.error.issues[0]?.message??'Confira os campos.');return body;}
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setFeedback('');
  try{
   if(mode==='login'){const result=await postJson<{session:Credentials}>('/api/auth',validated({action:'login',identifier,password}));await enter(result.session);return;}
   if(mode==='signup'){await postJson('/api/auth',validated({action:'signup',username,displayName:name,email,password,confirmPassword:confirm}));go('verify',`Enviamos um código para ${email}. Confira também o spam.`);setCooldown(60);return;}
   if(mode==='verify'){await postJson('/api/auth',validated({action:'verify',email,code}));window.dispatchEvent(new Event('nacall-signup'));go('login','Email confirmado! Agora é só entrar.');setIdentifier(username||email);return;}
   if(mode==='recover'){await postJson('/api/auth',validated({action:'recover',email}));go('recover-confirm','Se o email tiver conta, o código já está a caminho.');return;}
   await postJson('/api/auth',validated({action:'recover-confirm',email,code,password,confirmPassword:confirm}));go('login','Senha atualizada. Entre com a nova senha.');setIdentifier(email);
  }catch(error){
   const failure=error as ApiError;
   if(failure.data?.needsVerification){setEmail(String(failure.data.email??''));go('verify',failure.message);}
   else setFeedback(errorText(error));
  }finally{setBusy(false);}
 }
 async function resend(){if(cooldown>0||busy)return;setBusy(true);setFeedback('');try{await postJson('/api/auth',validated({action:'resend',email}));setFeedback('Código reenviado. Pode levar um minutinho.');setCooldown(60);}catch(error){setFeedback(errorText(error));}finally{setBusy(false);}}
 const text=copy[mode];
 const label=busy?'Conectando o lobby…':{login:'Bora NACALL',signup:'Criar minha conta',verify:'Confirmar email','recover':'Enviar código','recover-confirm':'Trocar senha'}[mode];
 return <main className="auth-page jacall-auth"><header className="landing-nav"><Link href="/" aria-label="Voltar para o início"><Brand/></Link><span className="landing-note"><span className="status-dot"/>Jacaré, pode chegar.</span><button className="icon-button" aria-label="Escolher tema" aria-expanded={themeOpen} onClick={()=>setThemeOpen(!themeOpen)}><SunMoon size={20}/></button></header>{themeOpen&&<div className="landing-theme"><ThemeSelector/></div>}
 <div className="auth-layout"><section className="auth-story"><span className="eyebrow"><Gamepad2 size={15}/> FEITO PRA QUEM FICA MAIS UMA.</span><h1>Jacaré,<br/>vá pra casa.<br/><em>A sua é NACALL.</em></h1><p>Sua galera, seu cantinho e o JACALL de headset. Só falta você na resenha.</p><div className="story-features"><span><Headphones/>Voz da galera</span><span><MonitorPlay/>Tela em 720/1080p</span><span><ShieldCheck/>Seu espaço</span></div><div className="mascot-hero" aria-hidden="true"><img src="/brand/jacall-sheet.webp" alt=""/><span>O JACALL JÁ CHEGOU.</span></div><div className="landing-footnote">NACALL <span>Entra na call. O resto a gente improvisa.</span></div></section>
 <section className="auth-card"><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p className="muted">{mode==='verify'&&email?<>Enviamos 6 dígitos para <strong>{email}</strong>. O código vale por poucos minutos e só funciona uma vez.</>:text.text}</p>
 <form onSubmit={submit} aria-busy={busy}>
  {mode==='login'&&<label>Usuário ou email<input autoComplete="username" required minLength={3} maxLength={254} placeholder="seu_nick ou voce@exemplo.com" value={identifier} onChange={e=>setIdentifier(e.target.value)}/></label>}
  {mode==='signup'&&<><label>Usuário<input autoComplete="username" required minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}" placeholder="seu_nick" value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/\s/g,''))}/><small className="field-hint">3 a 24 letras minúsculas, números ou _, sem espaços.</small></label>
   <label>Como a galera te chama?<input autoComplete="nickname" required minLength={2} maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome que aparece na call"/></label></>}
  {(mode==='signup'||mode==='recover')&&<label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com"/></label>}
  {mode==='recover-confirm'&&<label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>}
  {(mode==='verify'||mode==='recover-confirm')&&<label>Código de 6 dígitos<input className="code-input" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}/></label>}
  {mode!=='recover'&&mode!=='verify'&&<PasswordField label={mode==='recover-confirm'?'Nova senha':'Senha'} value={password} onChange={setPassword} autoComplete={newPassword?'new-password':'current-password'} placeholder={newPassword?'Pelo menos 12 caracteres':'Sua senha'} hint={passwordHint} invalid={!!passwordHint} minLength={mode==='login'?1:undefined}/>}
  {newPassword&&<PasswordField label="Confirmar senha" value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Repita a senha" hint={mismatch} invalid={!!mismatch}/>}
  <button className="primary" disabled={busy||!!passwordHint||!!mismatch}>{label}<ArrowRight size={17}/></button>
 </form>
 {mode==='verify'&&<div className="auth-links"><button className="link" disabled={cooldown>0||busy} onClick={()=>void resend()}>{cooldown>0?`Reenviar código em ${cooldown}s`:'Reenviar código'}</button><button className="link" onClick={()=>go('signup')}>Corrigir meus dados</button></div>}
 {mode!=='verify'&&<div className="auth-links"><button className="link" onClick={()=>go(mode==='signup'?'login':'signup')}>{mode==='signup'?'Já sou da casa. Entrar':'Primeira call? Crie sua conta'}</button><button className="link" onClick={()=>go(mode==='recover'||mode==='recover-confirm'?'login':'recover')}>{mode==='recover'||mode==='recover-confirm'?'Voltar ao login':'Esqueci a senha'}</button></div>}
 {feedback&&<p className="form-feedback" role="status">{feedback}</p>}<small className="auth-smallprint">Microfone e tela só são acessados quando você decide ativá-los.</small></section></div></main>;
}

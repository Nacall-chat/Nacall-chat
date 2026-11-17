'use client';
import {useEffect,useState,type FormEvent} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Copy,Download,KeyRound,LogOut,ShieldCheck,Smartphone} from 'lucide-react';
import {PasswordField,postJson} from './auth-fields';
import {passwordIssue} from '@/lib/auth-schema';
import {errorText} from '@/lib/validation';
async function accessToken(db:SupabaseClient){const{data:{session}}=await db.auth.getSession();if(!session)throw new Error('Sua sessão expirou. Entre de novo.');return session.access_token;}
const digits=(v:string)=>v.replace(/\D/g,'').slice(0,6);
/** Tela que segura o app até o código do autenticador (ou um código de recuperação) ser confirmado. */
export function MfaChallenge({db,signOut}:{db:SupabaseClient;signOut:()=>void}){
 const[code,setCode]=useState('');const[recovery,setRecovery]=useState('');const[useRecovery,setUseRecovery]=useState(false);const[busy,setBusy]=useState(false);const[feedback,setFeedback]=useState('');
 async function verify(e:FormEvent){e.preventDefault();setBusy(true);setFeedback('');try{
  if(useRecovery){await postJson('/api/auth/mfa',{action:'use-code',code:recovery},await accessToken(db));const{error}=await db.auth.refreshSession();if(error)throw error;return;}
  const{data,error:listError}=await db.auth.mfa.listFactors();if(listError)throw listError;const factor=data.totp[0];if(!factor)throw new Error('Nenhum app autenticador encontrado nesta conta.');
  const{error}=await db.auth.mfa.challengeAndVerify({factorId:factor.id,code});if(error)throw new Error('Código incorreto ou expirado. Confira o app e tente de novo.');
 }catch(error){setFeedback(errorText(error));setCode('');}finally{setBusy(false);}}
 return <main className="auth-page jacall-auth"><div className="auth-layout solo"><section className="auth-card"><span className="eyebrow"><ShieldCheck size={16}/> VERIFICAÇÃO EM DUAS ETAPAS</span><h2>Mais um passo.<br/>Só pra garantir.</h2>
 <p className="muted">{useRecovery?'Use um dos códigos de recuperação que você guardou. Ele funciona uma vez e desativa o 2FA para você configurar de novo.':'Abra o app autenticador e digite o código de 6 dígitos do NACALL.'}</p>
 <form onSubmit={verify} aria-busy={busy}>{useRecovery?<label>Código de recuperação<input autoComplete="off" required minLength={8} maxLength={40} placeholder="XXXX-XXXX-XXXX" value={recovery} onChange={e=>setRecovery(e.target.value.toUpperCase())}/></label>:<label>Código de 6 dígitos<input className="code-input" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={e=>setCode(digits(e.target.value))} autoFocus/></label>}<button className="primary" disabled={busy}>{busy?'Conferindo…':'Confirmar'}</button></form>
 <div className="auth-links"><button className="link" onClick={()=>{setUseRecovery(!useRecovery);setFeedback('');}}>{useRecovery?'Usar o app autenticador':'Perdi o acesso ao app'}</button><button className="link" onClick={signOut}><LogOut size={14}/> Sair</button></div>
 {feedback&&<p className="form-feedback" role="alert">{feedback}</p>}</section></div></main>;
}
/** Convite discreto para ativar o 2FA depois do primeiro login. "Agora não" some neste navegador. */
export function TwoFactorPrompt({db,userId,open}:{db:SupabaseClient;userId:string;open:()=>void}){
 const key=`nacall-2fa-later-${userId}`;const[show,setShow]=useState(false);
 useEffect(()=>{let live=true;void db.auth.mfa.listFactors().then(({data})=>{if(!live||!data)return;let later=false;try{later=localStorage.getItem(key)==='1';}catch{}setShow(data.totp.length===0&&!later);});return()=>{live=false;};},[db,key]);
 if(!show)return null;
 return <aside className="two-factor-prompt" role="region" aria-label="Proteja sua conta"><ShieldCheck size={22}/><div><strong>Proteja sua conta com 2FA</strong><p>Um código do app autenticador a cada login. Leva um minuto e impede que roubem sua conta só com a senha.</p></div><div className="row"><button className="primary" onClick={()=>{setShow(false);open();}}>Ativar agora</button><button onClick={()=>{try{localStorage.setItem(key,'1');}catch{}setShow(false);}}>Agora não</button></div></aside>;
}
type Enrollment={id:string;qr:string;secret:string};
/** Aba "Segurança" das configurações: senha, 2FA, códigos de recuperação e sessões. */
export function SecuritySettings({db,report}:{db:SupabaseClient;report:(message:string)=>void}){
 const[busy,setBusy]=useState(false);const[enabled,setEnabled]=useState<boolean|null>(null);const[codesLeft,setCodesLeft]=useState(0);const[enrolling,setEnrolling]=useState<Enrollment|null>(null);const[code,setCode]=useState('');const[codes,setCodes]=useState<string[]|null>(null);
 const[current,setCurrent]=useState('');const[next,setNext]=useState('');const[confirm,setConfirm]=useState('');const[disablePassword,setDisablePassword]=useState('');const[disabling,setDisabling]=useState(false);
 async function refresh(){try{const status=await postJson<{enabled:boolean;codesLeft:number}>('/api/auth/mfa',{action:'status'},await accessToken(db));setEnabled(status.enabled);setCodesLeft(status.codesLeft);}catch{setEnabled(null);}}
 useEffect(()=>{void refresh();},[]);// eslint-disable-line react-hooks/exhaustive-deps
 async function run(task:()=>Promise<void>){setBusy(true);try{await task();}catch(error){report(errorText(error));}finally{setBusy(false);}}
 const hint=next?passwordIssue(next)??undefined:undefined;const mismatch=confirm&&confirm!==next?'As senhas não conferem.':undefined;
 function changePassword(e:FormEvent){e.preventDefault();void run(async()=>{await postJson('/api/auth/password',{current,password:next,confirmPassword:confirm},await accessToken(db));setCurrent('');setNext('');setConfirm('');await db.auth.signOut({scope:'others'});report('Senha atualizada. Os outros dispositivos foram desconectados.');});}
 function startEnroll(){void run(async()=>{const{data:list}=await db.auth.mfa.listFactors();for(const factor of list?.all??[])if(factor.status==='unverified')await db.auth.mfa.unenroll({factorId:factor.id});const{data,error}=await db.auth.mfa.enroll({factorType:'totp',friendlyName:'NACALL'});if(error)throw error;setEnrolling({id:data.id,qr:data.totp.qr_code,secret:data.totp.secret});setCode('');});}
 function confirmEnroll(e:FormEvent){e.preventDefault();if(!enrolling)return;void run(async()=>{const{error}=await db.auth.mfa.challengeAndVerify({factorId:enrolling.id,code});if(error)throw new Error('Código incorreto. Confira o app e tente de novo.');// o 2FA só vale depois desta confirmação
  const generated=await postJson<{codes:string[]}>('/api/auth/mfa',{action:'generate-codes'},await accessToken(db));setEnrolling(null);setCode('');setCodes(generated.codes);setEnabled(true);setCodesLeft(generated.codes.length);report('2FA ativado. Guarde os códigos de recuperação.');});}
 function regenerate(){void run(async()=>{const generated=await postJson<{codes:string[]}>('/api/auth/mfa',{action:'generate-codes'},await accessToken(db));setCodes(generated.codes);setCodesLeft(generated.codes.length);report('Novos códigos gerados. Os anteriores deixaram de valer.');});}
 function disable(e:FormEvent){e.preventDefault();void run(async()=>{await postJson('/api/auth/mfa',{action:'disable',password:disablePassword},await accessToken(db));await db.auth.refreshSession();setDisablePassword('');setDisabling(false);setCodes(null);setEnabled(false);setCodesLeft(0);report('2FA desativado.');});}
 async function copyCodes(){if(!codes)return;try{await navigator.clipboard.writeText(codes.join('\n'));report('Códigos copiados. Guarde fora do navegador.');}catch{report('Selecione os códigos e copie manualmente.');}}
 function downloadCodes(){if(!codes)return;const url=URL.createObjectURL(new Blob([`NACALL — códigos de recuperação do 2FA\nCada código funciona uma vez. Guarde em local privado.\n\n${codes.join('\n')}\n`],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='NACALL-codigos-2fa.txt';a.click();URL.revokeObjectURL(url);}
 return <>
  <h3>Senha forte. Memória nem tanto.</h3>
  <form onSubmit={changePassword} aria-busy={busy}><PasswordField label="Senha atual" value={current} onChange={setCurrent} autoComplete="current-password"/><PasswordField label="Nova senha" value={next} onChange={setNext} autoComplete="new-password" placeholder="Pelo menos 12 caracteres" hint={hint} invalid={!!hint}/><PasswordField label="Confirmar nova senha" value={confirm} onChange={setConfirm} autoComplete="new-password" hint={mismatch} invalid={!!mismatch}/><button disabled={busy||!!hint||!!mismatch}><KeyRound size={16}/>Alterar senha</button></form>
  <hr/><h3>Verificação em duas etapas (2FA)</h3>
  {enabled===null&&<p className="muted small" role="status">Conferindo o estado do 2FA…</p>}
  {enabled===false&&!enrolling&&<><p className="muted small">Além da senha, o login pede um código do app autenticador (Google Authenticator, Authy, 1Password…). Mesmo que descubram sua senha, não entram.</p><button className="primary" disabled={busy} onClick={startEnroll}><Smartphone size={16}/>Ativar 2FA</button></>}
  {enrolling&&<form onSubmit={confirmEnroll} aria-busy={busy}><p className="muted small"><strong>1.</strong> Escaneie o QR Code com o app autenticador. <strong>2.</strong> Digite o código de 6 dígitos que ele mostrar. O 2FA só é ativado depois dessa confirmação.</p><div className="qr-box"><img src={enrolling.qr} alt="QR Code para configurar o app autenticador" width={200} height={200}/></div><p className="muted small">Sem câmera? Digite esta chave no app: <code className="recovery-code">{enrolling.secret}</code></p><label>Código de 6 dígitos<input className="code-input" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={e=>setCode(digits(e.target.value))}/></label><div className="row"><button className="primary" disabled={busy||code.length!==6}>Confirmar e ativar</button><button type="button" disabled={busy} onClick={()=>{setEnrolling(null);setCode('');}}>Cancelar</button></div></form>}
  {enabled&&<>{codes?<div className="recovery-box"><p className="muted small"><strong>Guarde estes códigos agora.</strong> Eles só aparecem esta vez. Cada um funciona uma vez, se você perder o app.</p><ol className="recovery-grid">{codes.map(c=><li key={c}><code>{c}</code></li>)}</ol><div className="row wrap"><button onClick={()=>void copyCodes()}><Copy size={16}/>Copiar</button><button onClick={downloadCodes}><Download size={16}/>Baixar</button><button className="primary" onClick={()=>setCodes(null)}>Guardei os códigos</button></div></div>:<p className="muted small"><ShieldCheck size={14}/> 2FA ativo. Códigos de recuperação restantes: <strong>{codesLeft}</strong>.</p>}
   {!codes&&<div className="row wrap"><button disabled={busy} onClick={regenerate}><KeyRound size={16}/>Gerar novos códigos</button><button disabled={busy} onClick={()=>setDisabling(!disabling)}>Desativar 2FA</button></div>}
   {disabling&&<form onSubmit={disable} aria-busy={busy}><PasswordField label="Confirme sua senha para desativar" value={disablePassword} onChange={setDisablePassword} autoComplete="current-password"/><button disabled={busy}>Desativar 2FA</button></form>}</>}
  <hr/><h3>Sessões</h3><p className="muted small">Se perdeu um aparelho ou suspeita de acesso, encerre as sessões. Você continua conectado só neste navegador, no primeiro caso.</p>
  <div className="row wrap"><button disabled={busy} onClick={()=>void run(async()=>{const{error}=await db.auth.signOut({scope:'others'});if(error)throw error;report('Os outros dispositivos foram desconectados.');})}><LogOut size={16}/>Sair dos outros dispositivos</button><button disabled={busy} onClick={()=>void run(async()=>{const{error}=await db.auth.signOut({scope:'global'});if(error)throw error;})}><LogOut size={16}/>Sair de todos, inclusive deste</button></div>
 </>;
}

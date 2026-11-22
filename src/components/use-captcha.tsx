'use client';
import {useCallback,useEffect,useRef,type ReactElement} from 'react';
import {TURNSTILE_SCRIPT,turnstileSiteKey} from '@/lib/captcha';

type Turnstile={render:(el:HTMLElement,opts:Record<string,unknown>)=>string;execute:(id:string)=>void;reset:(id:string)=>void;remove:(id:string)=>void};
declare global{interface Window{turnstile?:Turnstile}}

let loading:Promise<Turnstile>|null=null;
function loadTurnstile():Promise<Turnstile>{
 if(window.turnstile)return Promise.resolve(window.turnstile);
 loading??=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=TURNSTILE_SCRIPT;script.async=true;
  script.onload=()=>window.turnstile?resolve(window.turnstile):reject(new Error('CAPTCHA indisponível.'));
  script.onerror=()=>{loading=null;reject(new Error('Não foi possível carregar a verificação anti-robô. Confira sua conexão.'));};
  document.head.appendChild(script);
 });
 return loading;
}

/**
 * CAPTCHA (Cloudflare Turnstile) para as ações que mandam senha ou disparam email. Só existe quando o site tem
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY; sem a chave, `token()` devolve undefined e nada aparece (comportamento de hoje).
 * Cada token vale uma vez, então `token()` sempre pede um novo. Na maioria das vezes é invisível; o desafio só
 * aparece (no espaço de `slot`) quando o Cloudflare desconfia.
 */
export function useCaptcha():{slot:ReactElement|null;token:()=>Promise<string|undefined>}{
 const siteKey=turnstileSiteKey();
 const box=useRef<HTMLDivElement>(null);const widget=useRef<string|null>(null);
 const pending=useRef<{resolve:(t:string)=>void;reject:(e:Error)=>void}|null>(null);
 useEffect(()=>()=>{if(widget.current&&window.turnstile)window.turnstile.remove(widget.current);widget.current=null;},[]);
 const token=useCallback(async()=>{
  if(!siteKey)return undefined;
  const turnstile=await loadTurnstile();
  if(!box.current)throw new Error('Verificação anti-robô indisponível nesta tela.');
  if(!widget.current)widget.current=turnstile.render(box.current,{sitekey:siteKey,execution:'execute',appearance:'interaction-only',language:'pt-br',
   callback:(t:string)=>{pending.current?.resolve(t);pending.current=null;},
   'error-callback':()=>{pending.current?.reject(new Error('A verificação anti-robô falhou. Tente de novo.'));pending.current=null;},
   'expired-callback':()=>{if(widget.current)turnstile.reset(widget.current);}});
  else turnstile.reset(widget.current);
  const result=new Promise<string>((resolve,reject)=>{pending.current={resolve,reject};});
  const timeout=new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('A verificação anti-robô demorou demais. Tente de novo.')),120_000));
  turnstile.execute(widget.current);
  return Promise.race([result,timeout]);
 },[siteKey]);
 return {slot:siteKey?<div ref={box} className="captcha-slot"/>:null,token};
}

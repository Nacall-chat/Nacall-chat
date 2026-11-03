'use client';
import {useEffect,useState} from 'react';
import {Users} from 'lucide-react';

/** Only an aggregate is public. Never subscribe to profile rows or expose identities. */
export function CommunityCount({compact=false}:{compact?:boolean}){
 const[count,setCount]=useState<number|null>(null);const[unavailable,setUnavailable]=useState(false);
 useEffect(()=>{
  let active=true;let pending=false;let controller:AbortController|undefined;
  const refresh=async()=>{
   if(pending||document.visibilityState==='hidden')return;
   pending=true;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),8000);
   try{const r=await fetch('/api/community',{cache:'no-store',signal:controller.signal});if(!r.ok)throw new Error('unavailable');const data=await r.json();if(!Number.isSafeInteger(data.count)||data.count<0)throw new Error('invalid count');if(active){setCount(data.count);setUnavailable(false);}}catch{if(active)setUnavailable(true);}finally{clearTimeout(timeout);pending=false;}
  };
  void refresh();const timer=setInterval(()=>void refresh(),15000);
  const update=()=>void refresh();document.addEventListener('visibilitychange',update);window.addEventListener('focus',update);window.addEventListener('nacall-signup',update);
  return()=>{active=false;controller?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update);window.removeEventListener('nacall-signup',update);};
 },[]);
 return <div className={`community-count ${compact?'compact':''}`} role="status" aria-live="polite"><Users size={compact?16:22}/><span>{count===null?(unavailable?'Contagem indisponível no momento.':'Contando a galera…'):<>JÁ SOMOS <strong>{count.toLocaleString('pt-BR')}</strong> {count===1?'PESSOA':'PESSOAS'}!!</>}</span>{!compact&&<small>{unavailable&&count!==null?'Atualização indisponível. Tentando novamente…':'Uma comunidade. Muitas histórias pra contar.'}</small>}</div>;
}

'use client';
import {useEffect,useRef} from 'react';
import {ownsHorizontalGesture,swipeIntent} from './swipe';

/** No celular, arrastar para a direita abre a gaveta de servidores e para a esquerda fecha. */
export function useDrawerSwipe({open,setOpen}:{open:boolean;setOpen:(v:boolean)=>void}){
 const state=useRef({open,setOpen});state.current={open,setOpen};
 useEffect(()=>{
  const phone=window.matchMedia('(max-width:720px)');
  let start:{x:number;y:number;t:number;skip:boolean}|null=null;
  const down=(e:TouchEvent)=>{
   if(!phone.matches||e.touches.length!==1){start=null;return;}
   const t=e.touches[0];
   const inDrawer=Boolean((e.target as Element|null)?.closest?.('.sidebar,.rail'));
   // aberta: arrastar fecha de qualquer lugar; fechada: não disputa o gesto com campos e listas que rolam de lado
   start={x:t.clientX,y:t.clientY,t:Date.now(),skip:state.current.open?false:ownsHorizontalGesture(e.target as Element|null)&&!inDrawer};
  };
  const up=(e:TouchEvent)=>{
   const s=start;start=null;
   if(!s||s.skip||!phone.matches)return;
   const t=e.changedTouches[0];
   const intent=swipeIntent({dx:t.clientX-s.x,dy:t.clientY-s.y,ms:Date.now()-s.t});
   if(intent==='open'&&!state.current.open)state.current.setOpen(true);
   else if(intent==='close'&&state.current.open)state.current.setOpen(false);
  };
  const cancel=()=>{start=null;};
  document.addEventListener('touchstart',down,{passive:true});
  document.addEventListener('touchend',up,{passive:true});
  document.addEventListener('touchcancel',cancel,{passive:true});
  return()=>{document.removeEventListener('touchstart',down);document.removeEventListener('touchend',up);document.removeEventListener('touchcancel',cancel);};
 },[]);
}

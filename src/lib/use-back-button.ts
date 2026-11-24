'use client';
import {useEffect,useRef} from 'react';
import {createBackSentinel} from './back-sentinel';

/** No celular, Voltar fecha a tela de cima (gaveta, conversa, painel da call) em vez de sair do site. `active` = há alguma aberta; `onBack` fecha a de cima. */
export function useBackButton(active:boolean,onBack:()=>void){
 const sentinel=useRef<ReturnType<typeof createBackSentinel>|null>(null);
 const close=useRef(onBack);close.current=onBack;
 useEffect(()=>{
  sentinel.current=createBackSentinel(window.history);
  const onPop=()=>{if(sentinel.current?.popped())close.current();};
  window.addEventListener('popstate',onPop);
  return()=>{window.removeEventListener('popstate',onPop);sentinel.current=null;};
 },[]);
 // sem lista de dependências de propósito: depois que o Voltar fecha uma tela, se ainda há outra aberta, a entrada é recolocada
 useEffect(()=>{sentinel.current?.sync(active);});
}

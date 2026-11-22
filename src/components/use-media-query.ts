'use client';
import {useEffect,useState} from 'react';

/** `true` quando a consulta CSS casa (ex.: "(max-width:720px)"); acompanha mudanças de tamanho. Começa `false` até montar. */
export function useMediaQuery(query:string){
 const[matches,setMatches]=useState(false);
 useEffect(()=>{
  const media=window.matchMedia(query);
  const update=()=>setMatches(media.matches);
  update();
  media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[query]);
 return matches;
}

/** `true` em aparelho só de toque (celular, tablet sem teclado): não dá para segurar tecla, então "apertar para falar" não vale. */
export function useNoKeyboard(){
 return useMediaQuery('(hover: none) and (pointer: coarse)');
}

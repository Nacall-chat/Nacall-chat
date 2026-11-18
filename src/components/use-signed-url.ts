'use client';
import {useCallback,useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {forgetSignedUrl,signedUrl} from '@/lib/signed-urls';

/** Link assinado de um arquivo privado (áudio ou figurinha). `retry` descarta o link e pede outro (por exemplo, se expirou). */
export function useSignedUrl(db:SupabaseClient,bucket:'chat-audio'|'stickers',path:string){
 const[state,setState]=useState<{url:string;error:boolean}>({url:'',error:false});
 const[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let live=true;
  setState({url:'',error:false});
  signedUrl(db,bucket,path).then(url=>{if(live)setState({url,error:false});}).catch(()=>{if(live)setState({url:'',error:true});});
  return()=>{live=false;};
 },[db,bucket,path,attempt]);
 const retry=useCallback(()=>{forgetSignedUrl(bucket,path);setAttempt(n=>n+1);},[bucket,path]);
 return {...state,retry};
}

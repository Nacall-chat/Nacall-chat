'use client';
import {useEffect,useState} from 'react';
import {getSupabase} from '@/lib/supabase';
type Benefit={product:string;expires_at:string};
export function useStoreBenefits(userId:string|undefined){
 const [data,setData]=useState<{id:string;items:Benefit[]}|null>(null);
 useEffect(()=>{if(!userId)return;let alive=true;
 const load=async()=>{try{const session=await getSupabase()?.auth.getSession();const token=session?.data.session?.access_token;if(!token)return;const r=await fetch('/api/payments/benefits?user='+encodeURIComponent(userId),{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!r.ok)throw Error();const result=await r.json();if(alive)setData({id:userId,items:result.benefits??[]});}catch{if(alive)setData(null);}};
 void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);window.addEventListener('focus',load);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',load);};},[userId]);
 const items=data?.id===userId?data?.items??[]:[];
 return {plus:items.some(x=>x.product==='jacall-plus'&&Date.parse(x.expires_at)>Date.now()),pro:items.some(x=>x.product==='call-pro'&&Date.parse(x.expires_at)>Date.now())};
}

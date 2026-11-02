'use client';
import {useState} from 'react';
import {getSupabase} from '@/lib/supabase';
import type {Profile} from '@/lib/types';
export function avatarUrl(path:string|undefined){if(!path||!/^([a-f0-9-]{36})\/[a-zA-Z0-9_-]+\.webp$/.test(path))return '';return getSupabase()?.storage.from('avatars').getPublicUrl(path).data.publicUrl??'';}
export function safeAvatarUrl(url:string|undefined){if(!url)return '';try{const u=new URL(url);const origin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??'https://invalid.local');return u.origin===origin.origin&&u.pathname.startsWith('/storage/v1/object/public/avatars/')?u.href:'';}catch{return '';}}
export function Avatar({profile,name,url,className=''}:{profile?:Profile;name?:string;url?:string;className?:string}){const[failed,setFailed]=useState('');const src=avatarUrl(profile?.avatar_path)||safeAvatarUrl(url);const label=profile?.display_name||name||'Jogador';return <span className={`avatar ${className}`} aria-hidden="true">{src&&failed!==src?<img src={src} alt="" onError={()=>setFailed(src)} loading="lazy"/>:<span>{label.trim().slice(0,2).toUpperCase()}</span>}</span>;}

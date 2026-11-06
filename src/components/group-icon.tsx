'use client';
import {useState} from 'react';
import type {Server} from '@/lib/types';
export function groupIconUrl(path?:string){if(!path||! /^[0-9a-f-]+\/[0-9a-f-]+\.webp$/.test(path))return '';return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/group-icons/${path}`;}
export function GroupIcon({server}:{server:Pick<Server,'name'|'icon_path'|'is_official'>}){const[failed,setFailed]=useState('');const src=server.is_official?'/brand/symbol.svg':groupIconUrl(server.icon_path);return <span className="group-icon">{src&&failed!==src?<img src={src} alt="" onError={()=>setFailed(src)}/>:server.name.slice(0,2).toUpperCase()}</span>;}

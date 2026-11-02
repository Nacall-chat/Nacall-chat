'use client';
import {useRef,useEffect} from 'react';
import {X} from 'lucide-react';
import type {Profile} from '@/lib/types';
import {Avatar} from './avatar';
export function coverUrl(path?:string){return path&&/^[0-9a-f-]+\/[0-9a-f-]+\.(webp|gif)$/.test(path)?`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-covers/${path}`:'';}
export function ProfileCard({profile,close}:{profile:Profile;close:()=>void}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);return <dialog ref={ref} onClose={close} className="profile-card-dialog" aria-label={`Perfil de ${profile.display_name}`}><div className="profile-cover">{coverUrl(profile.cover_path)&&<img src={coverUrl(profile.cover_path)} alt="Capa do perfil"/>}<button className="icon-button" onClick={close} aria-label="Fechar perfil"><X size={18}/></button></div><div className="profile-card-content"><Avatar profile={profile}/><h2>{profile.display_name}</h2><p className="muted">@{profile.username}</p><p>{profile.bio||'Essa lenda ainda não escreveu a bio.'}</p></div></dialog>;}

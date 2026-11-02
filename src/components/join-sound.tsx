'use client';
import {useEffect} from 'react';
import {useRoomContext} from '@livekit/components-react';
import {bindJoinSound} from '@/lib/join-sound';
export function JoinSound({enabled}:{enabled:boolean}){
 const room=useRoomContext();
 useEffect(()=>{if(!enabled)return;const audio=new Audio('/audio/join-call.mp3');audio.preload='auto';audio.volume=.35;let blocked=false;
 const play=()=>{audio.currentTime=0;void audio.play().catch(()=>{blocked=true;});};
 const unlock=()=>{if(blocked){blocked=false;play();}};
 const unbind=bindJoinSound(room,play);window.addEventListener('pointerdown',unlock);
 return()=>{unbind();window.removeEventListener('pointerdown',unlock);audio.pause();audio.removeAttribute('src');audio.load();};
 },[room,enabled]);
 return null;
}

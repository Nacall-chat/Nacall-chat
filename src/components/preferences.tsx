'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {Moon,Sun,Monitor} from 'lucide-react';
type Theme='dark'|'light'|'system';
type Preferences={noiseSuppression:boolean;echoCancellation:boolean;autoGainControl:boolean;pushToTalk:boolean;shareAudio:boolean;joinSound:boolean;screenFps:15|30;screenHeight:720|1080};
export const voiceDefaults:Preferences={noiseSuppression:true,echoCancellation:true,autoGainControl:true,pushToTalk:false,shareAudio:true,joinSound:true,screenFps:30,screenHeight:720};
const Context=createContext({theme:'dark' as Theme,setTheme:(_t:Theme)=>{},voice:voiceDefaults,setVoice:(_p:Partial<Preferences>)=>{}});
export function PreferencesProvider({children}:{children:ReactNode}){
 const[theme,setTheme]=useState<Theme>('dark');const[voice,setVoiceState]=useState(voiceDefaults);const[loaded,setLoaded]=useState(false);
 useEffect(()=>{try{const t=localStorage.getItem('nacall-theme');if(t==='dark'||t==='light'||t==='system')setTheme(t);const raw=JSON.parse(localStorage.getItem('nacall-voice')??'{}');const next={...voiceDefaults};for(const key of ['noiseSuppression','echoCancellation','autoGainControl','pushToTalk','shareAudio','joinSound'] as const)if(typeof raw[key]==='boolean')next[key]=raw[key];if(raw.screenFps===15||raw.screenFps===30)next.screenFps=raw.screenFps;if(raw.screenHeight===720||raw.screenHeight===1080)next.screenHeight=raw.screenHeight;setVoiceState(next);}catch{}setLoaded(true);},[]);
 useEffect(()=>{if(!loaded)return;const media=window.matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=theme==='system'?(media.matches?'dark':'light'):theme;};apply();media.addEventListener('change',apply);try{localStorage.setItem('nacall-theme',theme);localStorage.setItem('nacall-voice',JSON.stringify(voice));}catch{}return()=>media.removeEventListener('change',apply);},[theme,voice,loaded]);
 return <Context.Provider value={{theme,setTheme,voice,setVoice:p=>setVoiceState(v=>({...v,...p}))}}>{children}</Context.Provider>;
}
export const usePreferences=()=>useContext(Context);
export function ThemeSelector(){const{theme,setTheme}=usePreferences();return <div className="theme-options" role="group" aria-label="Tema da interface">{([['dark',Moon,'Noite de ranked'],['light',Sun,'Modo vida real'],['system',Monitor,'Seguir o sistema']] as const).map(([id,Icon,label])=><button type="button" key={id} className={theme===id?'selected':''} aria-pressed={theme===id} onClick={()=>setTheme(id)}><Icon size={18}/><span>{label}</span></button>)}</div>;}


export function youtubeId(raw:string):string|null{
 try{const u=new URL(raw.trim());if(u.protocol!=='https:'&&u.protocol!=='http:')return null;let id:string|null=null;
 if(u.hostname==='youtu.be')id=u.pathname.split('/')[1];
 else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(u.hostname)){if(u.pathname==='/watch')id=u.searchParams.get('v');else if(/^\/(shorts|live|embed)\//.test(u.pathname))id=u.pathname.split('/')[2];}
 return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
 }catch{return null;}
}
export type MusicState={channel_id:string;video_id:string|null;playing:boolean;position_seconds:number;updated_at:string;updated_by:string|null;revision:number};
export function musicPosition(state:MusicState,now=Date.now()){return Math.min(86399,Math.max(0,state.position_seconds+(state.playing?Math.max(0,(now-Date.parse(state.updated_at))/1000):0)));}
export type YoutubePlayer={getVideoData?:()=>{title?:string};playVideo:()=>void;pauseVideo:()=>void;seekTo:(seconds:number,allowSeekAhead:boolean)=>void;getCurrentTime:()=>number;getPlayerState:()=>number;setVolume:(volume:number)=>void;mute:()=>void;unMute:()=>void;destroy:()=>void};
type YoutubeApi={Player:new(element:HTMLElement,options:Record<string,unknown>)=>YoutubePlayer};
declare global{interface Window{YT?:YoutubeApi;onYouTubeIframeAPIReady?:()=>void}}
let loading:Promise<YoutubeApi>|undefined;
export function loadYoutube(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 loading??=new Promise<YoutubeApi>((resolve,reject)=>{const timeout=setTimeout(()=>{loading=undefined;reject(new Error('O player do YouTube não carregou. Confira bloqueadores e tente de novo.'));},15000);const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{previous?.();clearTimeout(timeout);if(window.YT)resolve(window.YT);};const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;script.onerror=()=>{clearTimeout(timeout);loading=undefined;reject(new Error('Não foi possível carregar o YouTube.'));};document.head.appendChild(script);});return loading;
}

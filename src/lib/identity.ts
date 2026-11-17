import type {Profile} from './types';
export function profileTag(profile?:Pick<Profile,'display_name'|'user_number'>):string {
 if(!profile)return 'Membro';
 return profile.user_number ? `${profile.display_name} #${String(profile.user_number).padStart(5,'0')}` : profile.display_name;
}
export function friendNumber(raw:string):number|null {
 const match=raw.trim().match(/^(?:.{2,60}\s+)?#([0-9]{5,16})$/u);
 if(!match)return null;
 const value=Number(match[1]);
 return Number.isSafeInteger(value)&&value>0?value:null;
}

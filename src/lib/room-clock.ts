export type RoomSnapshot={channelId:string;startedAt:number|null;count:number;participants:{id:string;name:string;avatar:string}[]};
export function durationLabel(start:number|null,now=Date.now()){if(!start)return '';const elapsed=Math.max(0,Math.floor((now-start)/1000));return [Math.floor(elapsed/3600),Math.floor(elapsed/60)%60,elapsed%60].map(v=>String(v).padStart(2,'0')).join(':');}
export function nextRoomStart(previous:{startedAt?:number|null;observedAt?:number;sids?:string[]},members:{sid:string;joinedAt:number}[],now:number){if(!members.length)return null;const first=Math.min(...members.map(p=>p.joinedAt));const overlaps=members.some(p=>previous.sids?.includes(p.sid));return previous.startedAt&&previous.startedAt<=first&&(overlaps||first<=(previous.observedAt??0))?previous.startedAt:Math.min(first,now);}
/** Diferença entre o relógio do servidor e o deste aparelho (ms), contando a ida e a volta da consulta pela metade. */
export function clockOffset(serverNow:number,sentAt:number,receivedAt:number){return Math.round(serverNow-(sentAt+receivedAt)/2);}
/**
 * A sala em que a pessoa está, já com ela dentro: o servidor só a lista depois da conexão, e antes disso o nome e o contador ficavam sem aparecer.
 * Sem começo conhecido, usa o momento em que ela entrou.
 */
export function withLocalParticipant(snapshot:RoomSnapshot|undefined,channelId:string,me:{id:string;name:string;avatar:string},joinedAt:number):RoomSnapshot{
 const base=snapshot??{channelId,startedAt:null,count:0,participants:[]};
 const present=base.participants.some(p=>p.id===me.id);
 const participants=present?base.participants:[...base.participants,me];
 return {channelId,startedAt:base.startedAt??joinedAt,count:present?Math.max(base.count,participants.length):base.count+1,participants};
}

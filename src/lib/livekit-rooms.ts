import {RoomServiceClient} from 'livekit-server-sdk';
import {nextRoomStart,type RoomSnapshot} from './room-clock';
export function roomService(){return new RoomServiceClient(process.env.LIVEKIT_URL!.replace(/^wss:/,'https:').replace(/^ws:/,'http:'),process.env.LIVEKIT_API_KEY!,process.env.LIVEKIT_API_SECRET!);}
export async function roomSnapshots(ids:string[]):Promise<RoomSnapshot[]>{
 const service=roomService();const rooms=await service.listRooms(ids.map(id=>`channel-${id}`));
 return Promise.all(ids.map(async channelId=>{const name=`channel-${channelId}`;const room=rooms.find(r=>r.name===name);if(!room)return {channelId,startedAt:null,count:0,participants:[]};
  const observedAt=Date.now();const roster=(await service.listParticipants(name)).filter(p=>!p.permission?.hidden);
  let metadata:Record<string,unknown>={};try{metadata=JSON.parse(room.metadata||'{}');}catch{}
  const prior=(metadata.nacallClock??{}) as {startedAt?:number;observedAt?:number;sids?:string[]};
  const members=roster.map(p=>({sid:p.sid,joinedAt:Number(p.joinedAt)*1000}));const startedAt=nextRoomStart(prior,members,observedAt);
  // Only the server has room-metadata permission. Save the session start across observers.
  if(prior.startedAt!==startedAt||JSON.stringify(prior.sids)!==JSON.stringify(members.map(p=>p.sid))){metadata.nacallClock={startedAt,observedAt,sids:members.map(p=>p.sid)};await service.updateRoomMetadata(name,JSON.stringify(metadata));}
  return {channelId,startedAt,count:roster.length,participants:roster.map(p=>{let avatar='';try{avatar=JSON.parse(p.metadata||'{}').avatar||'';}catch{}return{id:p.identity,name:p.name||'Jogador',avatar};})};
 }));
}

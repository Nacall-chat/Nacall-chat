type SoundRoom={state:string;remoteParticipants:Map<string,{sid:string}>;on:(event:'connected'|'participantConnected'|'participantDisconnected',callback:(participant?:{sid:string})=>void)=>unknown;off:(event:'connected'|'participantConnected'|'participantDisconnected',callback:(participant?:{sid:string})=>void)=>unknown};
// Ignore the initial roster; one sound per actual new participant SID.
export function bindJoinSound(room:SoundRoom,play:()=>void){
 let connected=room.state==='connected';const seen=new Set([...room.remoteParticipants.values()].map(p=>p.sid));
 const onConnected=()=>{connected=true;for(const p of room.remoteParticipants.values())seen.add(p.sid);play();};
 const onJoined=(participant?:{sid:string})=>{if(!connected||!participant||seen.has(participant.sid))return;seen.add(participant.sid);play();};
 const onLeft=(participant?:{sid:string})=>{if(participant)seen.delete(participant.sid);};
 room.on('connected',onConnected);room.on('participantConnected',onJoined);room.on('participantDisconnected',onLeft);
 return()=>{room.off('connected',onConnected);room.off('participantConnected',onJoined);room.off('participantDisconnected',onLeft);};
}


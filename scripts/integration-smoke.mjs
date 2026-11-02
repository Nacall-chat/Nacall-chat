// Real-service smoke test. Creates clearly named QA fixtures, never changes existing accounts.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {TokenVerifier} from 'livekit-server-sdk';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,pub=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!pub||!key)throw new Error('Credenciais locais de teste ausentes.');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const base=process.env.NACALL_TEST_URL??'http://localhost:3002';
const stateFile='.local-tests/state.json';
async function cleanup(state){
 if(!state.namespace?.startsWith('qa_nacall_'))throw new Error('Namespace de testes inválido.');
 // Deleting only these verified QA owners cascades their own servers; no broad table deletes.
 for(const fixture of state.accounts??[]){const current=await admin.auth.admin.getUserById(fixture.id);if(!current.data.user)continue;if(current.data.user.email!==fixture.email||!fixture.email.includes(state.namespace))throw new Error('Conta não corresponde ao fixture; limpeza interrompida.');if(fixture.id===state.accounts[0]?.id&&state.groupIcon?.startsWith(state.serverId+'/')){const removed=await admin.storage.from('group-icons').remove([state.groupIcon]);if(removed.error)throw removed.error;}const profile=await admin.from('profiles').select('avatar_path,cover_path').eq('id',fixture.id).maybeSingle();const cover=profile.data?.cover_path;if(cover?.startsWith(fixture.id+'/')){const removedCover=await admin.storage.from('profile-covers').remove([cover]);if(removedCover.error)throw removedCover.error;}const avatar=profile.data?.avatar_path||fixture.avatar;if(avatar?.startsWith(fixture.id+'/'))await admin.storage.from('avatars').remove([avatar]);const result=await admin.auth.admin.deleteUser(fixture.id);if(result.error)throw result.error;}
}
if(process.argv.includes('--cleanup')){const state=JSON.parse(await readFile(stateFile,'utf8'));await cleanup(state);await unlink(stateFile);console.log('Fixtures NACALL removidos. Contas anteriores preservadas.');process.exit(0);}
const namespace=`qa_nacall_${randomBytes(3).toString('hex')}`;const password=`Qa!${randomBytes(18).toString('base64url')}`;const state={namespace,accounts:[],serverId:null};const clients=[];
const request=async(body,status=200)=>{const r=await fetch(`${base}/api/auth`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,JSON.stringify({status:r.status,error:data.error}));return data;};
const ok=(result)=>{if(result.error)throw new Error(`${result.error.code??''} ${result.error.message}`);return result.data;};
try{
 const a=await request({action:'signup',username:`${namespace}_a`,displayName:'QA — piloto A',password});state.accounts.push({id:JSON.parse(Buffer.from(a.session.access_token.split('.')[1],'base64url').toString()).sub,email:`${namespace}_a@accounts.nacall.invalid`,username:`${namespace}_a`,password});
 const b=await request({action:'signup',username:`${namespace}_b`,displayName:'QA — piloto B',password});state.accounts.push({id:JSON.parse(Buffer.from(b.session.access_token.split('.')[1],'base64url').toString()).sub,email:`${namespace}_b@accounts.nacall.invalid`,username:`${namespace}_b`,password});
 for(const [suffix,data] of [['a',a],['b',b]]){const client=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});ok(await client.auth.setSession(data.session));const user=ok(await client.auth.getUser()).user;assert.ok(state.accounts.some(x=>x.id===user.id));clients.push(client);}
 const[ca,cb]=clients;const[pa,pb]=state.accounts;
 await request({action:'login',username:pa.username,password:'Senha_errada_123!'},401);
 const login=await request({action:'login',username:pa.username,password});assert.ok(login.session.access_token);assert.equal(login.email,undefined);
 // Legacy email account: username login resolves it privately, without changing its identity or password.
 const legacyEmail=`${namespace}_old@legacy.nacall.invalid`;const legacy=ok(await admin.auth.admin.createUser({email:legacyEmail,password,email_confirm:true})).user;
 state.accounts.push({id:legacy.id,email:legacyEmail,username:`${namespace}_old`,password});const legacyClient=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(legacyClient);ok(await legacyClient.auth.signInWithPassword({email:legacyEmail,password}));ok(await legacyClient.from('profiles').update({username:`${namespace}_old`}).eq('id',legacy.id));await request({action:'login',username:`${namespace}_old`,password});
 const recover=await request({action:'recover',username:pb.username,password:password+'new',recoveryCode:b.recoveryCode});assert.ok(recover.recoveryCode&&recover.recoveryCode!==b.recoveryCode);await request({action:'recover',username:pb.username,password,recoveryCode:b.recoveryCode},401);pb.password=password+'new';ok(await cb.auth.setSession(recover.session));
 const serverId=ok(await ca.rpc('create_server',{server_name:namespace}));state.serverId=serverId;const invite=ok(await ca.from('invites').insert({server_id:serverId}).select().single());ok(await cb.rpc('join_server',{invite_code:invite.code}));
 const friendship=ok(await ca.from('friendships').insert({sender_id:pa.id,receiver_id:pb.id}).select().single());ok(await cb.from('friendships').update({status:'accepted'}).eq('id',friendship.id));const dm=ok(await ca.rpc('open_dm',{friend_id:pb.id}));ok(await ca.from('messages').insert({dm_id:dm,body:'QA NACALL: mensagem persistente real.'}));assert.equal(ok(await cb.from('messages').select('id').eq('dm_id',dm)).length,1);
 const channel=ok(await ca.from('channels').select('id').eq('server_id',serverId).eq('kind','voice').single());
 let realtime;const subscriptionStates=[];const received=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error(`Música não recebida por Realtime em 15 segundos. Estados: ${subscriptionStates.join(',')||'nenhum'}`)),15000);realtime=cb.channel(namespace).on('postgres_changes',{event:'INSERT',schema:'public',table:'room_media',filter:`channel_id=eq.${channel.id}`},payload=>{clearTimeout(timeout);resolve(payload.new);}).subscribe(status=>{subscriptionStates.push(status);if(status==='SUBSCRIBED')void ca.rpc('set_room_media',{room_channel:channel.id,youtube_id:'dQw4w9WgXcQ',is_playing:true,seek_seconds:0}).then(r=>{if(r.error){clearTimeout(timeout);reject(r.error);}});});});
 assert.equal((await received).video_id,'dQw4w9WgXcQ');await cb.removeChannel(realtime);
 const tokenResponse=await fetch(`${base}/api/livekit/token`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${login.session.access_token}`},body:JSON.stringify({channelId:channel.id})});assert.equal(tokenResponse.status,200);const token=await tokenResponse.json();const claims=await new TokenVerifier(process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET).verify(token.token);assert.ok(claims.video.canPublishSources.includes('screen_share'));assert.ok(claims.video.canPublishSources.includes('screen_share_audio'));assert.equal(claims.sub,pa.id);
 const anonymous=createClient(url,pub,{auth:{persistSession:false}});assert.ok((await anonymous.from('account_recovery').select('*')).error);assert.ok((await anonymous.from('room_media').select('*')).error);
 await mkdir('.local-tests',{recursive:true});await writeFile(stateFile,JSON.stringify({...state,channelId:channel.id,serverId,password},null,2));
 console.log('APROVADO: cadastro sem email, login por usuário, senha errada, conta antiga, recuperação com rotação, amizade, DM, servidor, convite, música via Realtime e tokens de tela/áudio.');
 console.log('Não executado por este script: microfones/câmeras reais, captura de tela do sistema e reprodução do player YouTube.');
 if(!process.argv.includes('--keep')){await cleanup(state);await unlink(stateFile);console.log('Fixtures removidos.');}else console.log('Fixtures privados mantidos em .local-tests/state.json para inspeção visual; rode --cleanup depois.');
}catch(error){await cleanup(state);throw error;}finally{await Promise.all(clients.map(c=>c.removeAllChannels()));}


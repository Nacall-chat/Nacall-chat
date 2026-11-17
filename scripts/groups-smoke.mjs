import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createQaAccount} from './qa-account.mjs';
const base=process.env.NACALL_TEST_URL||'http://localhost:3003';const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});const namespace='qa_nacall_'+randomBytes(3).toString('hex');const state={namespace,accounts:[],serverId:null};const clients=[];
try{await access('.local-tests/state.json');throw new Error('Remova o QA anterior antes de começar.');}catch(e){if(e.code!=='ENOENT')throw e;}
const ok=r=>{if(r.error)throw r.error;return r.data;};
try{
 for(const suffix of ['a','b','c']){const username=namespace+'_'+suffix;const password='Qa!'+randomBytes(18).toString('base64url');const account=await createQaAccount(admin,url,key,{username,displayName:'QA — '+suffix.toUpperCase(),password});state.accounts.push({id:account.id,username,password,email:account.email});clients.push(account.client);}
 const[a,b,c]=clients;state.serverId=ok(await a.rpc('create_server',{server_name:namespace}));const s=state.serverId;
 ok(await a.rpc('save_server',{s,new_name:namespace,new_description:'QA temporário · cargos, convites e chamadas',new_icon:''}));
 const invite=ok(await a.from('invites').insert({server_id:s,max_uses:1}).select().single());ok(await b.rpc('join_server',{invite_code:invite.code}));ok(await b.rpc('join_server',{invite_code:invite.code}));assert.equal(ok(await a.from('invites').select('uses').eq('code',invite.code).single()).uses,1);assert.ok((await c.rpc('join_server',{invite_code:invite.code})).error);
 const role=ok(await a.rpc('save_server_role',{s,r:null,role_name:'Capitão QA',role_color:'#F23041',role_position:100,role_permissions:['manage_roles','manage_channels','manage_invites']}));ok(await a.rpc('assign_server_role',{s,member_id:state.accounts[1].id,r:role,assigned:true}));
 ok(await b.from('channels').insert({server_id:s,name:'call do squad QA',kind:'voice'}));assert.ok((await b.rpc('save_server_role',{s,r:null,role_name:'Acima do capitão',role_color:'#F23041',role_position:110,role_permissions:[]})).error);assert.ok((await b.rpc('save_server',{s,new_name:'Sem permissão',new_description:'',new_icon:''})).error);
 const anon=createClient(url,key,{auth:{persistSession:false}});assert.equal(ok(await anon.rpc('preview_invite',{invite_code:invite.code})).length,0);const open=ok(await a.from('invites').insert({server_id:s}).select().single());assert.equal(ok(await anon.rpc('preview_invite',{invite_code:open.code}))[0].name,namespace);state.inviteCode=open.code;
 state.channelId=ok(await a.from('channels').select('id').eq('server_id',s).eq('kind','voice').order('created_at').limit(1).single()).id;ok(await a.rpc('set_room_media',{room_channel:state.channelId,youtube_id:'M7lc1UVf-VE',is_playing:false,seek_seconds:0}));assert.equal(ok(await b.from('room_media').select('video_id').eq('channel_id',state.channelId).single()).video_id,'M7lc1UVf-VE');
 await mkdir('.local-tests',{recursive:true});await writeFile('.local-tests/state.json',JSON.stringify(state));console.log('APROVADO: perfil de grupo, cargos delegados, anti-escalada, canais, convites limitados/idempotentes, preview anônimo e leitura compartilhada de música.');console.log('QA mantido para inspeção autorizada. Remover com integration-smoke.mjs --cleanup.');
}catch(e){for(const account of state.accounts)ok(await admin.auth.admin.deleteUser(account.id));throw e;}finally{await Promise.all(clients.map(c=>c.removeAllChannels()));}

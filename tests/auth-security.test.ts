import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {authSchema,mfaSchema,passwordChangeSchema,passwordIssue} from '../src/lib/auth-schema';
import {bucketKey,classifyMailError,emailAlreadyRegistered,generateRecoveryCodes,hasVerifiedFactor,hashRecoveryCode,jwtClaims,needsSecondFactor,normalizeRecoveryCode} from '../src/lib/auth-server';
const base={action:'signup',username:'nick_01',displayName:'Nick',email:'nick@exemplo.com',password:'Tr0ca-Esta-Senha!',confirmPassword:'Tr0ca-Esta-Senha!'};
test('senha exige 12+ caracteres, mistura e rejeita as óbvias; aceita frases longas',()=>{
 assert.match(passwordIssue('curta1!')!,/12/);
 assert.match(passwordIssue('somenteletrasaqui')!,/letras/);
 assert.match(passwordIssue('123456789012')!,/letras|comum/);
 assert.match(passwordIssue('senha12345678')!,/comum/);
 assert.match(passwordIssue('a'.repeat(129)+'1')!,/128/);
 assert.equal(passwordIssue('Tr0ca-Esta-Senha!'),null);
 assert.equal(passwordIssue('uma frase longa de senha 2026'),null);
});
test('cadastro valida usuário, email e senhas; normaliza e recusa divergência',()=>{
 const ok=authSchema.parse({...base,username:' Nick_01 ',email:' Nick@Exemplo.COM '});
 assert.ok(ok.action==='signup');assert.equal(ok.username,'nick_01');assert.equal(ok.email,'nick@exemplo.com');
 const bad=(patch:object)=>authSchema.safeParse({...base,...patch});
 assert.equal(bad({confirmPassword:'Outra-Senha-123!'}).success,false);
 assert.equal(bad({password:'curta1!',confirmPassword:'curta1!'}).success,false);
 for(const username of ['ab','nick com espaço','nick-01','a'.repeat(25),'Ñandú'])assert.equal(bad({username}).success,false,username);
 for(const email of [undefined,'','sem-arroba','a@','@b.com','a b@c.com',`${'a'.repeat(250)}@b.com`])assert.equal(bad({email}).success,false,String(email));
 assert.equal(bad({displayName:'x'}).success,false);
});
test('código de verificação tem exatamente 6 dígitos e recuperação exige confirmar a senha',()=>{
 for(const code of ['12345','1234567','12345a','','      '])assert.equal(authSchema.safeParse({action:'verify',email:'a@b.com',code}).success,false,code);
 assert.equal(authSchema.safeParse({action:'verify',email:'a@b.com',code:' 123456 '}).success,true);
 assert.equal(authSchema.safeParse({action:'recover',email:'a@b.com'}).success,true);
 const confirm={action:'recover-confirm',email:'a@b.com',code:'123456',password:'Tr0ca-Esta-Senha!',confirmPassword:'Tr0ca-Esta-Senha!'};
 assert.equal(authSchema.safeParse(confirm).success,true);
 assert.equal(authSchema.safeParse({...confirm,confirmPassword:'x'}).success,false);
 assert.equal(authSchema.safeParse({...confirm,password:'fraca',confirmPassword:'fraca'}).success,false);
 assert.equal(authSchema.safeParse({action:'login',identifier:'ab',password:'x'}).success,false);
 assert.equal(authSchema.safeParse({action:'inexistente'}).success,false);
});
test('troca de senha logado pede a atual e a nova forte confirmada; ações de 2FA são fechadas',()=>{
 assert.equal(passwordChangeSchema.safeParse({current:'atual',password:'Tr0ca-Esta-Senha!',confirmPassword:'Tr0ca-Esta-Senha!'}).success,true);
 assert.equal(passwordChangeSchema.safeParse({current:'',password:'Tr0ca-Esta-Senha!',confirmPassword:'Tr0ca-Esta-Senha!'}).success,false);
 assert.equal(passwordChangeSchema.safeParse({current:'a',password:'Tr0ca-Esta-Senha!',confirmPassword:'diferente'}).success,false);
 assert.equal(mfaSchema.safeParse({action:'generate-codes'}).success,true);
 assert.equal(mfaSchema.safeParse({action:'use-code',code:'curto'}).success,false);
 assert.equal(mfaSchema.safeParse({action:'disable'}).success,false);
 assert.equal(mfaSchema.safeParse({action:'drop-all'}).success,false);
});
test('códigos de recuperação: formato, unicidade, hash estável e sem texto puro',()=>{
 const codes=generateRecoveryCodes();
 assert.equal(codes.length,10);assert.equal(new Set(codes).size,10);
 for(const code of codes){assert.match(code,/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);assert.match(hashRecoveryCode(code),/^[0-9a-f]{64}$/);assert.ok(!hashRecoveryCode(code).includes(normalizeRecoveryCode(code)));}
 const [first]=codes;
 assert.equal(hashRecoveryCode(first),hashRecoveryCode(first.toLowerCase().replace(/-/g,' ')));
 assert.notEqual(hashRecoveryCode(first),hashRecoveryCode(codes[1]));
});
test('nível da sessão vem do JWT e conta com 2FA só passa em aal2; limites guardam apenas HMAC',()=>{
 const jwt=(claims:object)=>`x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;
 assert.equal(jwtClaims(jwt({aal:'aal2'})).aal,'aal2');assert.deepEqual(jwtClaims('lixo'),{});
 assert.equal(hasVerifiedFactor({factors:[{id:'1',status:'verified'} as never]}),true);
 assert.equal(hasVerifiedFactor({factors:[{id:'1',status:'unverified'} as never]}),false);
 assert.equal(hasVerifiedFactor({factors:undefined}),false);
 assert.equal(needsSecondFactor({mfa:true,aal:'aal1'}),true);assert.equal(needsSecondFactor({mfa:true,aal:'aal2'}),false);assert.equal(needsSecondFactor({mfa:false,aal:'aal1'}),false);
 const key=bucketKey('segredo','login','Maria@Exemplo.com');
 assert.match(key,/^[0-9a-f]{64}$/);assert.equal(key,bucketKey('segredo','login','maria@exemplo.com'));assert.notEqual(key,bucketKey('outro','login','maria@exemplo.com'));assert.ok(!key.includes('maria'));
});
test('falha de email: separa limite de envio, entrega quebrada (SMTP, rede) e erro de quem digitou; reconhece email já cadastrado',()=>{
 assert.equal(classifyMailError({status:429,code:'over_email_send_rate_limit'}),'rate');
 assert.equal(classifyMailError({status:429}),'rate');
 assert.equal(classifyMailError({code:'over_email_send_rate_limit'}),'rate');
 assert.equal(classifyMailError({status:500,code:'unexpected_failure'}),'delivery');// Gmail recusou a senha do SMTP
 assert.equal(classifyMailError({status:502}),'delivery');
 assert.equal(classifyMailError({status:0}),'delivery');
 assert.equal(classifyMailError({}),'delivery');// sem status: a rede falhou
 assert.equal(classifyMailError({status:400,code:'email_address_not_authorized'}),'delivery');
 assert.equal(classifyMailError({status:400,code:'validation_failed'}),'other');
 assert.equal(classifyMailError({status:422,code:'weak_password'}),'other');
 assert.equal(emailAlreadyRegistered({identities:[]}),true);
 assert.equal(emailAlreadyRegistered({identities:[{id:'1'} as never]}),false);
 assert.equal(emailAlreadyRegistered({identities:undefined}),false);
 assert.equal(emailAlreadyRegistered(null),false);assert.equal(emailAlreadyRegistered(undefined),false);
});
test('migration de segurança: apaga contas antigas, protege códigos 2FA, limita tentativas e libera nicks abandonados',async()=>{
 const db=new PGlite();const u=(n:number)=>`${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`;
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,created_at timestamptz not null default now());
   create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
   create table public.profiles(id uuid primary key references auth.users on delete cascade,username text);
   create table public.auth_attempts(bucket text primary key,window_start timestamptz not null,attempts integer not null);
   create table public.account_recovery(user_id uuid primary key);create table public.account_emails(user_id uuid primary key);
   grant usage on schema public,auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  await db.query(`insert into auth.users(id,email,email_confirmed_at,created_at) values
   ($1,'velho@accounts.nacall.invalid',now(),now()),($2,'real@exemplo.com',now(),now()),
   ($3,'abandonado@exemplo.com',null,now()-interval '2 days'),($4,'recente@exemplo.com',null,now())`,[u(1),u(2),u(3),u(4)]);
  for(const [i,name] of [[1,'velho'],[2,'real'],[3,'abandonado'],[4,'recente']] as const)await db.query('insert into public.profiles values($1,$2)',[u(i),name]);
  await db.exec(await readFile(new URL('../supabase/migrations/202611030002_auth_seguranca.sql',import.meta.url),'utf8'));
  const emails=async()=>(await db.query<{email:string}>('select email from auth.users order by email')).rows.map(r=>r.email);
  assert.deepEqual(await emails(),['abandonado@exemplo.com','real@exemplo.com','recente@exemplo.com']);// conta do modelo antigo saiu
  await assert.rejects(db.query('select * from public.account_recovery'));await assert.rejects(db.query('select * from public.account_emails'));
  const as=async(role:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.role',$1,false)",[role]);await db.exec(`set role ${role}`);};
  const hash='a'.repeat(64);
  await as('service_role');
  await db.query('insert into public.mfa_recovery_codes(user_id,code_hash) values($1,$2)',[u(2),hash]);
  await assert.rejects(db.query('insert into public.mfa_recovery_codes(user_id,code_hash) values($1,$2)',[u(2),hash]));// hash repetido
  await assert.rejects(db.query("insert into public.mfa_recovery_codes(user_id,code_hash) values($1,'curto')",[u(2)]));
  for(const role of ['authenticated','anon']){await as(role);await assert.rejects(db.query('select * from public.mfa_recovery_codes'));await assert.rejects(db.query('insert into public.mfa_recovery_codes(user_id,code_hash) values($1,$2)',[u(2),'b'.repeat(64)]));}
  const limit=async(key:string,max:number,secs:number)=>(await db.query<{ok:boolean}>('select public.consume_rate_limit($1,$2,$3) as ok',[key,max,secs])).rows[0].ok;
  const key='c'.repeat(64);
  await as('authenticated');await assert.rejects(db.query('select public.consume_rate_limit($1,3,60)',[key]));
  await as('service_role');
  assert.deepEqual([await limit(key,3,60),await limit(key,3,60),await limit(key,3,60),await limit(key,3,60)],[true,true,true,false]);
  assert.equal(await limit('curta',3,60),false);assert.equal(await limit(key,0,60),false);assert.equal(await limit(key,3,0),false);
  await db.exec('reset role');await db.query("update public.auth_attempts set window_start=now()-interval '2 minutes' where bucket=$1",[key]);await as('service_role');
  assert.equal(await limit(key,3,60),true);// janela passou: contador recomeça
  const purge=async()=>(await db.query<{n:number}>('select public.purge_unconfirmed_accounts() as n')).rows[0].n;
  await as('authenticated');await assert.rejects(db.query('select public.purge_unconfirmed_accounts()'));
  await as('service_role');assert.equal(Number(await purge()),1);
  await db.exec('reset role');assert.deepEqual(await emails(),['real@exemplo.com','recente@exemplo.com']);// só o não confirmado com mais de 1 dia
  assert.equal((await db.query('select 1 from public.profiles where id=$1',[u(3)])).rows.length,0);// nick liberado
 }finally{await db.close();}
});

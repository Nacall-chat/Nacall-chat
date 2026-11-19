import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {authorizedWebhook,checkoutBody,paymentState,productSchema} from '../src/lib/asaas-server';
test('checkout: preço fixo, pagamento avulso e referência interna',()=>{
 const body=checkoutBody('jacall-plus','order','https://nacall.site');
 assert.equal(body.items[0].value,9.9);
 assert.equal(checkoutBody('call-pro','order','https://nacall.site').items[0].value,14.9);
 assert.deepEqual(body.chargeTypes,['DETACHED']);assert.equal(body.externalReference,'order');
 assert.equal(productSchema.safeParse('premium').success,false);
});
test('webhook: token exclusivo e estados financeiros',()=>{
 const token='a'.repeat(32);assert.ok(authorizedWebhook(token,token));assert.equal(authorizedWebhook('b'.repeat(32),token),false);assert.equal(authorizedWebhook(null,token),false);assert.equal(authorizedWebhook('abc','abc'),false);
 assert.equal(paymentState('CONFIRMED'),'paid');assert.equal(paymentState('RECEIVED'),'paid');assert.equal(paymentState('PENDING'),null);assert.equal(paymentState('REFUNDED'),'revoked');assert.equal(paymentState('CHARGEBACK_REQUESTED'),'revoked');
});
test('pedidos: isolamento, preço, evento idempotente, validade e revogação',async()=>{
 const db=new PGlite();const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on all functions in schema auth to authenticated;`);
 await db.exec(await readFile(new URL('../supabase/migrations/202611190004_store_orders.sql',import.meta.url),'utf8'));
 await db.query('insert into auth.users values($1),($2)',[a,b]);
 await db.query("insert into public.store_orders(id,user_id,product,amount_cents,checkout_id) values($1,$2,'jacall-plus',990,'checkout')",[id,a]);
 await assert.rejects(db.query("insert into public.store_orders(user_id,product,amount_cents) values($1,'jacall-plus',1)",[a]));
 await assert.rejects(db.query("insert into public.store_orders(user_id,product,amount_cents) values($1,'jacall-plus',990)",[a]));
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);await db.exec('set role authenticated');
 assert.equal((await db.query('select * from public.store_orders')).rows.length,0);
 await assert.rejects(db.query("update public.store_orders set status='paid'"));
 await assert.rejects(db.query("select public.store_apply_event('fake',$1,'checkout','pay_one','paid')",[id]));
 await db.exec('reset role; set role service_role');
 const apply=(event:string,checkout:string,status:string)=>db.query<{ok:boolean}>('select public.store_apply_event($1,$2,$3,$4,$5) ok',[event,id,checkout,'pay_one',status]);
 assert.equal((await apply('wrong','unrelated','paid')).rows[0].ok,false);
 assert.equal((await apply('first','checkout','paid')).rows[0].ok,true);
 const read=async()=>(await db.query<{status:string;paid_at:string;expires_at:string;days:number}>("select status,paid_at::text,expires_at::text,extract(epoch from(expires_at-paid_at))/86400 as days from public.store_orders where id=$1",[id])).rows[0];
 const first=await read();assert.equal(first.status,'paid');assert.equal(Number(first.days),30);
 await apply('first','checkout','paid');await apply('second','checkout','paid');assert.equal((await read()).expires_at,first.expires_at);
 await apply('refund','checkout','revoked');await apply('late','checkout','paid');assert.equal((await read()).status,'revoked');
 }finally{await db.close();}
});

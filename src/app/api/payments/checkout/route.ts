import {z} from 'zod';
import {adminClient,allow,emailPending,needsSecondFactor,reply,serverEnv,sessionUser} from '@/lib/auth-server';
import {asaasConfig,asaasRequest,checkoutBody,checkoutIdSchema,checkoutUrl,products,productSchema} from '@/lib/asaas-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const env=serverEnv();if(!env)return reply({error:'Loja indisponível'},503);
 const s=await sessionUser(request,env);if(!s||needsSecondFactor(s)||emailPending(s.user))return reply({error:'Sessão inválida'},401);
 const db=adminClient(env);
 const {data,error}=await db.from('store_orders').select('id,product,status,amount_cents,created_at,paid_at,expires_at').eq('user_id',s.user.id).order('created_at',{ascending:false}).limit(100);
 return reply({enabled:process.env.ASAAS_ENABLED==='true'&&!!asaasConfig()&&!error,orders:data??[],historyAvailable:!error});
}
export async function POST(request:Request){
 if(process.env.ASAAS_ENABLED!=='true')return reply({error:'Compras ainda não disponíveis'},503);
 const env=serverEnv(),cfg=asaasConfig();if(!env||!cfg)return reply({error:'Loja indisponível'},503);
 const origin=process.env.APP_URL;
 const expected=cfg.env==='production'?'https://nacall.site':'https://nacall-hml.vercel.app';
 if(origin!==expected)return reply({error:'Ambiente inválido'},503);
 const s=await sessionUser(request,env);if(!s||needsSecondFactor(s)||emailPending(s.user))return reply({error:'Sessão inválida'},401);
 if(Number(request.headers.get('content-length')||0)>2048)return reply({error:'Pedido inválido'},413);
 const input=z.object({product:productSchema}).strict().safeParse(await request.json().catch(()=>null));
 if(!input.success)return reply({error:'Produto inválido'},400);
 const db=adminClient(env),product=input.data.product;
 try{
 if(!await allow(db,env.secret,'store-checkout',s.user.id,5,3600))return reply({error:'Muitas tentativas. Tente mais tarde.'},429);
 const {data:existing,error:lookup}=await db.from('store_orders').select('id,checkout_id,status,expires_at,created_at').eq('user_id',s.user.id).eq('product',product).in('status',['pending','paid']).order('created_at',{ascending:false}).limit(20);
 if(lookup)throw lookup;
 if(existing?.some(o=>o.status==='paid'&&Date.parse(o.expires_at)>Date.now()))return reply({error:'Você já possui este benefício ativo.'},409);
 const pending=existing?.find(o=>o.status==='pending');
 if(pending)return pending.checkout_id&&Date.parse(pending.created_at)>Date.now()-30*60*1000?reply({url:checkoutUrl(cfg.env,pending.checkout_id)}):reply({error:'Pedido em processamento. Aguarde antes de tentar novamente.'},409);
 const {data:order,error}=await db.from('store_orders').insert({user_id:s.user.id,product,amount_cents:products[product].cents}).select('id').single();
 if(error?.code==='23505')return reply({error:'Já existe uma compra em andamento.'},409);
 if(error||!order)throw error??new Error('order');
 const parsed=z.object({id:checkoutIdSchema}).parse(await asaasRequest(cfg,'/checkouts',checkoutBody(product,order.id,origin)));
 const saved=await db.from('store_orders').update({checkout_id:parsed.id}).eq('id',order.id);
 if(saved.error)throw saved.error;
 return reply({url:checkoutUrl(cfg.env,parsed.id)},201);
 }catch{console.error('[store] checkout indisponível');return reply({error:'Não foi possível iniciar a compra. Nenhuma confirmação foi registrada.'},503);}
}

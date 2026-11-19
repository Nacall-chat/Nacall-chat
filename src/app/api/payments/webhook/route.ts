import {z} from 'zod';
import {adminClient,reply,serverEnv} from '@/lib/auth-server';
import {asaasConfig,asaasRequest,authorizedWebhook,eventSchema,paymentSchema,paymentState} from '@/lib/asaas-server';
export const runtime='nodejs';
export async function POST(request:Request){
 const env=serverEnv(),cfg=asaasConfig();if(!env||!cfg)return reply({error:'Indisponível'},503);
 if(!authorizedWebhook(request.headers.get('asaas-access-token'),cfg.token))return reply({error:'Não autorizado'},401);
 if(Number(request.headers.get('content-length')||0)>131072)return reply({error:'Evento muito grande'},413);
 const raw=await request.text();if(raw.length>131072)return reply({error:'Evento muito grande'},413);
 let json:unknown;try{json=JSON.parse(raw)}catch{return reply({error:'JSON inválido'},400)}
 const parsed=eventSchema.safeParse(json);if(!parsed.success)return reply({error:'Evento inválido'},400);
 const event=parsed.data,db=adminClient(env);
 try{
 let payment: z.infer<typeof paymentSchema>|undefined;
 let checkout=event.checkout?.id;
 if(event.payment){payment=paymentSchema.parse(await asaasRequest(cfg,'/payments/'+encodeURIComponent(event.payment.id)));if(payment.id!==event.payment.id)throw Error('payment mismatch');checkout=payment.checkoutSession??undefined;}
 else if(checkout&&event.event==='CHECKOUT_PAID'){
 const result=z.object({data:z.array(paymentSchema)}).parse(await asaasRequest(cfg,'/payments?checkoutSession='+encodeURIComponent(checkout)));
 const valid=result.data.filter(p=>p.checkoutSession===checkout&&paymentState(p.status)!==null);
 if(valid.length!==1)return reply({error:'Conciliação pendente'},503);
 payment=valid[0];
 }
 if(!checkout&&!payment)return reply({ok:true});
 const q=db.from('store_orders').select('id,checkout_id,payment_id,amount_cents,status');
 const {data:order,error}=await(checkout?q.eq('checkout_id',checkout):q.eq('payment_id',payment!.id)).maybeSingle();
 if(error)throw error;
 if(!order){
 // A checkout event can precede persistence of the provider ID; retry instead of losing it.
 const ref=event.checkout?.externalReference??payment?.externalReference;
 if(ref&&z.string().uuid().safeParse(ref).success){const found=await db.from('store_orders').select('id').eq('id',ref).maybeSingle();if(found.error||found.data)return reply({error:'Conciliação pendente'},503);}
 return reply({ok:true});
 }
 let status:'paid'|'revoked'|'canceled'|'expired'|null=null;
 if(payment){if(Math.round(payment.value*100)!==order.amount_cents||!['PIX','CREDIT_CARD'].includes(payment.billingType))return reply({error:'Valor ou modalidade divergente'},409);status=paymentState(payment.status);}
 else if(event.event==='CHECKOUT_CANCELED')status='canceled';
 else if(event.event==='CHECKOUT_EXPIRED')status='expired';
 if(!status)return reply({ok:true});
 const applied=await db.rpc('store_apply_event',{p_event:event.id,p_order:order.id,p_checkout:checkout??null,p_payment:payment?.id??null,p_status:status});
 if(applied.error||applied.data!==true)throw Error('event not applied');
 return reply({ok:true});
 }catch{console.error('[store] conciliação indisponível');return reply({error:'Tente novamente'},503);}
}

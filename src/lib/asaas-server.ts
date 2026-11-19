import {timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
export const products={
 'jacall-plus':{name:'Jacall Plus',cents:990},
 'call-pro':{name:'Call Pro',cents:1490}
} as const;
export const productSchema=z.enum(['jacall-plus','call-pro']);
export type ProductId=z.infer<typeof productSchema>;
export function asaasConfig(){
 const key=process.env.ASAAS_API_KEY,token=process.env.ASAAS_WEBHOOK_TOKEN,env=process.env.ASAAS_ENV;
 if(!key||!token||token.length<32||(env!=='sandbox'&&env!=='production'))return null;
 // Never let previews or HML use production payment credentials.
 if(env==='production'&&(process.env.VERCEL_ENV!=='production'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://cjtcumnymflxfdhdqtdn.supabase.co'))return null;
 if(env==='sandbox'&&process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://vpqutlhziliiilrrkqll.supabase.co')return null;
 const base=env==='production'?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3';
 return {key,token,env,base};
}
export type AsaasConfig=NonNullable<ReturnType<typeof asaasConfig>>;
export function authorizedWebhook(actual:string|null,expected:string){
 if(!actual||expected.length<32)return false;
 const a=Buffer.from(actual),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function asaasRequest(cfg:AsaasConfig,path:string,body?:unknown):Promise<unknown>{
 const r=await fetch(cfg.base+path,{method:body===undefined?'GET':'POST',headers:{access_token:cfg.key,'Content-Type':'application/json','User-Agent':'NACALL/1.0'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error('Asaas HTTP '+r.status);
 return r.json();
}
export function checkoutUrl(env:'sandbox'|'production',id:string){
 return (env==='sandbox'?'https://sandbox.asaas.com':'https://asaas.com')+'/checkoutSession/show?id='+encodeURIComponent(id);
}
export function checkoutBody(product:ProductId,orderId:string,origin:string){
 const p=products[product];
 const back=(state:string)=>origin+'/?checkout='+state;
 return {billingTypes:['PIX','CREDIT_CARD'],chargeTypes:['DETACHED'],minutesToExpire:30,externalReference:orderId,callback:{successUrl:back('pending'),cancelUrl:back('canceled'),expiredUrl:back('expired')},items:[{name:p.name,description:p.name+' - 30 dias, pagamento avulso',quantity:1,value:p.cents/100}]};
}
export const checkoutIdSchema=z.string().uuid();
export const paymentSchema=z.object({id:z.string().regex(/^pay_[A-Za-z0-9]+$/),status:z.string(),value:z.number(),billingType:z.string(),checkoutSession:z.string().nullish(),externalReference:z.string().nullish()});
export const eventSchema=z.object({id:z.string().min(1).max(300),event:z.string(),checkout:z.object({id:checkoutIdSchema,externalReference:z.string().nullish()}).optional(),payment:z.object({id:z.string().regex(/^pay_[A-Za-z0-9]+$/)}).optional()});
export function paymentState(status:string):'paid'|'revoked'|null{
 if(['CONFIRMED','RECEIVED'].includes(status))return 'paid';
 if(['REFUNDED','PARTIALLY_REFUNDED','REFUND_REQUESTED','REFUND_IN_PROGRESS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL'].includes(status))return 'revoked';
 return null;
}

import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const headers={'Cache-Control':'no-store'};
 // Contagem pública: a CDN guarda 60 s. Antes era sem cache e cada visita (ou script) fazia uma contagem no banco com a
 // chave de serviço (achado das revisões de segurança). O número atrasa no máximo um minuto.
 const cached={'Cache-Control':'public, max-age=0, s-maxage=60, stale-while-revalidate=300'};
 if(!url||!key)return Response.json({error:'Contagem temporariamente indisponível.'},{status:503,headers});
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const{count,error}=await db.from('profiles').select('id',{count:'exact',head:true}).abortSignal(AbortSignal.timeout(7000));
  if(error||count===null)throw new Error('count unavailable');
  return Response.json({count},{headers:cached});
 }catch{return Response.json({error:'Contagem temporariamente indisponível.'},{status:503,headers});}
}

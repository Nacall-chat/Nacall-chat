import {NextResponse} from 'next/server';
import {adminClient,allow,clientIp,serverEnv} from '@/lib/auth-server';
// Só o título e o autor de um vídeo do YouTube para o player da sala. Limite por IP: antes qualquer um usava o servidor
// como proxy do oEmbed do YouTube, sem login e sem limite (achado do teste de segurança no HML).
export async function GET(request:Request){
 const env=serverEnv();
 if(env&&!(await allow(adminClient(env),env.secret,'music-info',clientIp(request),60,300).catch(()=>false)))return NextResponse.json({error:'Muitos pedidos. Tente de novo em instantes.'},{status:429});
 const id=new URL(request.url).searchParams.get('id');
 if(!id||! /^[A-Za-z0-9_-]{11}$/.test(id))return NextResponse.json({error:'Vídeo inválido'},{status:400});
 try{
  const response=await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,{next:{revalidate:3600},signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw new Error();const data=await response.json();
  return NextResponse.json({title:String(data.title||'Música no YouTube').slice(0,200),author:String(data.author_name||'').slice(0,100)},{headers:{'Cache-Control':'public, max-age=3600'}});
 }catch{return NextResponse.json({title:'Música compartilhada no YouTube',author:''},{headers:{'Cache-Control':'public, max-age=60'}});}
}

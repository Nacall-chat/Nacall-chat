import {NextResponse} from 'next/server';
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('id');
 if(!id||! /^[A-Za-z0-9_-]{11}$/.test(id))return NextResponse.json({error:'Vídeo inválido'},{status:400});
 try{
  const response=await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,{next:{revalidate:3600},signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw new Error();const data=await response.json();
  return NextResponse.json({title:String(data.title||'Música no YouTube').slice(0,200),author:String(data.author_name||'').slice(0,100)},{headers:{'Cache-Control':'public, max-age=3600'}});
 }catch{return NextResponse.json({title:'Música compartilhada no YouTube',author:''},{headers:{'Cache-Control':'public, max-age=60'}});}
}

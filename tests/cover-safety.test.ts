import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {imageSize, stripWebpMetadata, isAnimatedWebp} from '../src/lib/chat-media';

// Auditoria de segurança (fase 1): GIF e WebP animado sobem sem passar pelo canvas (para manter a animação). Isso
// deixava passar EXIF (com GPS) de WebP no bucket público e imagens com dimensões gigantes que travam a aba de quem vê.
const ascii=(t:string)=>[...t].map(c=>c.charCodeAt(0));
const le32=(n:number)=>[n&255,(n>>8)&255,(n>>16)&255,(n>>>24)&255];
const chunk=(id:string,data:number[])=>[...ascii(id),...le32(data.length),...data,...(data.length%2?[0]:[])];
const le24=(n:number)=>[n&255,(n>>8)&255,(n>>16)&255];
function webp(chunks:number[][]){const body=[...ascii('WEBP'),...chunks.flat()];return new Uint8Array([...ascii('RIFF'),...le32(body.length),...body]);}
const vp8x=(flags:number,w:number,h:number)=>chunk('VP8X',[flags,0,0,0,...le24(w-1),...le24(h-1)]);
const gif=(w:number,h:number)=>new Uint8Array([...ascii('GIF89a'),w&255,w>>8,h&255,h>>8,0,0,0]);

test('lê largura e altura de GIF e de WebP com VP8X',()=>{
 assert.deepEqual(imageSize(gif(480,270)),{width:480,height:270});
 assert.deepEqual(imageSize(webp([vp8x(0x02,1200,400)])),{width:1200,height:400});
 assert.equal(imageSize(new Uint8Array([0xff,0xd8,0xff])),null,'JPEG não é lido aqui (passa pelo canvas)');
});

test('remove EXIF, XMP e ICCP do WebP animado e mantém a animação',()=>{
 const anim=chunk('ANIM',[0,0,0,0,0,0]),frame=chunk('ANMF',Array(16).fill(7));
 const input=webp([vp8x(0x02|0x08|0x04|0x20,640,360),chunk('ICCP',[1,2,3]),anim,frame,chunk('EXIF',ascii('GPS -23.5,-46.6')),chunk('XMP ',ascii('<x/>'))]);
 const out=stripWebpMetadata(input);
 const text=new TextDecoder('latin1').decode(out);
 assert.ok(!text.includes('EXIF')&&!text.includes('GPS')&&!text.includes('XMP ')&&!text.includes('ICCP'),'sem metadados');
 assert.ok(text.includes('ANIM')&&text.includes('ANMF'),'quadros preservados');
 assert.equal(out[20]&(0x08|0x04|0x20),0,'flags de metadados desligadas no VP8X');
 assert.ok(isAnimatedWebp(out),'continua animado');
 const riff=out[4]|(out[5]<<8)|(out[6]<<16)|(out[7]<<24);
 assert.equal(riff,out.length-8,'tamanho do RIFF corrigido');
});

test('a capa limpa o WebP animado e recusa imagem animada acima de 2000 px',async()=>{
 const editor=await readFile(new URL('../src/components/profile-cover-editor.tsx',import.meta.url),'utf8');
 assert.match(editor,/stripWebpMetadata\(/);
 assert.match(editor,/imageSize\(head\)/);
 assert.match(editor,/2000/);
});

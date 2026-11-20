import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isAnimatedWebp} from '../src/lib/chat-media';

// GIFs baixados do Giphy, Tenor e afins costumam ser WebP animado (às vezes com nome .gif). A capa só preservava
// arquivos GIF de verdade; qualquer outro passava por um canvas, que guarda só o primeiro quadro, e a animação sumia.
const webp=(chunk:string,flags=0)=>{const b=new Uint8Array(32);const put=(t:string,o:number)=>[...t].forEach((c,i)=>b[o+i]=c.charCodeAt(0));put('RIFF',0);put('WEBP',8);put(chunk,12);b[20]=flags;return b;};

test('WebP animado é reconhecido pelo bit de animação do VP8X',()=>{
 assert.equal(isAnimatedWebp(webp('VP8X',0x02)),true);
 assert.equal(isAnimatedWebp(webp('VP8X',0x12)),true,'animação com transparência');
});

test('WebP parado, outros formatos e arquivos curtos não contam como animados',()=>{
 assert.equal(isAnimatedWebp(webp('VP8X',0x10)),false,'só transparência');
 assert.equal(isAnimatedWebp(webp('VP8 ')),false,'WebP simples');
 assert.equal(isAnimatedWebp(webp('VP8L')),false,'WebP sem perdas');
 assert.equal(isAnimatedWebp(new TextEncoder().encode('GIF89a')),false);
 assert.equal(isAnimatedWebp(new Uint8Array(8)),false);
});

test('a capa decide o formato pelos bytes e envia GIF e WebP animado sem passar pelo canvas',async()=>{
 const editor=await readFile(new URL('../src/components/profile-cover-editor.tsx',import.meta.url),'utf8');
 assert.match(editor,/sniffImage\(/,'formato vem dos bytes, não do nome do arquivo');
 assert.match(editor,/isAnimatedWebp\(/,'WebP animado é detectado');
 assert.ok(!/file\.type===?'image\/gif'/.test(editor),'não confia no tipo informado pelo navegador');
});

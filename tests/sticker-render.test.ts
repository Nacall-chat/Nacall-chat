import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cornerColor,defaultEdit,placement,removeBackground,STICKER_SIZE} from '../src/lib/sticker-render';

const image=(w:number,h:number,paint:(x:number,y:number)=>[number,number,number,number])=>{
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(paint(x,y),(y*w+x)*4);
 return {data,width:w,height:h};
};
const alpha=(img:{data:Uint8ClampedArray;width:number},x:number,y:number)=>img.data[(y*img.width+x)*4+3];

test('recorte: "preencher" cobre o quadro e "inteiro" cabe sem cortar',()=>{
 const wide={...defaultEdit};
 const cover=placement(1000,500,wide);assert.equal(cover.scale,STICKER_SIZE/500,'a altura define a escala');
 assert.equal(cover.limitY,0);assert.equal(cover.limitX,(1000*cover.scale-STICKER_SIZE)/2);
 const contain=placement(1000,500,{...wide,fit:'contain'});assert.equal(contain.scale,STICKER_SIZE/1000);
 const zoomed=placement(1000,500,{...wide,zoom:2});assert.equal(zoomed.scale,cover.scale*2);
 const turned=placement(1000,500,{...wide,turns:1});assert.equal(turned.scale,placement(500,1000,wide).scale,'girar troca largura e altura');
});

test('recorte: o deslocamento nunca deixa o quadro vazio em "preencher"',()=>{
 const p=placement(1000,500,{...defaultEdit,x:99999,y:-99999});
 assert.equal(p.x,p.limitX);assert.equal(p.y,0);
 const free=placement(1000,500,{...defaultEdit,fit:'contain',x:99999});assert.equal(free.x,STICKER_SIZE/2);
 const centered=placement(300,300,defaultEdit);assert.equal(centered.cx,STICKER_SIZE/2);assert.equal(centered.cy,STICKER_SIZE/2);
});

test('fundo liso sai a partir das bordas e o desenho interno fica',()=>{
 // 9×9 de fundo branco, anel vermelho no meio com miolo branco (não pode ser apagado) e um pixel azul no centro.
 const img=image(9,9,(x,y)=>{const ring=Math.max(Math.abs(x-4),Math.abs(y-4));
  if(ring===0)return[0,0,255,255];if(ring===1)return[255,255,255,255];if(ring===2)return[255,0,0,255];return[255,255,255,255];});
 assert.deepEqual(cornerColor(img),[255,255,255]);
 removeBackground(img,[255,255,255],30);
 assert.equal(alpha(img,0,0),0,'canto');assert.equal(alpha(img,8,4),0,'borda');assert.equal(alpha(img,4,1),0,'fundo fora do anel');
 assert.equal(alpha(img,4,2),255,'anel vermelho fica');
 assert.equal(alpha(img,5,4),255,'miolo branco dentro do anel não vaza');
 assert.equal(alpha(img,4,4),255,'centro azul fica');
});

test('fundo liso: contorno suave e tolerância',()=>{
 const img=image(6,1,(x)=>x<3?[250,250,250,255]:[200,200,200,255]);
 removeBackground(img,[255,255,255],10);
 assert.equal(alpha(img,0,0),0,'quase branco sai');
 assert.equal(alpha(img,5,0),255,'cinza distante fica');
 const soft=image(3,1,(x)=>x===0?[255,255,255,255]:x===1?[255-7,255-7,255-7,255]:[0,0,0,255]);
 removeBackground(soft,[255,255,255],10);
 assert.equal(alpha(soft,0,0),0);assert.ok(alpha(soft,1,0)>0&&alpha(soft,1,0)<255,'faixa de transição vira meia transparência');
 const transparent=image(4,1,()=>[0,0,0,0]);removeBackground(transparent,[255,255,255],10);assert.equal(alpha(transparent,2,0),0);
});

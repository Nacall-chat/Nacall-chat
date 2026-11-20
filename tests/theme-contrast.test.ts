import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const hex=(value:string)=>{const h=value.replace('#','');const full=h.length===3?h.split('').map(c=>c+c).join(''):h;return [0,2,4].map(i=>parseInt(full.slice(i,i+2),16)/255);};
const lum=(value:string)=>{const [r,g,b]=hex(value).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
const contrast=(a:string,b:string)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const vars=(line:string)=>Object.fromEntries([...line.matchAll(/--([a-z-]+):(#[0-9a-fA-F]{3,6})\b/g)].map(m=>[m[1],m[2]]));

// As variáveis de cada tema são a base de tudo: texto, texto secundário, destaque e erro precisam ser legíveis em todos os fundos.
test('temas: texto, secundário, destaque e erro passam de 4,5:1 sobre todos os fundos, no claro e no escuro',async()=>{
 const lines=(await read('src/app/jacall.css')).split(/\r?\n/);
 const themes={escuro:vars(lines.find(l=>l.startsWith(':root{'))!),claro:vars(lines.find(l=>l.startsWith(':root[data-theme=light]'))!)};
 for(const [name,v] of Object.entries(themes))for(const fg of ['text','muted','accent','error','success'])for(const bg of ['bg','surface','panel','raised','soft']){
  const ratio=contrast(v[fg],v[bg]);
  assert.ok(ratio>=4.5,`${name}: ${fg} sobre ${bg} = ${ratio.toFixed(2)}`);
 }
});

test('temas: a barra lateral do celular, o selo vermelho e os botões cheios seguem as variáveis do tema',async()=>{
 const css=await read('src/app/theme-fixes.css');
 assert.match(css,/\.shell\.nav-open>\.sidebar\{background:var\(--surface\)/,'a gaveta não usa mais azul-escuro fixo');
 assert.match(css,/\.social-add,\.avatar-edit-btn\{background:var\(--primary\);color:var\(--on-primary\)\}/);
 assert.match(css,/\.unread-badge,[^{]*\.bell-badge[^{]*\{background:var\(--badge\)\}/,'selo vermelho único');
 assert.match(css,/:root\[data-theme=light\]\{--brand-call:#1f7a52/,'a marca "CALL" tem versão para o claro');
 // o selo branco sobre o vermelho precisa de 4,5:1
 const badge=css.match(/--badge:(#[0-9a-f]{6})/)![1];
 assert.ok(contrast('#ffffff',badge)>=4.5,'selo vermelho legível');
 // verde da marca legível sobre branco no tema claro
 const brand=css.match(/\[data-theme=light\]\{--brand-call:(#[0-9a-f]{6})/)![1];
 assert.ok(contrast(brand,'#ffffff')>=4.5,'CALL legível no claro');
});

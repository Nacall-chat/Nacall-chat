// Gera src/lib/emoji-data.json a partir do emojibase-data (devDependency): emojis em português por categoria,
// só os que as plataformas atuais desenham (Unicode até 15.1). Rode `node scripts/gerar-emojis.mjs` ao atualizar o pacote.
import {readFileSync,writeFileSync} from 'node:fs';
const raw=JSON.parse(readFileSync(new URL('../node_modules/emojibase-data/pt/data.json',import.meta.url),'utf8'));
const MAX_VERSION=15.1;
// Categorias do seletor (índice do emojibase → posição). Componentes (2) ficam de fora; bandeiras (9) vão por último.
const groups=[0,1,3,4,6,5,7,8,9];
const strip=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const out=groups.map(group=>raw.filter(e=>e.group===group&&e.emoji&&e.version<=MAX_VERSION).sort((a,b)=>a.order-b.order).map(e=>{
 const words=[...new Set([e.label,...(e.tags??[])].map(strip))].join(' ');
 return [e.emoji,e.label,words===strip(e.label)?'':words.replace(strip(e.label),'').trim()];
}));
writeFileSync(new URL('../src/lib/emoji-data.json',import.meta.url),JSON.stringify(out));
console.log(out.map(g=>g.length).join(' + '),'=',out.flat().length,'emojis');

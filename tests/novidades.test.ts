import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampSlide,nextLabel,UPDATE_ID,whatsNewKey,whatsNewSlides} from '../src/lib/novidades';

test('novidades: o botão vira "Fechar" só no último passo',()=>{
 const total=whatsNewSlides.length;
 assert.ok(total>=4,'cobre barra, áudio, emojis e figurinhas');
 for(let i=0;i<total-1;i++)assert.equal(nextLabel(i,total),'Próximo');
 assert.equal(nextLabel(total-1,total),'Fechar');
});

test('novidades: navegação respeita os limites e cada passo tem conteúdo',()=>{
 const total=whatsNewSlides.length;
 assert.equal(clampSlide(-1,total),0);assert.equal(clampSlide(99,total),total-1);assert.equal(clampSlide(2,total),2);
 assert.equal(new Set(whatsNewSlides.map(s=>s.id)).size,total,'ids únicos');
 for(const s of whatsNewSlides){assert.ok(s.title.length>3&&s.text.length>20&&s.points.length>=2,s.id);}
 for(const id of['barra','audio','emojis','figurinhas'])assert.ok(whatsNewSlides.some(s=>s.id===id),id);
});

test('novidades: aparece uma vez por conta e por atualização',()=>{
 assert.notEqual(whatsNewKey('a'),whatsNewKey('b'));
 assert.ok(whatsNewKey('a').includes(UPDATE_ID));
});

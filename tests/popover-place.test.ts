import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {placeBeside,anchorFrom,WIDE_ANCHOR} from '../src/lib/popover-place';
import {ANCHOR_MAX_AGE_MS} from '../src/lib/pointer-anchor';

const vp={width:1872,height:923};
const card={width:360,height:495};

test('desktop: quem está na barra da esquerda abre o cartão à direita, ao lado dele',()=>{
 const roster={left:36,right:270,top:520,bottom:555};
 const p=placeBeside(roster,card,vp);
 assert.equal(p.side,'right');assert.equal(p.left,270+12,'logo depois da barra lateral');
 assert.equal(p.top,923-495-12,'sem espaço embaixo, o cartão sobe e fica dentro da tela');
});

test('desktop: quem está na lista da direita (membros) abre o cartão à esquerda',()=>{
 const member={left:1650,right:1850,top:200,bottom:240};
 const p=placeBeside(member,card,vp);
 assert.equal(p.side,'left');assert.equal(p.left,1650-12-360);assert.equal(p.top,200,'o topo acompanha o clicado');
});

test('desktop: se não couber do lado preferido, usa o outro; nunca sai da tela',()=>{
 const narrow={width:700,height:600};
 // à esquerda da tela mas sem 372 px à direita: vai para a esquerda, se couber
 const nearRight={left:380,right:420,top:10,bottom:40};
 assert.equal(placeBeside(nearRight,{width:360,height:300},narrow).side,'left');
 // não cabe em nenhum lado: o cartão é encostado dentro da tela
 const tiny={width:300,height:300};
 const p=placeBeside({left:100,right:200,top:280,bottom:300},{width:360,height:200},tiny);
 assert.ok(p.left>=12&&p.top>=12&&p.top<=300-200-12+0.01);
});

test('linhas largas (lista de amigos) usam o ponto do clique como âncora',()=>{
 const row={left:230,right:230+WIDE_ANCHOR+100,top:300,bottom:360};
 const a=anchorFrom(row,{x:500,y:330});
 assert.equal(a.left,500);assert.equal(a.right,500);
 assert.deepEqual(anchorFrom({left:10,right:100,top:1,bottom:2},{x:50,y:1}),{left:10,right:100,top:1,bottom:2},'botão estreito vale pelo próprio retângulo');
});

test('o cartão só usa o clique recente e só no desktop; no celular segue a folha de baixo',async()=>{
 assert.ok(ANCHOR_MAX_AGE_MS<=3000);
 const card=await readFile(new URL('../src/components/profile-card.tsx',import.meta.url),'utf8');
 assert.match(card,/matchMedia\('\(min-width:721px\)'\)\.matches\?recentAnchor\(\):null/);
 assert.match(card,/placeBeside\(anchor/);
 const css=await readFile(new URL('../src/app/profile-sheet.css',import.meta.url),'utf8');
 assert.match(css,/@media\(min-width:721px\)\{[^@]*::backdrop\{background:transparent\}/,'sem escurecer a tela no desktop');
});

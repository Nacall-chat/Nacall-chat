import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkoutReturn,checkoutReturnMessage,withoutCheckout} from '../src/lib/checkout-return';
import {checkoutBody} from '../src/lib/asaas-server';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('volta do checkout: reconhece os três estados que o Asaas devolve',()=>{
 const back=checkoutBody('jacall-plus','order','https://nacall.site').callback;
 for(const url of [back.successUrl,back.cancelUrl,back.expiredUrl]){
  const state=checkoutReturn(new URL(url).searchParams.get('checkout'));
  assert.ok(state,url);
  assert.ok(checkoutReturnMessage(state).length>20);
 }
 assert.equal(checkoutReturn('paid'),null);
 assert.equal(checkoutReturn(null),null);
});

test('volta do checkout: limpa só o parâmetro checkout',()=>{
 assert.equal(withoutCheckout('https://nacall.site/?checkout=pending'),'/');
 assert.equal(withoutCheckout('https://nacall.site/?checkout=canceled&invite=abc#x'),'/?invite=abc#x');
});

test('app abre a Loja com aviso quando volta do checkout',()=>{
 const app=read('src/components/app.tsx');
 assert.match(app,/checkoutReturn\(/);
 assert.match(app,/setHomeView\('store'\)/);
 assert.match(app,/withoutCheckout\(/);
});

test('banner de 2FA abre Segurança com o 2FA primeiro',()=>{
 const app=read('src/components/app.tsx');
 assert.match(app,/setSettingsTab\('2fa'\)/);
 const mfa=read('src/components/mfa.tsx');
 assert.match(mfa,/focus2fa\?<>\{twoFactor\}<hr\/>\{password\}<\/>/);
});

test('Comunidades: convite e criar no topo, sem formulário de amigo duplicado',()=>{
 const app=read('src/components/app.tsx');
 assert.doesNotMatch(app,/Never #00001 ou @username/);
 assert.doesNotMatch(app,/Chamar pro squad/);
 assert.match(app,/Cole o link ou código do convite/);
 assert.ok(app.indexOf('Tenho um convite')<app.indexOf('Criar comunidade'));
});

test('rodapé da landing não pede doação para uma chave que não existe',()=>{
 assert.doesNotMatch(read('src/components/landing.tsx'),/Chave em breve/);
});

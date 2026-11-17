import {test} from 'node:test';
import assert from 'node:assert/strict';
import {profileTag,friendNumber} from '../src/lib/identity';
test('identificador preserva cinco dígitos e cresce sem truncar',()=>{
 assert.equal(profileTag({display_name:'Never',user_number:1}),'Never #00001');
 assert.equal(profileTag({display_name:'Never',user_number:100000}),'Never #100000');
 assert.equal(profileTag({display_name:'Legado'}),'Legado');
 assert.equal(profileTag(),'Membro');
});
test('busca aceita nome com tag ou somente tag e rejeita números inseguros',()=>{
 for(const raw of ['Never #00001',' #00001 ','Nome composto #00123'])assert.equal(friendNumber(raw),raw.includes('00123')?123:1);
 for(const raw of ['@never','Never #00000','#1','Never #9007199254740992','#00001 OR true'])assert.equal(friendNumber(raw),null);
});

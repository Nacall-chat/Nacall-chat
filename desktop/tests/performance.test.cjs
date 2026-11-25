'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {chromiumSwitches,lightWebPreferences,LIGHT_MODE_CSS,readPrefs,writePrefs,prefsFile}=require('../performance.cjs');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'nacall-prefs-'));
test('desliga o processo reserva e outras funções que só gastam memória',()=>{
 const features=new Map(chromiumSwitches()).get('disable-features');
 assert.ok(features.split(',').includes('SpareRendererForSitePerProcess'));
 assert.equal(chromiumSwitches().filter(([name])=>name==='disable-features').length,1,'um só disable-features (o Chromium só lê o último)');
});
test('não desliga a GPU nem a segurança por padrão',()=>{
 const names=chromiumSwitches().map(([name])=>name);
 for(const risky of ['disable-gpu','no-sandbox','disable-web-security','disable-site-isolation-trials'])assert.ok(!names.includes(risky),risky);
});
test('janela estrangula em segundo plano e não carrega corretor',()=>{
 assert.deepEqual(lightWebPreferences(),{backgroundThrottling:true,spellcheck:false});
});
test('CSS do modo leve tira animações e desfoque',()=>{
 assert.match(LIGHT_MODE_CSS,/animation:none!important/);
 assert.match(LIGHT_MODE_CSS,/backdrop-filter:none!important/);
});
test('preferências: padrão, ida e volta, e arquivo corrompido',()=>{
 const dir=tmp();
 assert.deepEqual(readPrefs(dir),{lightMode:false});
 assert.deepEqual(writePrefs(dir,{lightMode:true,extra:'x'}),{lightMode:true});
 assert.deepEqual(readPrefs(dir),{lightMode:true});
 fs.writeFileSync(prefsFile(dir),'{quebrado');
 assert.deepEqual(readPrefs(dir),{lightMode:false});
 fs.writeFileSync(prefsFile(dir),JSON.stringify({lightMode:'true'}));
 assert.deepEqual(readPrefs(dir),{lightMode:false},'só true de verdade liga');
 fs.writeFileSync(prefsFile(dir),'null');
 assert.deepEqual(readPrefs(dir),{lightMode:false});
});

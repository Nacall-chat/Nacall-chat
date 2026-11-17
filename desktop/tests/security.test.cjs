'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {APP_URL,isAppUrl,isSafeExternalUrl}=require('../security.cjs');
test('trusted origin is exact',()=>{
 assert.equal(APP_URL,'https://nacall.vercel.app/');
 assert.equal(isAppUrl('https://nacall.vercel.app/'),true);
 assert.equal(isAppUrl('https://nacall.vercel.app/login?invite=abc'),true);
 assert.equal(isAppUrl('https://nacall.vercel.app.attacker.test/'),false);
 assert.equal(isAppUrl('http://nacall.vercel.app/'),false);
 assert.equal(isAppUrl('https://evil.test'),false);
 assert.equal(isAppUrl('not-a-url'),false);
});
test('external links are HTTPS only, without embedded credentials',()=>{
 assert.equal(isSafeExternalUrl('https://github.com/Nacall-chat/Nacall-chat'),true);
 assert.equal(isSafeExternalUrl('javascript:alert(1)'),false);
 assert.equal(isSafeExternalUrl('file:///C:/secret'),false);
 assert.equal(isSafeExternalUrl('https://user:pass@example.com'),false);
});

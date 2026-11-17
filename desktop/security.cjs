'use strict';
const APP_URL='https://nacall.vercel.app/';
const APP_ORIGIN=new URL(APP_URL).origin;
function isAppUrl(input){try{const url=new URL(input);return url.protocol==='https:'&&url.origin===APP_ORIGIN;}catch{return false;}}
function isSafeExternalUrl(input){try{const url=new URL(input);return url.protocol==='https:'&&url.hostname.length>0&&!url.username&&!url.password;}catch{return false;}}
module.exports={APP_URL,isAppUrl,isSafeExternalUrl};

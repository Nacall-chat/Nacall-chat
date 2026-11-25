'use strict';
/*
 * Regras para o NACALL gastar o mínimo de RAM, CPU e GPU enquanto a pessoa joga.
 * Tudo aqui é puro (sem Electron), para dar para testar com node --test.
 */
const fs=require('node:fs');
const path=require('node:path');

/** Funções do Chromium que só gastam memória/CPU num app de chat de uma janela só. */
const DISABLED_FEATURES=[
 'SpareRendererForSitePerProcess', // processo "reserva" sempre aberto (dezenas de MB) que nunca usamos
 'HardwareMediaKeyHandling',       // não captura as teclas de mídia (ficam para o jogo/player)
 'MediaSessionService',
 'OptimizationHints',
 'AutofillServerCommunication',
];

/** Opções da linha de comando do Chromium (valem antes do app ficar pronto). */
function chromiumSwitches(){
 return [
  ['disable-features',DISABLED_FEATURES.join(',')],
  ['disable-background-networking'], // sem buscas em segundo plano do próprio Chromium
  ['disable-component-update'],
  ['disable-breakpad'],
 ];
}

/** Preferências de desempenho da janela: estrangulamento em segundo plano e sem corretor ortográfico. */
function lightWebPreferences(){
 return {backgroundThrottling:true,spellcheck:false};
}

/** CSS colocado por cima do site no modo leve: sem animações nem desfoque (desfoque pesa na GPU). */
const LIGHT_MODE_CSS='*,*::before,*::after{animation:none!important;transition:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;scroll-behavior:auto!important}';

const DEFAULT_PREFS=Object.freeze({lightMode:false});

function prefsFile(userDataDir){return path.join(userDataDir,'nacall-desktop.json');}

/** Lê as preferências. Arquivo faltando, corrompido ou com tipos errados volta ao padrão. */
function readPrefs(userDataDir){
 try{
  const raw=JSON.parse(fs.readFileSync(prefsFile(userDataDir),'utf8'));
  return {lightMode:Boolean(raw)&&typeof raw==='object'&&raw.lightMode===true};
 }catch{return {...DEFAULT_PREFS};}
}

function writePrefs(userDataDir,prefs){
 const clean={lightMode:prefs?.lightMode===true};
 fs.mkdirSync(userDataDir,{recursive:true});
 fs.writeFileSync(prefsFile(userDataDir),JSON.stringify(clean));
 return clean;
}

module.exports={DISABLED_FEATURES,chromiumSwitches,lightWebPreferences,LIGHT_MODE_CSS,readPrefs,writePrefs,prefsFile};

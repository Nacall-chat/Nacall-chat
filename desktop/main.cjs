'use strict';
const {app,BrowserWindow,Menu,session,shell,dialog,desktopCapturer,systemPreferences}=require('electron');
const {APP_URL,isAppUrl,isSafeExternalUrl}=require('./security.cjs');
const {chromiumSwitches,lightWebPreferences,LIGHT_MODE_CSS,readPrefs,writePrefs}=require('./performance.cjs');
const isMac=process.platform==='darwin';
let mainWindow;

// Desempenho: precisa ser antes do app ficar pronto. No modo leve a GPU fica só para o jogo.
const prefs=readPrefs(app.getPath('userData'));
for(const [name,value] of chromiumSwitches())value===undefined?app.commandLine.appendSwitch(name):app.commandLine.appendSwitch(name,value);
if(prefs.lightMode)app.disableHardwareAcceleration();
if(process.platform==='win32')app.setAppUserModelId('app.nacall.desktop');

const singleInstance=app.requestSingleInstanceLock();
if(!singleInstance){app.quit();}
else {
 app.on('second-instance',()=>{if(mainWindow&&!mainWindow.isDestroyed()){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus();}});
 app.whenReady().then(()=>{configurePermissions(session.defaultSession);createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
 app.on('window-all-closed',()=>{if(!isMac)app.quit();});
}

/** No macOS o sistema pede permissão de microfone/câmera ao app; sem isso o site recebe "negado". */
async function askMacMediaAccess(mediaTypes){
 if(!isMac)return true;
 const wanted=(mediaTypes&&mediaTypes.length?mediaTypes:['audio']).map(type=>type==='video'?'camera':'microphone');
 for(const kind of new Set(wanted)){
  if(systemPreferences.getMediaAccessStatus(kind)==='granted')continue;
  if(!(await systemPreferences.askForMediaAccess(kind).catch(()=>false)))return false;
 }
 return true;
}

function configurePermissions(ses){
 const trusted=(webContents,url)=>Boolean(mainWindow&&!mainWindow.isDestroyed()&&webContents===mainWindow.webContents&&isAppUrl(url||webContents.getURL()));
 const allowed=permission=>['media','display-capture','fullscreen'].includes(permission);
 ses.setPermissionCheckHandler((webContents,permission,requestingOrigin,details)=>{
  const origin=details?.requestingUrl||requestingOrigin||webContents.getURL();
  return trusted(webContents,origin)&&allowed(permission);
 });
 ses.setPermissionRequestHandler((webContents,permission,callback,details)=>{
  const origin=details?.requestingUrl||webContents.getURL();
  if(!trusted(webContents,origin)||!allowed(permission))return callback(false);
  if(permission!=='media')return callback(true);
  void askMacMediaAccess(details?.mediaTypes).then(callback,()=>callback(false));
 });
 ses.setDisplayMediaRequestHandler(async(request,callback)=>{
  // Windows não tem o seletor do sistema no Electron: exige escolher a tela ou janela.
  // No macOS 15+ o Electron usa o seletor do próprio sistema (useSystemPicker) e só cai aqui nas versões antigas.
  if(!mainWindow||mainWindow.isDestroyed()||!request.frame||!isAppUrl(request.frame.url))return callback(null);
  try{
   const sources=(await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:0,height:0}})).slice(0,24);
   if(!sources.length)return callback(null);
   const buttons=['Cancelar',...sources.map((source,i)=>`${i+1}. ${source.name.slice(0,65)}`)];
   const answer=await dialog.showMessageBox(mainWindow,{type:'question',title:'NACALL • Compartilhar tela',message:'Escolha a tela ou janela que deseja transmitir',detail:'Somente a opção selecionada será compartilhada. Clique em Cancelar para desistir.',buttons,defaultId:0,cancelId:0,noLink:true});
   if(answer.response===0||!mainWindow||mainWindow.isDestroyed())return callback(null);
   callback({video:sources[answer.response-1]||sources[0]});
  }catch{callback(null);}
 },{useSystemPicker:isMac});
}

/** Liga/desliga o modo leve. A aceleração de GPU só muda reiniciando o app. */
async function toggleLightMode(){
 const next=writePrefs(app.getPath('userData'),{lightMode:!prefs.lightMode});
 const answer=await dialog.showMessageBox(mainWindow,{type:'info',title:'NACALL • Modo leve para jogos',message:next.lightMode?'Modo leve ligado.':'Modo leve desligado.',detail:next.lightMode?'O NACALL vai deixar de usar a placa de vídeo e desligar animações e desfoques, para sobrar mais para o jogo. Se a call travar no seu PC, desligue de novo.':'O NACALL volta a usar a placa de vídeo normalmente.',buttons:['Reiniciar agora','Depois'],defaultId:0,cancelId:1,noLink:true});
 if(answer.response===0){app.relaunch();app.exit(0);}
}

function buildMenu(wc){
 const actions=[
  {label:'Recarregar',accelerator:'CmdOrCtrl+R',click:()=>wc.reload()},
  {label:'Tela cheia',accelerator:isMac?'Ctrl+Cmd+F':'F11',click:()=>mainWindow.setFullScreen(!mainWindow.isFullScreen())},
  {label:'Modo leve para jogos',type:'checkbox',checked:prefs.lightMode,click:()=>void toggleLightMode()},
 ];
 // No macOS copiar/colar/desfazer só funcionam se existir o menu Editar.
 const template=isMac?[
  {role:'appMenu',label:'NACALL'},
  {role:'editMenu',label:'Editar'},
  {label:'Janela',submenu:[...actions,{type:'separator'},{role:'minimize',label:'Minimizar'},{role:'close',label:'Fechar janela'}]},
 ]:[{label:'NACALL',submenu:[...actions,{type:'separator'},{role:'quit',label:'Sair'}]}];
 return Menu.buildFromTemplate(template);
}

function createWindow(){
 mainWindow=new BrowserWindow({title:'NACALL',width:1320,height:820,minWidth:850,minHeight:560,backgroundColor:'#11151c',show:false,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,allowRunningInsecureContent:false,...lightWebPreferences()}});
 const wc=mainWindow.webContents;
 wc.setWindowOpenHandler(({url})=>{if(isSafeExternalUrl(url)&&!isAppUrl(url))void shell.openExternal(url);return{action:'deny'};});
 wc.on('will-navigate',(event,url)=>{if(isAppUrl(url))return;event.preventDefault();if(isSafeExternalUrl(url))void shell.openExternal(url);});
 wc.on('will-redirect',(event,url)=>{if(!isAppUrl(url)){event.preventDefault();if(isSafeExternalUrl(url))void shell.openExternal(url);}});
 if(prefs.lightMode)wc.on('dom-ready',()=>{if(isAppUrl(wc.getURL()))void wc.insertCSS(LIGHT_MODE_CSS).catch(()=>{});});
 // Se a página cair (falta de memória, driver de vídeo), volta sozinha em vez de ficar uma tela preta.
 wc.on('render-process-gone',(_event,details)=>{if(details.reason!=='clean-exit')setTimeout(()=>{if(mainWindow&&!mainWindow.isDestroyed())wc.reload();},1000);});
 mainWindow.once('ready-to-show',()=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.show();});
 wc.on('did-fail-load',(_event,errorCode,description,validatedURL,isMainFrame)=>{if(isMainFrame&&errorCode!==-3){console.error('NACALL failed to load:',errorCode,description,validatedURL);}});
 Menu.setApplicationMenu(buildMenu(wc));
 void mainWindow.loadURL(APP_URL).catch(async()=>{if(mainWindow&&!mainWindow.isDestroyed())await dialog.showMessageBox(mainWindow,{type:'error',title:'NACALL indisponível',message:'Não foi possível abrir o NACALL.',detail:`Verifique sua conexão com a internet e tente Recarregar (${isMac?'Cmd':'Ctrl'}+R).`});});
}

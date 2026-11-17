'use strict';
const {app,BrowserWindow,Menu,session,shell,dialog,desktopCapturer}=require('electron');
const {APP_URL,isAppUrl,isSafeExternalUrl}=require('./security.cjs');
let mainWindow;
const singleInstance=app.requestSingleInstanceLock();
if(!singleInstance){app.quit();}
else {
 app.on('second-instance',()=>{if(mainWindow&&!mainWindow.isDestroyed()){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus();}});
 app.whenReady().then(()=>{configurePermissions(session.defaultSession);createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
 app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
}

function configurePermissions(ses){
 const trusted=(webContents,url)=>Boolean(mainWindow&&!mainWindow.isDestroyed()&&webContents===mainWindow.webContents&&isAppUrl(url||webContents.getURL()));
 ses.setPermissionCheckHandler((webContents,permission,requestingOrigin,details)=>{
  const origin=details?.requestingUrl||requestingOrigin||webContents.getURL();
  return trusted(webContents,origin)&&['media','display-capture','fullscreen'].includes(permission);
 });
 ses.setPermissionRequestHandler((webContents,permission,callback,details)=>{
  const origin=details?.requestingUrl||webContents.getURL();
  callback(trusted(webContents,origin)&&['media','display-capture','fullscreen'].includes(permission));
 });
 ses.setDisplayMediaRequestHandler(async(request,callback)=>{
  // Windows does not currently provide the Electron system picker; require explicit selection.
  if(!mainWindow||mainWindow.isDestroyed()||!request.frame||!isAppUrl(request.frame.url))return callback(null);
  try{
   const sources=(await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:0,height:0}})).slice(0,24);
   if(!sources.length)return callback(null);
   const buttons=['Cancelar',...sources.map((source,i)=>`${i+1}. ${source.name.slice(0,65)}`)];
   const answer=await dialog.showMessageBox(mainWindow,{type:'question',title:'NACALL • Compartilhar tela',message:'Escolha a tela ou janela que deseja transmitir',detail:'Somente a opção selecionada será compartilhada. Clique em Cancelar para desistir.',buttons,defaultId:0,cancelId:0,noLink:true});
   if(answer.response===0||!mainWindow||mainWindow.isDestroyed())return callback(null);
   callback({video:sources[answer.response-1]||sources[0]});
  }catch{callback(null);}
 });
}

function createWindow(){
 mainWindow=new BrowserWindow({title:'NACALL',width:1320,height:820,minWidth:850,minHeight:560,backgroundColor:'#11151c',show:false,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,allowRunningInsecureContent:false}});
 const wc=mainWindow.webContents;
 wc.setWindowOpenHandler(({url})=>{if(isSafeExternalUrl(url)&&!isAppUrl(url))void shell.openExternal(url);return{action:'deny'};});
 wc.on('will-navigate',(event,url)=>{if(isAppUrl(url))return;event.preventDefault();if(isSafeExternalUrl(url))void shell.openExternal(url);});
 wc.on('will-redirect',(event,url)=>{if(!isAppUrl(url)){event.preventDefault();if(isSafeExternalUrl(url))void shell.openExternal(url);}});
 mainWindow.once('ready-to-show',()=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.show();});
 wc.on('did-fail-load',(_event,errorCode,description,validatedURL,isMainFrame)=>{if(isMainFrame&&errorCode!==-3){console.error('NACALL failed to load:',errorCode,description,validatedURL);}});
 const menu=Menu.buildFromTemplate([{label:'NACALL',submenu:[{label:'Recarregar',accelerator:'CmdOrCtrl+R',click:()=>wc.reload()},{label:'Tela cheia',accelerator:'F11',click:()=>mainWindow.setFullScreen(!mainWindow.isFullScreen())},{type:'separator'},{role:'quit',label:'Sair'}]}]);
 Menu.setApplicationMenu(menu);
 void mainWindow.loadURL(APP_URL).catch(async()=>{if(mainWindow&&!mainWindow.isDestroyed())await dialog.showMessageBox(mainWindow,{type:'error',title:'NACALL indisponível',message:'Não foi possível abrir o NACALL.',detail:'Verifique sua conexão com a internet e tente Recarregar (Ctrl+R).'});});
}

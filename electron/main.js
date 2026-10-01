import { app, BrowserWindow, globalShortcut, ipcMain, Menu, net, protocol, screen, session, safeStorage } from 'electron';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LIVE_TITLE, CAT_TITLE, toBroadcastState, toCatState } from '../src/broadcast.js';
import { OracleEngine } from '../src/state.js';
import { ReadingManager, testConnection, DeepSeekError } from './deepseek.js';
import { DeepSeekConfig } from './deepseek-config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const title = LIVE_TITLE;
protocol.registerSchemesAsPrivileged([{ scheme: 'oracle', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
// Keep the existing local records and encrypted key available after the product rename.
app.setPath('userData', process.env.ORACLE_DATA_DIR
  ? path.resolve(process.env.ORACLE_DATA_DIR)
  : path.join(app.getPath('appData'), 'cyber-oracle'));
app.setAppUserModelId('com.miaovis.cyber-oracle');
let controller, overlay, catWindow, engine, deepseek, readings, shortcutAvailable = false, shuttingDown = false;
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
else {
  app.on('second-instance', () => { if (controller) { controller.restore(); controller.show(); controller.focus(); } });
  app.whenReady().then(startApp);
}

function currentState() { return { ...engine.snapshot(), aiConfig:deepseek.publicState(), shortcutAvailable, overlayOpen: !!overlay && !overlay.isDestroyed(), catOpen:!!catWindow&&!catWindow.isDestroyed(), desktop: true }; }
function stateFor(window,state) { return window===overlay ? toBroadcastState(state) : window===catWindow ? toCatState(state) : state; }
function rollCurrent(draft) {
  if(engine.state.phase==='rolling')return false;
  if(draft!==undefined)engine.updateDraft(draftInput(draft));
  const accepted=engine.start();if(accepted)readings.cancel();return accepted;
}
function broadcast() {
  const state = currentState();
  for (const window of [controller, overlay, catWindow]) if (window && !window.isDestroyed()) window.webContents.send('oracle:update', stateFor(window,state));
}
function secureWindow(window) {
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('did-finish-load', broadcast);
}
function preferences() {
  return { preload: path.join(root, 'electron/preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false, spellcheck: false };
}
function overlayPosition(size) {
  const area = screen.getPrimaryDisplay().workArea;
  return { x: Math.max(area.x, area.x + area.width - size - 30), y: area.y + 50 };
}
function createOverlay() {
  if (overlay && !overlay.isDestroyed()) { overlay.show(); return; }
  const settings = engine.state.settings;
  overlay = new BrowserWindow({
    title, width: settings.size, height: settings.size, ...overlayPosition(settings.size),
    useContentSize: true, frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, maximizable: false, fullscreenable: false, hasShadow: false,
    alwaysOnTop: settings.alwaysOnTop, show: false, webPreferences: preferences(),
    icon: path.join(root, 'dist/assets/app-icon.png'),
  });
  overlay.setAspectRatio(1);
  secureWindow(overlay);
  overlay.on('page-title-updated', event => event.preventDefault());
  overlay.once('ready-to-show', () => { overlay?.showInactive(); broadcast(); });
  overlay.on('closed', () => { overlay = null; if (!shuttingDown) broadcast(); });
  overlay.loadURL('oracle://app/index.html?window=overlay');
}
function createCat() {
  if(catWindow&&!catWindow.isDestroyed()){catWindow.show();return;}
  const settings=engine.state.settings,area=screen.getPrimaryDisplay().workArea,size=settings.catSize;
  catWindow=new BrowserWindow({title:CAT_TITLE,width:size,height:size,x:area.x+30,y:Math.max(area.y,area.y+area.height-size-25),useContentSize:true,frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,maximizable:false,fullscreenable:false,hasShadow:false,alwaysOnTop:settings.catAlwaysOnTop,show:false,webPreferences:preferences(),icon:path.join(root,'dist/assets/app-icon.png')});
  catWindow.setAspectRatio(1);secureWindow(catWindow);
  catWindow.on('page-title-updated',event=>event.preventDefault());
  catWindow.once('ready-to-show',()=>{catWindow?.showInactive();broadcast();});
  catWindow.on('closed',()=>{catWindow=null;if(!shuttingDown)engine.updateSettings({catEnabled:false});});
  catWindow.loadURL('oracle://app/index.html?window=cat');
}
function applyWindowSettings(window,size,alwaysOnTop) {
  if (!window || window.isDestroyed()) return;
  window.setContentSize(size, size);
  window.setAlwaysOnTop(alwaysOnTop);
  const bounds = window.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  window.setPosition(Math.max(area.x, Math.min(bounds.x, area.x + area.width - size)), Math.max(area.y, Math.min(bounds.y, area.y + area.height - size)));
}
function applySettings() {
  const s=engine.state.settings;
  applyWindowSettings(overlay,s.size,s.alwaysOnTop);
  applyWindowSettings(catWindow,s.catSize,s.catAlwaysOnTop);
}
function authorize(event, controlOnly = true) {
  const validWindow = controlOnly ? event.sender === controller?.webContents : [controller?.webContents, overlay?.webContents, catWindow?.webContents].includes(event.sender);
  if (!validWindow || event.senderFrame !== event.sender.mainFrame || !event.senderFrame.url.startsWith('oracle://app/')) throw new Error('此操作仅供本机控制台使用');
}
function objectInput(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('无效参数'); return value; }
function draftInput(value) {const input=objectInput(value);return Object.fromEntries(['topic','nickname','question'].filter(key=>key in input).map(key=>[key,input[key]]));}

async function startApp() {
  Menu.setApplicationMenu(null);
  // 清除缓存，确保加载最新的样式
  await session.defaultSession.clearCache();
  protocol.handle('oracle', request => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('Not found', { status: 404 });
    let filename;
    try { filename = path.resolve(root, 'dist', '.' + decodeURIComponent(url.pathname)); }
    catch { return new Response('Bad request', { status: 400 }); }
    const relative = path.relative(path.join(root, 'dist'), filename);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(filename).href);
  });
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const directory = app.getPath('userData');
  mkdirSync(directory, { recursive: true });
  const stateFile = path.join(directory, 'oracle-state.json');
  let saved = {}, startupWarning = '';
  try { saved = JSON.parse(readFileSync(stateFile, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') {
      startupWarning = '旧记录未能读取，已使用默认设置；原文件将保留为备份。';
      try { renameSync(stateFile, path.join(directory, `oracle-state.unreadable-${Date.now()}.json`)); } catch { /* Keep existing file if backup cannot be created. */ }
    }
  }
  deepseek=new DeepSeekConfig(directory,safeStorage);
  engine = new OracleEngine({ saved, onResult:record=>{
    if(!deepseek.value.auto || !deepseek.value.key || !record.question.trim())return;
    try{readings.run(record.id);}catch(error){engine.updateAi(record.id,{status:'error',text:'',error:error instanceof DeepSeekError?error.message:'自动解读未启动，可手动重试。',model:deepseek.value.model,updatedAt:Date.now()});}
  }, persist: state => {
    const temporary = stateFile + '.tmp';
    writeFileSync(temporary, JSON.stringify(state, null, 2), 'utf8');
    renameSync(temporary, stateFile);
  } });
  readings=new ReadingManager({engine,config:()=>deepseek.privateState()});
  engine.state.storageError = startupWarning;
  engine.subscribe(broadcast);
  ipcMain.handle('oracle:state', event => { authorize(event, false); return stateFor(BrowserWindow.fromWebContents(event.sender),currentState()); });
  ipcMain.handle('oracle:roll', (event,draft) => { authorize(event); return rollCurrent(draft); });
  ipcMain.handle('oracle:draft', (event, value) => { authorize(event); engine.updateDraft(draftInput(value)); return currentState(); });
  ipcMain.handle('oracle:ai-settings',(event,value)=>{authorize(event);const result=deepseek.update(objectInput(value));readings.cancel();engine.publish();return result;});
  ipcMain.handle('oracle:ai-test',event=>{authorize(event);const config=deepseek.privateState();if(!config.key)throw new DeepSeekError('请先保存 API Key。');return testConnection(config);});
  ipcMain.handle('oracle:ai-read',(event,id)=>{authorize(event);if(typeof id!=='string')throw new Error('记录参数无效');return readings.run(id);});
  ipcMain.handle('oracle:ai-cancel',(event,id)=>{authorize(event);if(typeof id!=='string')throw new Error('记录参数无效');return readings.cancel(id);});
  ipcMain.handle('oracle:settings', (event, value) => { authorize(event); const input = objectInput(value); const allowed = Object.fromEntries(['size','background','chromaColor','alwaysOnTop','catSize','catBackground','catChromaColor','catAlwaysOnTop','catIdleEnabled'].filter(key => key in input).map(key => [key,input[key]])); engine.updateSettings(allowed); applySettings(); return currentState(); });
  ipcMain.handle('oracle:show', event => { authorize(event); createOverlay(); broadcast(); return true; });
  ipcMain.handle('oracle:hide', event => { authorize(event); overlay?.close(); return true; });
  ipcMain.handle('oracle:cat-show',event=>{authorize(event);engine.updateSettings({catEnabled:true});createCat();broadcast();return true;});
  ipcMain.handle('oracle:cat-hide',event=>{authorize(event);catWindow?.close();return true;});
  const area = screen.getPrimaryDisplay().workArea;
  controller = new BrowserWindow({ title: 'MiaoBaGua · 主播控制台', width: Math.min(1110, area.width), height: Math.min(900, area.height), minWidth: 780, minHeight: 620, backgroundColor: '#eee9de', show: false, webPreferences: preferences(), icon: path.join(root, 'dist/assets/app-icon.png') });
  secureWindow(controller);
  controller.once('ready-to-show', () => controller.show());
  controller.on('closed', () => app.quit());
  await controller.loadURL('oracle://app/index.html');
  createOverlay();
  if(engine.state.settings.catEnabled)createCat();
  // Ask the editor for its latest committed value before the main process rolls.
  try { shortcutAvailable = globalShortcut.register('CommandOrControl+Shift+G', () => {if(controller&&!controller.isDestroyed())controller.webContents.send('oracle:request-roll');}); }
  catch { shortcutAvailable = false; }
  broadcast();
}
app.on('before-quit', () => { shuttingDown = true; readings?.cancel(); engine?.dispose(); globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => app.quit());

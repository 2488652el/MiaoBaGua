const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('oracle', Object.freeze({
  getState: () => ipcRenderer.invoke('oracle:state'),
  roll: draft => ipcRenderer.invoke('oracle:roll',draft),
  onRollRequested: callback => {
    const listener=()=>callback();
    ipcRenderer.on('oracle:request-roll',listener);
    return ()=>ipcRenderer.removeListener('oracle:request-roll',listener);
  },
  setDraft: value => ipcRenderer.invoke('oracle:draft', value),
  setSettings: value => ipcRenderer.invoke('oracle:settings', value),
  setAiSettings: value => ipcRenderer.invoke('oracle:ai-settings', value),
  testAi: () => ipcRenderer.invoke('oracle:ai-test'),
  readAi: id => ipcRenderer.invoke('oracle:ai-read',id),
  cancelAi: id => ipcRenderer.invoke('oracle:ai-cancel',id),
  showOverlay: () => ipcRenderer.invoke('oracle:show'),
  closeOverlay: () => ipcRenderer.invoke('oracle:hide'),
  showCat: () => ipcRenderer.invoke('oracle:cat-show'),
  closeCat: () => ipcRenderer.invoke('oracle:cat-hide'),
  subscribe: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('oracle:update', listener);
    return () => ipcRenderer.removeListener('oracle:update', listener);
  },
}));

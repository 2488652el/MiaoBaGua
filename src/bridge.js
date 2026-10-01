import { OracleEngine } from './state.js';

function previewBridge() {
  const key = 'cyber-oracle-browser-preview-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch { /* Start fresh if browser storage is unavailable. */ }
  const engine = new OracleEngine({ saved, persist: state => localStorage.setItem(key, JSON.stringify(state)) });
  const augment = state => ({ ...state, desktop: false, shortcutAvailable: false, overlayOpen: false, catOpen:false });
  return {
    getState: async () => augment(engine.snapshot()),
    subscribe: callback => engine.subscribe(state => callback(augment(state))),
    roll: async draft => {if(engine.state.phase==='rolling')return false;if(draft)engine.updateDraft(draft);return engine.start();},
    onRollRequested: () => () => {},
    setDraft: async value => engine.updateDraft(value),
    setSettings: async value => engine.updateSettings(value),
    setAiSettings: async () => { throw new Error('请在桌面版配置 DeepSeek。'); },
    testAi: async () => { throw new Error('请在桌面版连接 DeepSeek。'); },
    readAi: async () => { throw new Error('请在桌面版使用 DeepSeek 解读。'); },
    cancelAi: async () => {},
    showOverlay: async () => { throw new Error('浏览器仅供预览；请运行桌面版以打开独立直播窗口。'); },
    closeOverlay: async () => {},
    showCat: async () => { throw new Error('请在桌面版打开小猫直播窗口。'); },
    closeCat: async () => {},
  };
}
export const bridge = window.oracle || previewBridge();

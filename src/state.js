import { cast, randomCast } from './oracle.js';
import { TOPICS, interpret } from './readings.js';
import { makeLiveResult } from './broadcast.js';
import { DICE_SETTLE_MS, DICE_START_DELAY_MS, CAST_DURATION_MS } from './motion-timing.js';
import { cleanQuestion, cleanAi } from './ai-record.js';

export const SIZES = [240, 360, 480, 720];
export const DEFAULT_SETTINGS = { size: 480, background: 'chroma', chromaColor: '#ff00ff', alwaysOnTop: true, catEnabled:true, catSize:360, catBackground:'transparent', catChromaColor:'#ff00ff', catAlwaysOnTop:true, catIdleEnabled:true };
export function cleanDraft(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  return { topic: TOPICS.some(t => t.id === value.topic) ? value.topic : 'today', nickname: typeof value.nickname === 'string' ? [...value.nickname.replace(/[\u0000-\u001f\u007f]/g, '').trim()].slice(0, 24).join('') : '', question: cleanQuestion(value.question) };
}
export function cleanSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  return { size: SIZES.includes(value.size) ? value.size : 480, background: value.background === 'transparent' ? 'transparent' : 'chroma', chromaColor: /^#[0-9a-f]{6}$/i.test(value.chromaColor || '') ? value.chromaColor : '#ff00ff', alwaysOnTop: typeof value.alwaysOnTop === 'boolean' ? value.alwaysOnTop : true,
    catEnabled:typeof value.catEnabled==='boolean'?value.catEnabled:true,
    catSize:SIZES.includes(value.catSize)?value.catSize:360,
    catBackground:value.catBackground==='chroma'?'chroma':'transparent',
    catChromaColor:/^#[0-9a-f]{6}$/i.test(value.catChromaColor||'')?value.catChromaColor:'#ff00ff',
    catAlwaysOnTop:typeof value.catAlwaysOnTop==='boolean'?value.catAlwaysOnTop:true,
    catIdleEnabled:typeof value.catIdleEnabled==='boolean'?value.catIdleEnabled:true,
  };
}
export function restoreRecord(row) {
  if (!row || !Number.isFinite(row.time) || typeof row.id !== 'string' || row.id.length > 80) throw new Error('无效记录');
  const result = cast(row.upperIndex, row.lowerIndex, row.moving);
  const draft = cleanDraft(row);
  return { ...result, ...draft, id: row.id, time: row.time, reading: interpret(result, draft.topic), ...(row.ai ? {ai:cleanAi(row.ai,true)} : {}) };
}
export function compactRecord({ upperIndex, lowerIndex, moving, topic, nickname, question, id, time, ai }) { return { upperIndex, lowerIndex, moving, topic, nickname, question, id, time, ...(ai ? {ai:cleanAi(ai)} : {}) }; }

export class OracleEngine {
  constructor({ saved = {}, persist = () => {}, draw = randomCast, now = Date.now, timers = globalThis, onResult = () => {} } = {}) {
    this.listeners = new Set(); this.persist = persist; this.draw = draw; this.now = now; this.timers = timers;
    this.onResult = onResult;
    const history = Array.isArray(saved?.history) ? saved.history.slice(0, 30).flatMap(row => { try { return [restoreRecord(row)]; } catch { return []; } }) : [];
    this.state = { liveResult:makeLiveResult(history[0]), revision: 0, phase: history.length ? 'result' : 'idle', result: history[0] || null, display: history[0]?.base || null, history, draft: cleanDraft(saved?.draft), settings: cleanSettings(saved?.settings), storageError: '' };
  }
  snapshot() { return { ...this.state }; }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  publish(patch = {}) {
    this.state = { ...this.state, ...patch, revision: this.state.revision + 1 };
    for (const listener of this.listeners) listener(this.snapshot());
  }
  save() {
    try { this.persist({ version: 1, history: this.state.history.map(compactRecord), draft: this.state.draft, settings: this.state.settings }); this.state.storageError = ''; }
    catch { this.state.storageError = '本次结果可正常显示，但记录未能保存到本机。请检查磁盘空间和写入权限。'; }
  }
  updateDraft(value) { this.state.draft = cleanDraft({ ...this.state.draft, ...value }); this.save(); this.publish(); }
  updateSettings(value) { this.state.settings = cleanSettings({ ...this.state.settings, ...value }); this.save(); this.publish(); }
  updateAi(id, value, persist=true) {
    const ai=cleanAi(value);
    if (!ai || !this.state.history.some(row=>row.id===id)) return false;
    const history=this.state.history.map(row=>row.id===id ? {...row,ai} : row);
    this.state={...this.state,history,result:this.state.result?.id===id ? history.find(row=>row.id===id) : this.state.result};
    if (persist) this.save();
    this.publish();
    return true;
  }
  start() {
    if (this.state.phase === 'rolling') return false;
    const result = this.draw();
    const time = this.now();
    const pending = { ...result, ...this.state.draft, time, id: globalThis.crypto.randomUUID(), reading: interpret(result, this.state.draft.topic) };
    const diceValues = value => ({ upper: value.upper, lower: value.lower, moving: value.moving });
    // The face values stay attached to the same physical faces throughout the throw.
    this.publish({ liveResult:makeLiveResult(pending), phase: 'rolling', display: pending.base, dice: diceValues(pending), diceSettled: false, diceMotion: { id: pending.id, startedAt: time + DICE_START_DELAY_MS } });
    let frames = 0;
    this.interval = this.timers.setInterval(() => {
      const settled = ++frames >= 13;
      if (settled) this.publish({ diceSettled: true });
      if (settled) { this.timers.clearInterval(this.interval); this.interval = null; }
    }, DICE_SETTLE_MS / 13);
    this.timeout = this.timers.setTimeout(() => {
      this.timers.clearInterval(this.interval); this.interval = null; this.timeout = null;
      this.state = { ...this.state, phase: 'result', result: pending, display: pending.base, dice: null, diceSettled: false, diceMotion: null, history: [pending, ...this.state.history].slice(0,30) };
      this.save(); this.publish();
      this.onResult(pending);
    }, CAST_DURATION_MS);
    return true;
  }
  dispose() { this.timers.clearInterval(this.interval); this.timers.clearTimeout(this.timeout); this.listeners.clear(); }
}

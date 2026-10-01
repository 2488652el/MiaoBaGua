import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OracleEngine, cleanSettings,compactRecord } from '../src/state.js';
import { cast } from '../src/oracle.js';

function harness(saved = {}, persist = () => {}) {
  let finish, animate;
  const timers = { setTimeout: fn => (finish=fn,1), clearTimeout: () => {finish=null;}, setInterval: fn => (animate=fn,2), clearInterval: () => {animate=null;} };
  const engine = new OracleEngine({ saved, persist, timers, draw: () => cast(0,1,3), now: () => 1790550000000 });
  return { engine, finish: () => { const fn=finish; finish=null; fn?.(); }, animate: () => animate?.() };
}
test('重复触发被锁定，主题昵称固定，两个订阅端收到同一结果', () => {
  const {engine, finish, animate} = harness();
  const a=[],b=[]; engine.subscribe(s=>a.push(s)); engine.subscribe(s=>b.push(s));
  engine.updateDraft({nickname:'小满',topic:'love'});
  assert.equal(engine.start(),true); assert.equal(engine.start(),false);
  engine.updateDraft({nickname:'下一位',topic:'career'}); animate(); finish();
  assert.equal(engine.state.result.nickname,'小满'); assert.equal(engine.state.result.topic,'love');
  assert.equal(engine.state.draft.nickname,'下一位'); assert.equal(engine.state.history.length,1);
  assert.equal(engine.state.phase,'result'); assert.deepEqual(engine.state.display,engine.state.result.base);
  assert.deepEqual(a,b); assert.equal(engine.start(),true); engine.dispose();
});
test('三个骰面同步发送，先停在真实结果再切回本卦', () => {
  const { engine, animate, finish } = harness();
  engine.start();
  assert.equal(engine.state.diceSettled,false);
  assert.deepEqual(engine.state.dice,{upper:cast(0,1,3).upper,lower:cast(0,1,3).lower,moving:3});
  for (let i=0;i<13;i++) animate();
  assert.equal(engine.state.phase,'rolling');
  assert.equal(engine.state.diceSettled,true);
  assert.equal(engine.state.display.fullName,'天地否');
  assert.equal(engine.start(),false);
  finish();
  assert.equal(engine.state.phase,'result');
  assert.equal(engine.state.dice,null);
  assert.equal(engine.state.result.upper.name,'乾');
  assert.equal(engine.state.result.lower.name,'坤');
  assert.equal(engine.state.result.moving,3);
});
test('重启恢复最近结果，保存最近30条及设置', () => {
  let saved;
  const { engine, finish } = harness({}, s => { saved=structuredClone(s); });
  engine.updateSettings({size:360,background:'transparent',alwaysOnTop:false});
  for (let i=0;i<35;i++) { engine.updateDraft({nickname:`观众${i}`}); engine.start(); finish(); }
  assert.equal(saved.history.length,30); assert.equal(saved.history[0].nickname,'观众34');
  const restored = new OracleEngine({saved});
  assert.deepEqual(restored.state.result,engine.state.result); assert.equal(restored.state.settings.size,360);
  assert.equal(restored.state.settings.background,'transparent'); assert.equal(restored.state.settings.alwaysOnTop,false);
});
test('坏记录与非法设置不会导致启动失败', () => {
  const {engine} = harness({history:[null,{upperIndex:50,time:1,id:'x'}],settings:{size:999,background:'invalid',chromaColor:'javascript:x'},draft:null});
  assert.equal(engine.state.history.length,0); assert.equal(engine.state.phase,'idle');
  assert.deepEqual(engine.state.settings,cleanSettings());
  assert.doesNotThrow(()=>new OracleEngine({saved:null}));
});

test('历史结果按动爻为体重算，旧AI原文保留且规则版本为空',()=>{
  const oldAnswer={status:'success',text:'旧答案：上卦为体，下卦为用。',model:'deepseek-flash',updatedAt:1};
  const saved={history:[{upperIndex:0,lowerIndex:1,moving:3,id:'legacy',time:1,question:'原问题',topic:'career',ai:oldAnswer}]};
  const engine=new OracleEngine({saved});const result=engine.state.result;
  assert.equal(result.body.name,'坤');assert.equal(result.bodyPosition,'下卦');assert.equal(result.use.name,'乾');assert.equal(result.relation.name,'体生用');
  assert.equal(result.reading.action,'检查任务投入与精力安排，及时说明工作边界。');
  assert.equal(result.ai.text,oldAnswer.text);assert.equal(result.ai.ruleVersion,'');
  const twice=new OracleEngine({saved:{history:[compactRecord(result)]}});
  assert.deepEqual(twice.state.result,result);
});
test('持久化失败不阻止起卦；中途退出不会保存未完成结果', () => {
  const {engine,finish} = harness({},()=>{throw new Error('disk full');});
  engine.start(); finish(); assert.equal(engine.state.phase,'result'); assert.ok(engine.state.storageError);
  let writes=0;
  const second=harness({},()=>writes++); second.engine.start(); second.engine.dispose(); second.finish();
  assert.equal(writes,0); assert.equal(second.engine.state.history.length,0);
});

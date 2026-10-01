import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OracleEngine, cleanSettings } from '../src/state.js';
import { CAT_TITLE, toCatState } from '../src/broadcast.js';
import { CAT_MOTION_DURATION, CAT_STAGES, CAT_CHANNELS, CAT_KEY_TIMES, CAT_IDLE_ACTIONS, CAT_IDLE_SLOT_MS, getCatIdleCue, sampleCatMotion, sampleCatIdle, sampleCatPlayback } from '../src/cat-motion.js';
import { CAT_SKELETON, solveCatPose, transformPoint } from '../src/cat-rig.js';
import { DICE_START_DELAY_MS, CAST_DURATION_MS, RESULT_REVEAL_START_MS } from '../src/motion-timing.js';

test('小猫只接收投掷时钟和自己的显示设置，不含问题、结果或AI数据',()=>{
  const engine=new OracleEngine();engine.state.draft={question:'私人问题',nickname:'私人昵称'};
  engine.state.diceMotion={id:'current',startedAt:123,secret:'不能发送'};
  const state=toCatState(engine.snapshot());
  assert.deepEqual(Object.keys(state).sort(),['diceMotion','phase','revision','settings']);
  assert.deepEqual(state.diceMotion,{id:'current',startedAt:123});
  assert.deepEqual(state.settings,{size:360,background:'transparent',chromaColor:'#ff00ff',idleEnabled:true});
  assert.doesNotMatch(JSON.stringify({state,CAT_TITLE}),/私人|不能发送|卦|爻|解读/);
});
test('小猫独立设置校验、保存及旧版设置恢复',()=>{
  let saved;const engine=new OracleEngine({persist:value=>{saved=value;}});
  engine.updateSettings({catSize:720,catEnabled:false,catBackground:'chroma',catChromaColor:'#336699',catAlwaysOnTop:false,catIdleEnabled:false});
  const restored=new OracleEngine({saved});assert.deepEqual(restored.state.settings,engine.state.settings);assert.equal(restored.state.settings.size,480);
  const invalid=cleanSettings({catSize:-1,catEnabled:'no',catBackground:'url(x)',catChromaColor:'bad',catAlwaysOnTop:1});
  assert.equal(invalid.catSize,360);assert.equal(invalid.catEnabled,true);assert.equal(invalid.catBackground,'transparent');assert.equal(invalid.catChromaColor,'#ff00ff');assert.equal(invalid.catAlwaysOnTop,true);
  assert.equal(invalid.catIdleEnabled,true);assert.equal(restored.state.settings.catIdleEnabled,false);
});
test('小猫揭晓与原动画共享时刻，完整动作在结束前收回',()=>{
  assert.equal(CAT_STAGES.at(-1).at,RESULT_REVEAL_START_MS);
  assert.ok(CAT_MOTION_DURATION+DICE_START_DELAY_MS<=CAST_DURATION_MS);
  assert.ok(CAT_STAGES.every((s,i)=>i===0||s.at>CAT_STAGES[i-1].at));
});
test('所有动作连接点的位置及速度连续，盅和头不会瞬移',()=>{
  const points=new Set([...CAT_KEY_TIMES,...CAT_STAGES.map(s=>s.at)]),h=.01;
  for(const t of points){if(t===0||t===CAT_MOTION_DURATION)continue;
    const a=sampleCatMotion(t-h),b=sampleCatMotion(t),c=sampleCatMotion(t+h);
    for(const k of CAT_CHANNELS){
      assert.ok(Math.abs(c[k]-a[k])<.01,`${k} jumps at ${t}`);
      assert.ok(Math.abs((b[k]-a[k])/h-(c[k]-b[k])/h)<.001,`${k} velocity jumps at ${t}`);
    }
  }
  for(let t=0;t<=CAT_MOTION_DURATION;t+=8){const p=sampleCatMotion(t),r=sampleCatMotion(t,true);assert.deepEqual(p,sampleCatMotion(t));
    assert.ok(Math.abs(p.cupX)<=28+1e-9&&Math.abs(p.cupY)<=38+1e-9&&Math.abs(p.headAngle)<=9+1e-9);
    for(const k of CAT_CHANNELS)assert.ok(Number.isFinite(p[k])&&Math.abs(r[k])<=Math.abs(p[k]));
  }
});
test('开始、结束与待机衔接，重开或更新问题不重置轨迹',()=>{
  const motion={id:'same',startedAt:999123};
  for(const elapsed of [-10,0,CAT_MOTION_DURATION,CAT_MOTION_DURATION+10]){
    const now=motion.startedAt+elapsed,idle=sampleCatIdle(now),p=sampleCatPlayback(now,motion,true);
    for(const k of CAT_CHANNELS)assert.equal(p[k],idle[k]);
  }
  const now=motion.startedAt+3000;
  assert.deepEqual(sampleCatPlayback(now,motion,true),sampleCatPlayback(now,{...motion},true));
  assert.ok(sampleCatIdle(2720).blink>.9);assert.equal(sampleCatIdle(2720,true,false).blink,0);
});

test('随机待机动作不连续重复，每组均覆盖七种动作，双窗口可按时钟恢复',()=>{
  const origin=198750000;let previous;const startTimes=new Set(),durations=new Set();
  for(let bag=origin;bag<origin+40;bag++){
    const names=new Set();
    for(let index=0;index<CAT_IDLE_ACTIONS.length;index++){
      const time=(bag*CAT_IDLE_ACTIONS.length+index)*CAT_IDLE_SLOT_MS,cue=getCatIdleCue(time);
      assert.notEqual(cue.name,previous);previous=cue.name;names.add(cue.name);
      assert.deepEqual(cue,getCatIdleCue(time));
      assert.ok(cue.start-time>=700&&cue.start-time<=2100&&cue.duration>=3000&&cue.duration<=4500);
      startTimes.add(cue.start-time);durations.add(cue.duration);
      const p=sampleCatIdle(cue.start+cue.duration*.5),r=sampleCatIdle(cue.start+cue.duration*.5,true);
      assert.equal(p.idleAction,cue.name);assert.deepEqual(p,sampleCatIdle(cue.start+cue.duration*.5));
      for(const k of CAT_CHANNELS){assert.ok(Number.isFinite(p[k]));assert.ok(Math.abs(r[k])<=Math.abs(p[k]));}
    }
    assert.equal(names.size,CAT_IDLE_ACTIONS.length);
  }
  assert.ok(startTimes.size>100&&durations.size>100);
});
test('随机动作出入、时段边界和中途起摇均平滑，关闭后可完全安静待机',()=>{
  const h=.02;
  for(let slot=200000000;slot<200000070;slot++){
    const cue=getCatIdleCue(slot*CAT_IDLE_SLOT_MS);
    for(const t of [slot*CAT_IDLE_SLOT_MS,cue.start,cue.start+cue.duration]){
      const a=sampleCatIdle(t-h),b=sampleCatIdle(t),c=sampleCatIdle(t+h);
      for(const k of CAT_CHANNELS){
        assert.ok(Math.abs(c[k]-a[k])<.01,`${k} idle position jump at ${t}: ${Math.abs(c[k]-a[k])}`);
        assert.ok(Math.abs((b[k]-a[k])/h-(c[k]-b[k])/h)<.001,`${k} idle velocity jump at ${t}`);
      }
    }
    const time=cue.start+cue.duration*.5,motion={id:'interrupt-idle',startedAt:time};
    const paused=sampleCatIdle(time,false,false),idle=sampleCatIdle(time),start=sampleCatPlayback(time,motion,true);
    for(const k of CAT_CHANNELS){assert.equal(paused[k],0);assert.equal(start[k],idle[k]);}
    assert.equal(paused.idleAction,'paused');assert.equal(sampleCatPlayback(time+600,motion,true).idleAction,'casting');
  }
});


const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function* poses(step=16){
  for(const reduced of [false,true]){
    for(let t=0;t<=CAT_MOTION_DURATION;t+=step)yield sampleCatMotion(t,reduced);
    for(let slot=0;slot<14;slot++){const cue=getCatIdleCue(slot*CAT_IDLE_SLOT_MS);for(let t=cue.start;t<=cue.start+cue.duration;t+=step*4)yield sampleCatIdle(t,reduced);}
  }
}
test('仅摇盅时胸腹、头和尾严格静止，双臂独立屈伸',()=>{
  const base=solveCatPose(),moved=solveCatPose({cupX:20,cupY:-20,cupAngle:9});
  for(const layer of ['body','head','tail','feetMatrix'])assert.deepEqual(moved[layer],base[layer],layer+' must ignore hand inputs');
  for(const point of [[280,305],[282,382],[325,408]])assert.deepEqual(transformPoint(moved.body,point),point,'belly cannot follow the cup');
  assert.ok(distance(transformPoint(moved.grip,CAT_SKELETON.grip.center),CAT_SKELETON.grip.center)>25);
  for(const side of ['near','far']){
    assert.deepEqual(moved.arms[side].shoulder,base.arms[side].shoulder);
    assert.ok(distance(moved.arms[side].elbow,base.arms[side].elbow)>3);
    assert.ok(Math.abs(moved.arms[side].foreAngle-base.arms[side].foreAngle)>.1);
  }
});
test('所有动作双臂可达，上臂前臂长度固定，腕点精确连接抱盅爪子',()=>{
  for(const pose of poses()){
    const rig=solveCatPose(pose);assert.equal(rig.reachable,true,'unreachable target at '+pose.elapsed);
    for(const side of ['near','far']){
      const a=rig.arms[side];
      assert.ok(Math.abs(distance(a.shoulder,a.elbow)-a.lengths[0])<1e-8);
      assert.ok(Math.abs(distance(a.elbow,a.wrist)-a.lengths[1])<1e-8);
      assert.deepEqual(a.wrist,transformPoint(rig.grip,CAT_SKELETON.grip.wrists[side]));
      assert.deepEqual(a.shoulder,transformPoint(rig.body,CAT_SKELETON.arms[side].shoulder));
    }
  }
});
test('头、躯干、杯和爪子只平移旋转，不能缩放或剪切；脚层固定',()=>{
  for(const pose of poses()){
    const rig=solveCatPose(pose);
    for(const name of ['body','head','grip','tail']){
      const [a,b,c,d]=rig[name];assert.ok(Math.abs(a*a+b*b-1)<1e-10);assert.ok(Math.abs(c*c+d*d-1)<1e-10);
      assert.ok(Math.abs(a*c+b*d)<1e-10);assert.ok(Math.abs(a*d-b*c-1)<1e-10);
    }
    assert.deepEqual(rig.feetMatrix,[1,0,0,1,0,0]);
  }
});
test('慢摇和快摇杯子相对躯干移动，身体摆幅不能冒充手部行程',()=>{
  for(const [from,to] of [[800,1720],[2840,3560]]){
    const cups=[],chests=[],angles={near:[],far:[]};
    for(let t=from;t<=to;t+=8){
      const p=sampleCatMotion(t),r=solveCatPose(p);cups.push(p.cupX);chests.push(transformPoint(r.body,[280,305])[0]);
      for(const side of ['near','far'])angles[side].push(r.arms[side].foreAngle-r.arms[side].upperAngle);
    }
    const span=x=>Math.max(...x)-Math.min(...x);
    assert.ok(span(cups)>38&&span(cups)<55);
    assert.ok(span(chests)>8&&span(chests)<18,'shoulders visibly support the effort without dominating it');
    assert.ok(span(cups)>span(chests)*2.5,'hand movement remains independent and larger than shoulder travel');
    for(const side of ['near','far'])assert.ok(span(angles[side])>.35,side+' elbow must actually bend');
  }
});
test('提盅倾听和放下有清楚的手部高度变化，完整演出沿用共享时钟',()=>{
  assert.deepEqual(CAT_STAGES.map(({at,name})=>[at,name]),[[0,'prepare'],[550,'shake'],[2140,'listen'],[2580,'shake'],[3950,'place'],[4680,'wait'],[5200,'reveal']]);
  assert.equal(CAT_MOTION_DURATION,6220);
  const held=sampleCatMotion(2250),lower=sampleCatMotion(4450);
  assert.ok(held.cupY<-32&&lower.cupY-held.cupY>35);
  for(const key of ['cupX','cupY','cupAngle','bodyY','bodyAngle'])assert.equal(held[key],sampleCatMotion(2250,true)[key]);
});
test('不可达目标明确报错，不能拉长手臂或偷偷拆开手腕与盅',()=>{
  const rig=solveCatPose({cupX:300});assert.equal(rig.reachable,false);
  for(const side of ['near','far']){assert.equal(rig.arms[side].elbow,null);assert.deepEqual(rig.arms[side].wrist,transformPoint(rig.grip,CAT_SKELETON.grip.wrists[side]));}
});

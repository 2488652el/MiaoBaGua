import { RESULT_REVEAL_START_MS, RESULT_REVEAL_DURATION_MS } from './motion-timing.js';

export const CAT_MOTION_DURATION = RESULT_REVEAL_START_MS + RESULT_REVEAL_DURATION_MS;
export const CAT_STAGES = Object.freeze([
  {at:0,name:'prepare'},{at:550,name:'shake'},{at:2140,name:'listen'},
  {at:2580,name:'shake'},{at:3950,name:'place'},{at:4680,name:'wait'},
  {at:RESULT_REVEAL_START_MS,name:'reveal'},
]);
export const CAT_CHANNELS = Object.freeze(['rootY','bodyY','bodyAngle','headX','headY','headAngle','cupX','cupY','cupAngle','tail','scarf','blink']);
export const neutralCatPose = () => Object.fromEntries(CAT_CHANNELS.map(k=>[k,0]));
const clamp = v => Math.max(0,Math.min(1,v));
export const ease = v => {const t=clamp(v);return t*t*t*(10+t*(-15+6*t));};

// One drawing, continuous joint trajectories. Each track uses shape-preserving
// Hermite tangents, so position AND velocity agree at every key boundary.
const keys = [
  [0,{}], [230,{bodyY:5,headY:3,cupY:5}],
  [550,{bodyY:-5,headAngle:-1,cupY:-13}],
  [1750,{bodyY:-5,headAngle:-1,cupY:-13}],
  [2140,{bodyY:-4,headX:2,headY:2,headAngle:4,cupX:3,cupY:-18,cupAngle:-7}],
  [2430,{bodyY:-4,headX:2,headY:2,headAngle:4,cupX:3,cupY:-18,cupAngle:-7}],
  [2580,{bodyY:-5,headAngle:-1,cupY:-13}],
  [3650,{bodyY:-5,headAngle:-1,cupY:-13}],
  [3950,{bodyY:-3,headY:-1,cupY:-13,cupAngle:-2}],
  [4230,{bodyY:-5,headY:-3,cupY:-15}],
  [4540,{bodyY:6,headY:5,headAngle:2,cupY:17,cupAngle:3}],
  [4710,{bodyY:2,headY:4,headAngle:2,cupY:12}],
  [5030,{bodyY:2,headY:4,headAngle:2,cupY:12}],
  [5200,{bodyY:1,headY:2,headAngle:1,cupY:8}],
  [5430,{bodyY:3,headY:2,cupY:5}],
  [5570,{rootY:-8,bodyY:-1,headY:-3,headAngle:-3,cupY:-3}],
  [5780,{bodyY:2,headY:1,cupY:3}],
  [6010,{}], [CAT_MOTION_DURATION,{}],
].map(([at,values])=>({at,values:{...neutralCatPose(),...values}}));
export const CAT_KEY_TIMES = Object.freeze(keys.map(k=>k.at));
const slopes = CAT_CHANNELS.map(channel=>{
  const delta=keys.slice(1).map((b,i)=>(b.values[channel]-keys[i].values[channel])/(b.at-keys[i].at));
  return keys.map((_,i)=>{
    if(!i||i===keys.length-1||delta[i-1]*delta[i]<=0)return 0;
    const prev=keys[i].at-keys[i-1].at,next=keys[i+1].at-keys[i].at;
    const w1=2*next+prev,w2=next+2*prev;
    return (w1+w2)/(w1/delta[i-1]+w2/delta[i]);
  });
});
function trackAt(ms){
  let i=0;while(i<keys.length-2&&ms>=keys[i+1].at)i++;
  const a=keys[i],b=keys[i+1],span=b.at-a.at,t=clamp((ms-a.at)/span),t2=t*t,t3=t2*t;
  const pose={};
  CAT_CHANNELS.forEach((channel,c)=>{
    pose[channel]=(2*t3-3*t2+1)*a.values[channel]+(t3-2*t2+t)*span*slopes[c][i]+(-2*t3+3*t2)*b.values[channel]+(t3-t2)*span*slopes[c][i+1];
  });
  return pose;
}
function shake(ms,start,end,period){
  const t=ms-start;
  const envelope=ease(t/260)*ease((end-ms)/310);
  return {envelope,phase:t/period*Math.PI*2};
}
export function sampleCatMotion(elapsed,reduced=false){
  const ms=Math.max(0,Math.min(CAT_MOTION_DURATION,elapsed)),pose=trackAt(ms);
  let stage=CAT_STAGES[0].name;for(const s of CAT_STAGES)if(ms>=s.at)stage=s.name;
  for(const [start,end,period] of [[550,2140,680],[2580,3950,510]]){
    if(ms<start||ms>end)continue;
    const {envelope:e,phase:p}=shake(ms,start,end,period);
    pose.cupX+=Math.sin(p)*16*e;pose.cupY+=Math.sin(p*2)*5*e;pose.cupAngle+=Math.sin(p+.15)*11*e;
    pose.bodyAngle+=Math.sin(p-.35)*3.6*e;pose.bodyY-=Math.sin(p)**2*3*e;
    pose.headAngle+=Math.sin(p-.7)*2.1*e;pose.headX+=Math.sin(p-.7)*1.2*e;
    pose.scarf+=Math.sin(p-1.05)*4*e;pose.tail+=Math.sin(p-1.3)*4.5*e;
  }
  pose.tail+=Math.sin(ms/900)*ease(ms/350)*ease((CAT_MOTION_DURATION-ms)/450)*2;
  // A deliberate throw must retain its readable hand/cup stroke even when
  // Windows desktop animations are disabled. Soften only secondary motion.
  if(reduced)for(const key of ['rootY','headX','headY','headAngle','tail','scarf'])pose[key]*=.65;
  return {...pose,stage,elapsed:ms};
}
function blinkAt(ms,start){return ease((ms-start)/90)*ease((start+240-ms)/130);}
export const CAT_IDLE_SLOT_MS=9000;
export const CAT_IDLE_ACTIONS=Object.freeze(['look-around','curious-tilt','inspect-cup','adjust-hold','tail-swish','sleepy-nod','stretch']);
const hash=n=>{let x=n|0;x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return (x^(x>>>16))>>>0;};
function shuffledBag(bag){
  const actions=[...CAT_IDLE_ACTIONS];
  for(let i=actions.length-1;i>0;i--){const j=hash(bag^Math.imul(i,0x9e3779b9))%(i+1);[actions[i],actions[j]]=[actions[j],actions[i]];}
  return actions;
}
let cachedBag,bagActions;
export function getCatIdleCue(time){
  const slot=Math.floor(time/CAT_IDLE_SLOT_MS),bag=Math.floor(slot/CAT_IDLE_ACTIONS.length);
  if(bag!==cachedBag){
    bagActions=shuffledBag(bag);
    // Swapping only the first two leaves each bag's last entry stable, so
    // adjacent bags never repeat an action and no recursive history is needed.
    if(bagActions[0]===shuffledBag(bag-1).at(-1))[bagActions[0],bagActions[1]]=[bagActions[1],bagActions[0]];
    cachedBag=bag;
  }
  const start=slot*CAT_IDLE_SLOT_MS+700+hash(slot^0x416bc)%1401;
  const duration=3000+hash(slot^0x813fa)%1501;
  const progress=(time-start)/duration;
  return {name:bagActions[((slot%CAT_IDLE_ACTIONS.length)+CAT_IDLE_ACTIONS.length)%CAT_IDLE_ACTIONS.length],slot,start,duration,progress,
    direction:hash(slot^0x275ad)&1?1:-1,strength:.85+(hash(slot^0x721ed)%151)/1000,active:progress>=0&&progress<=1};
}
function addIdleGesture(pose,cue){
  if(!cue.active)return;
  const p=cue.progress,e=ease(p/.27)*ease((1-p)/.3)*cue.strength,d=cue.direction,w=Math.sin(p*Math.PI*2);
  switch(cue.name){
    case 'look-around':
      pose.headAngle+=4.1*w*e*d;pose.headX+=1.5*w*e*d;pose.bodyAngle+=.3*w*e*d;break;
    case 'curious-tilt':
      pose.headAngle+=4.2*e*d;pose.headX+=1.2*e*d;pose.headY-=.6*e;pose.tail+=1.4*e*d;break;
    case 'inspect-cup':
      pose.headY+=4.8*e;pose.headAngle+=2.2*e;pose.headX+=1.2*e;pose.cupY-=5.5*e;pose.cupAngle-=3*e;pose.bodyY+=1.1*e;break;
    case 'adjust-hold':
      pose.cupY+=(-5+2*w)*e;pose.cupX+=1.8*w*e;pose.cupAngle+=2.2*w*e;pose.headY+=e;pose.bodyY-=e;break;
    case 'tail-swish':
      pose.tail+=3.8*Math.sin(p*Math.PI*4)*e;pose.bodyAngle+=.45*w*e;pose.headAngle-=.65*w*e;pose.scarf+=.8*w*e;break;
    case 'sleepy-nod':
      pose.bodyY+=1.8*e;pose.headY+=3.5*e;pose.headAngle+=1.6*e*d;pose.blink=Math.max(pose.blink,.97*ease(p/.26)*ease((1-p)/.25));break;
    case 'stretch':
      pose.bodyY-=3*e;pose.headY-=2.3*e;pose.headAngle-=1.1*e*d;pose.cupY-=2.6*e;pose.tail+=2*e*d;pose.scarf+=.6*e;break;
  }
}
export function sampleCatIdle(time,reduced=false,enabled=true){
  const ms=((time%12000)+12000)%12000,pose=neutralCatPose();
  const gain=clamp(Number(enabled)),cue=getCatIdleCue(time);
  if(gain){
    pose.bodyY=-.8*(1-Math.cos(ms/4000*Math.PI*2));
    pose.headY=-.35*(1-Math.cos(ms/4000*Math.PI*2-.2));
    pose.tail=Math.sin(ms/6000*Math.PI*2)*1.7;
    pose.scarf=Math.sin(ms/4000*Math.PI*2-.45)*.45;
    pose.blink=Math.max(blinkAt(ms,2600),blinkAt(ms,6500),blinkAt(ms,6930));
    addIdleGesture(pose,cue);
    // This explicitly enabled feature has its own pause switch. The OS hint
    // reduces travel while retaining gentle idle activity and natural blinking.
    for(const key of CAT_CHANNELS)pose[key]*=gain*(reduced&&key!=='blink'?.45:1);
  }
  return {...pose,stage:'idle',elapsed:ms,idleAction:!gain?'paused':cue.active?cue.name:'breathing',idleProgress:clamp(cue.progress)};
}
export function sampleCatPlayback(now,motion,rolling,reduced=false,idleEnabled=true){
  const idle=sampleCatIdle(now,reduced,idleEnabled);
  if(!rolling||!motion?.startedAt)return idle;
  const elapsed=now-motion.startedAt,active=sampleCatMotion(elapsed,reduced);
  const weight=ease(elapsed/300)*ease((CAT_MOTION_DURATION-elapsed)/380);
  for(const key of CAT_CHANNELS)active[key]=idle[key]+(active[key]-idle[key])*weight;
  return {...active,idleAction:'casting',idleProgress:0};
}

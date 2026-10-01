import { RESULT_REVEAL_START_MS, RESULT_REVEAL_DURATION_MS } from './motion-timing.js';

export const CAT_MOTION_DURATION = RESULT_REVEAL_START_MS + RESULT_REVEAL_DURATION_MS;
export const CAT_STAGES = Object.freeze([
  {at:0,name:'prepare'},{at:550,name:'shake'},{at:2140,name:'listen'},
  {at:2580,name:'shake'},{at:3950,name:'place'},{at:4680,name:'wait'},
  {at:RESULT_REVEAL_START_MS,name:'reveal'},
]);
// All offsets are in the original drawing's 512-unit space. The cup remains
// relative to the torso. Separate articulated arms connect shoulders to paws.
export const CAT_CHANNELS = Object.freeze([
  'rootY','bodyY','bodyAngle','headX','headY','headAngle',
  'cupX','cupY','cupAngle','tail','scarf','blink',
  'earL','earR','pupilX','pupilY','tailCurl',
]);
export const neutralCatPose = () => Object.fromEntries(CAT_CHANNELS.map(k=>[k,0]));
const clamp = v => Math.max(0,Math.min(1,v));
export const ease = v => {const t=clamp(v);return t*t*t*(10+t*(-15+6*t));};

// A held object has weight: gather it in, lift slightly, listen by lowering the
// head, then let the body settle. Hermite interpolation preserves both position
// and velocity at every beat; the two shakes are layered over this hand action.
const keys = [
  [0,{}],
  [95,{headY:1,headAngle:-1,pupilX:1.3,pupilY:2,earL:1,earR:-1,cupX:-1,cupY:1}],
  [210,{bodyY:1.8,bodyAngle:-1.2,headY:2.5,headAngle:-2.2,cupX:-4,cupY:3,cupAngle:-5,pupilX:1.5,pupilY:2.3,tail:-2}],
  [330,{bodyY:3.4,bodyAngle:-2.2,headY:3.2,headAngle:-3.4,cupX:-8,cupY:5,cupAngle:-10,pupilX:1,pupilY:2.5,earL:-3,earR:-4,blink:.14,tail:-4}],
  [475,{bodyY:-2,bodyAngle:1.8,headY:-3.5,headAngle:1.5,cupX:-3,cupY:-25,cupAngle:8,pupilX:.6,pupilY:1.3,earL:4,earR:3,blink:.08,tail:2}],
  [640,{bodyY:-1.5,bodyAngle:3.5,headY:-1,headAngle:-4.2,headX:-1.5,cupX:19,cupY:-15,cupAngle:16,pupilX:2,pupilY:1.2,blink:.16}],
  [830,{bodyY:-.6,bodyAngle:-3.1,headY:-1.8,headAngle:4.6,headX:1.2,cupX:-22,cupY:-29,cupAngle:-15,pupilX:-1.7,pupilY:1.2,blink:.2}],
  [1050,{bodyY:-1.5,bodyAngle:3.8,headY:-1.1,headAngle:-4.5,headX:-1.4,cupX:20,cupY:-12,cupAngle:17,pupilX:2,pupilY:1.5,blink:.17}],
  [1230,{bodyY:-.6,bodyAngle:-2.4,headY:-1.6,headAngle:4,headX:1,cupX:-17,cupY:-27,cupAngle:-14,pupilX:-1.5,pupilY:1.3,blink:.14}],
  [1430,{bodyY:-1.1,bodyAngle:2.8,headY:-.8,headAngle:-3,headX:-.8,cupX:14,cupY:-13,cupAngle:12,pupilX:1.6,pupilY:1.4,blink:.1}],
  [1620,{bodyY:-.4,bodyAngle:-1.8,headY:-1.2,headAngle:2.3,headX:.6,cupX:-11,cupY:-26,cupAngle:-9,pupilX:-.8,pupilY:1.2,blink:.06}],
  [1800,{bodyY:-.7,bodyAngle:1.2,headY:-.3,headAngle:-1,cupX:6,cupY:-18,cupAngle:6,pupilX:.7,pupilY:1.2}],
  [1990,{bodyY:-.1,bodyAngle:.6,headY:2.2,headAngle:3.8,cupX:-4,cupY:-27,cupAngle:-4,pupilX:1,pupilY:2,earL:1,earR:-2}],
  [2140,{bodyY:.4,bodyAngle:.8,headX:1.5,headY:5.5,headAngle:7.5,cupX:-7,cupY:-38,cupAngle:-8,pupilX:1.5,pupilY:2.5,earL:6,earR:-3,blink:.05}],
  [2270,{bodyY:.4,bodyAngle:.8,headX:1.5,headY:5.5,headAngle:7.5,cupX:-7,cupY:-38,cupAngle:-8,pupilX:1.5,pupilY:2.5,earL:9,earR:-4,blink:.05}],
  [2400,{bodyY:.3,bodyAngle:.7,headX:1.4,headY:5.2,headAngle:7.2,cupX:-7,cupY:-38,cupAngle:-8,pupilX:.8,pupilY:2,earL:4,earR:-1}],
  [2510,{bodyY:-1.2,bodyAngle:-.8,headY:-2.5,headAngle:-2.2,cupX:-8,cupY:-27,cupAngle:-10,pupilX:0,pupilY:-.6,earL:3,earR:3}],
  [2630,{bodyY:1.6,bodyAngle:-2.1,headY:1.5,headAngle:-1.8,cupX:-10,cupY:-21,cupAngle:-12,pupilX:1,pupilY:1.3,blink:.16,earL:-2,earR:-3}],
  [2760,{bodyY:-2.2,bodyAngle:2.2,headY:-2,headAngle:1,cupX:5,cupY:-30,cupAngle:8,pupilX:.6,pupilY:1.5}],
  [2890,{bodyY:-1.1,bodyAngle:4,headY:-.8,headAngle:-4.4,cupX:22,cupY:-14,cupAngle:18,pupilX:1.6,pupilY:1.3,blink:.16}],
  [3050,{bodyY:-.1,bodyAngle:-3.5,headY:-1.8,headAngle:4.5,cupX:-23,cupY:-30,cupAngle:-17,pupilX:-1.5,pupilY:1.6,blink:.24}],
  [3210,{bodyY:-1.6,bodyAngle:4.2,headY:-1,headAngle:-4.8,cupX:23,cupY:-14,cupAngle:19,pupilX:1.8,pupilY:1.4,blink:.22}],
  [3370,{bodyY:-.1,bodyAngle:-3.1,headY:-1.5,headAngle:4,cupX:-20,cupY:-28,cupAngle:-16,pupilX:-1.3,pupilY:1.5,blink:.18}],
  [3540,{bodyY:-1,bodyAngle:2.8,headY:-.7,headAngle:-3,cupX:17,cupY:-16,cupAngle:14,pupilX:1.4,pupilY:1.4,blink:.13}],
  [3710,{bodyY:-.2,bodyAngle:-1.8,headY:-.6,headAngle:2,cupX:-12,cupY:-25,cupAngle:-9,pupilX:-.6,pupilY:1.5,blink:.08}],
  [3850,{bodyY:-.5,bodyAngle:1,headY:.2,headAngle:-.8,cupX:5,cupY:-17,cupAngle:5,pupilX:.5,pupilY:1.7}],
  [3950,{bodyY:.2,bodyAngle:.5,headY:1,headAngle:1.5,cupX:0,cupY:-14,cupAngle:1,pupilX:.3,pupilY:2,earL:-2,earR:-1}],
  [4140,{bodyY:2.5,bodyAngle:-.8,headY:2.8,headAngle:2,cupX:0,cupY:4,cupAngle:1,pupilX:.3,pupilY:2.4,earL:-2,earR:-3}],
  [4230,{bodyY:3.2,bodyAngle:-.7,headY:4.5,headAngle:2.8,cupY:5,cupAngle:1,pupilX:.3,pupilY:2.4,blink:.2,earL:-3,earR:-4}],
  [4400,{bodyY:.2,bodyAngle:.4,headY:1.6,headAngle:1.4,cupY:1.2,cupAngle:-.4,pupilY:1.6,earL:1,earR:1}],
  [4550,{bodyY:.6,bodyAngle:0,headY:1.4,headAngle:1,cupY:1,pupilY:1.3}],
  [4680,{bodyY:.4,headY:1.2,headAngle:1,cupY:1,pupilY:1.1}],
  [4780,{bodyY:.4,headY:1.2,headAngle:1,cupY:1,pupilY:.9}],
  [4870,{bodyY:.4,headY:1.5,headAngle:1,cupY:1,blink:.98}],
  [4980,{bodyY:.3,headY:1,headAngle:.5,cupY:.6,pupilY:.5}],
  [5100,{bodyY:0,headY:-.4,headAngle:-1.5,cupY:0,pupilX:0,pupilY:-1.1,earL:2,earR:2}],
  [5280,{bodyY:-1.2,bodyAngle:-.8,headY:-3.5,headAngle:-5.5,cupY:-1,pupilX:0,pupilY:-.8,earL:4,earR:3,tail:4}],
  [5480,{bodyY:-.5,bodyAngle:-.5,headY:-2,headAngle:-5,cupY:0,pupilX:0,pupilY:0,earL:3,earR:2,tail:2}],
  [5700,{bodyY:.5,bodyAngle:.2,headY:1.6,headAngle:1.8,cupY:1,blink:.15}],
  [5920,{headY:-.4,headAngle:-.5,cupY:-.2}],
  [CAT_MOTION_DURATION,{}],
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
export function sampleCatMotion(elapsed,reduced=false){
  const ms=Math.max(0,Math.min(CAT_MOTION_DURATION,elapsed)),pose=trackAt(ms);
  let stage=CAT_STAGES[0].name;for(const s of CAT_STAGES)if(ms>=s.at)stage=s.name;
  // The head responds after the shoulder changes direction. Each hand stroke
  // is authored above; there is no repeated clockwork ellipse underneath it.
  const follow=Math.max(ease((ms-450)/100)*ease((2000-ms)/200),ease((ms-2750)/100)*ease((3970-ms)/180));
  const head=trackAt(Math.max(0,ms-85)),cloth=trackAt(Math.max(0,ms-105)),tail=trackAt(Math.max(0,ms-180)),tip=trackAt(Math.max(0,ms-265));
  pose.headAngle+=(head.headAngle*.5-pose.headAngle)*follow;
  pose.scarf+=(cloth.bodyAngle-pose.bodyAngle)*1.2+cloth.headAngle*.18;
  pose.tail+=(tail.bodyAngle-pose.bodyAngle)*2.6+tail.cupX*.18;
  pose.tailCurl+=(tip.bodyAngle-tail.bodyAngle)*.13;
  pose.earL+=(cloth.bodyAngle-pose.bodyAngle)*.4;
  pose.earR+=(head.bodyAngle-pose.bodyAngle)*.3;
  if(reduced)for(const key of ['rootY','headX','headY','headAngle','tail','scarf','earL','earR','pupilX','pupilY','tailCurl'])pose[key]*=.65;
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
      pose.headAngle+=4.1*w*e*d;pose.headX+=1.5*w*e*d;pose.bodyAngle+=.3*w*e*d;
      pose.earL+=.15*w*e*d;pose.earR+=-.12*w*e*d;
      pose.pupilX+=.8*w*e*d;pose.pupilY+=.2*Math.cos(p*Math.PI*2)*e;break;
    case 'curious-tilt':
      pose.headAngle+=4.2*e*d;pose.headX+=1.2*e*d;pose.headY-=.6*e;pose.tail+=1.4*e*d;
      pose.earL+=.2*e*d;pose.earR+=-.15*e*d;
      pose.pupilX+=.6*e*d;break;
    case 'inspect-cup':
      pose.headY+=4.8*e;pose.headAngle+=2.2*e;pose.headX+=1.2*e;pose.cupY-=5.5*e;pose.cupAngle-=3*e;pose.bodyY+=1.1*e;
      pose.pupilX+=.4*e;pose.pupilY+=1*e;
      pose.earL+=-.1*e;pose.earR+=-.1*e;break;
    case 'adjust-hold':
      pose.cupY+=(-5+2*w)*e;pose.cupX+=1.8*w*e;pose.cupAngle+=2.2*w*e;pose.headY+=e;pose.bodyY-=e;
      break;
    case 'tail-swish':
      pose.tail+=3.8*Math.sin(p*Math.PI*4)*e;pose.tailCurl+=.8*Math.sin(p*Math.PI*3)*e;
      pose.bodyAngle+=.45*w*e;pose.headAngle-=.65*w*e;pose.scarf+=.8*w*e;
      pose.earL+=.1*Math.sin(p*Math.PI*4)*e;pose.earR+=.1*Math.sin(p*Math.PI*4-.4)*e;break;
    case 'sleepy-nod':
      pose.bodyY+=1.8*e;pose.headY+=3.5*e;pose.headAngle+=1.6*e*d;
      pose.blink=Math.max(pose.blink,.97*ease(p/.26)*ease((1-p)/.25));
      pose.earL+=-.15*e;pose.earR+=-.15*e;
      break;
    case 'stretch':
      pose.bodyY-=3*e;pose.headY-=2.3*e;pose.headAngle-=1.1*e*d;pose.cupY-=2.6*e;pose.tail+=2*e*d;pose.scarf+=.6*e;
      pose.earL+=.18*e;pose.earR+=.18*e;
      break;
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
    // Ears drift slightly with breathing
    const earTime=((time%5000)+5000)%5000;
    pose.earL=.02*Math.sin(earTime/5000*Math.PI*2);
    pose.earR=.02*Math.sin(earTime/5000*Math.PI*2+.4);
    addIdleGesture(pose,cue);
    // These channels now drive visible features. Readable glances and small
    // ear reactions replace the previous effectively invisible values.
    pose.pupilX*=2;pose.pupilY*=1.6;pose.earL*=8;pose.earR*=8;
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

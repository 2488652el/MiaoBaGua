import { RESULT_REVEAL_START_MS, RESULT_REVEAL_DURATION_MS } from './motion-timing.js';

// Keep both layers mounted and use the shared throw clock. IPC, a late-opened
// window or an unrelated state update must not restart the reveal from zero.
export function playCardTransition(card, motion) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const startsAt=motion.startedAt+RESULT_REVEAL_START_MS;
  const startTime=document.timeline.currentTime+(startsAt-Date.now());
  const animations=[];
  const ease='cubic-bezier(.22,.72,.24,1)';
  function animate(selector,keyframes,duration,delay=0,easing=ease,essentialMotion=false) {
    for(const element of card.querySelectorAll(selector)) {
      const frames=reduced&&!essentialMotion?keyframes.map(({transform,clipPath,strokeDashoffset,...rest})=>rest):keyframes;
      const animation=element.animate(frames,{duration,delay,easing,fill:'both'});
      animation.startTime=startTime;
      animations.push(animation);
    }
  }
  animate('.dice-scene',[
    {opacity:1,transform:'translateY(0) scale(1)'},
    {opacity:0,transform:'translateY(2%) scale(.94)'},
  ],520);
  animate('.card-result',[{opacity:0},{opacity:1}],480,70);
  // The requested card pop is content motion. Keep a restrained version when
  // the OS reduces decoration, rather than silently turning it into a cut.
  animate('.result-ticket',reduced?[
    {transform:'translateY(3%) scale(.95)'},
    {transform:'translateY(-.3%) scale(1.006)',offset:.7},
    {transform:'translateY(0) scale(1)'},
  ]:[
    {transform:'translateY(17%) scale(.76) rotate(-4deg)'},
    {transform:'translateY(-2%) scale(1.035) rotate(.9deg)',offset:.6},
    {transform:'translateY(.5%) scale(.994) rotate(-.25deg)',offset:.83},
    {transform:'translateY(0) scale(1) rotate(0deg)'},
  ],740,60,ease,true);
  animate('.nature-paper',[{opacity:0},{opacity:1}],400,180);
  animate('.nature-divider',[{opacity:0},{opacity:.5}],340,280);
  animate('.nature-upper',[
    {opacity:0,transform:'translateY(9px)'},
    {opacity:1,transform:'translateY(0)'},
  ],480,180);
  animate('.nature-lower',[
    {opacity:0,transform:'translateY(9px)'},
    {opacity:1,transform:'translateY(0)'},
  ],480,310);
  if(!reduced) {
    animate('.nature-upper .nature-symbol path',[{strokeDashoffset:1},{strokeDashoffset:0}],460,180);
    animate('.nature-lower .nature-symbol path',[{strokeDashoffset:1},{strokeDashoffset:0}],460,310);
  }
  const elapsed=Date.now()-startsAt;
  card.dataset.transition=elapsed<0?'throwing':elapsed<RESULT_REVEAL_DURATION_MS?'revealing':'complete';
  const reveal=setTimeout(()=>{card.dataset.transition='revealing';},Math.max(0,-elapsed));
  const finish=setTimeout(()=>{card.dataset.transition='complete';},Math.max(0,RESULT_REVEAL_DURATION_MS-elapsed));
  return ()=>{clearTimeout(reveal);clearTimeout(finish);animations.forEach(animation=>animation.cancel());};
}

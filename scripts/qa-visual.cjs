const { _electron, expect } = require('@playwright/test');
const fs=require('node:fs/promises'), path=require('node:path'),os=require('node:os');
(async()=>{
  const output=path.resolve(process.env.ORACLE_QA_DIR||'验收截图/物理骰子-开发');await fs.mkdir(output,{recursive:true});
  const env={...process.env,ORACLE_DATA_DIR:await fs.mkdtemp(path.join(os.tmpdir(),'oracle-motion-'))};delete env.ELECTRON_RUN_AS_NODE;
  await fs.writeFile(path.join(env.ORACLE_DATA_DIR,'oracle-state.json'),JSON.stringify({settings:{size:480,alwaysOnTop:false,background:'transparent'}}));
  const app=await _electron.launch({...(process.env.ORACLE_QA_EXE?{executablePath:path.resolve(process.env.ORACLE_QA_EXE),args:[]}:{args:[path.resolve(__dirname,'..')]}),env,...(process.env.ORACLE_RECORD?{recordVideo:{dir:path.join(output,'video'),size:{width:480,height:480}}}:{})});
  let overlayVideo;
  try {
    await expect.poll(()=>app.windows().length).toBe(2);
    const overlay=app.windows().find(p=>p.url().includes('overlay')),controller=app.windows().find(p=>!p.url().includes('overlay'));
    overlayVideo=overlay.video();
    const errors=[]; for(const p of [controller,overlay]){p.on('pageerror',e=>errors.push(e.message));p.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});}
    await Promise.all([controller.emulateMedia({reducedMotion:null}),overlay.emulateMedia({reducedMotion:null})]);
    console.log('System reduced motion:',await overlay.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));
    await controller.getByRole('button',{name:'摇 卦',exact:true}).waitFor();await overlay.getByTestId('card-name').waitFor();
    if(process.env.ORACLE_QA_SIZE)await controller.getByRole('button',{name:process.env.ORACLE_QA_SIZE,exact:true}).click();
    await Promise.all([controller.evaluate(()=>document.fonts.ready),overlay.evaluate(()=>document.fonts.ready)]);
    await overlay.evaluate(()=>{window.motionGaps=[]; window.motionPhases=[]; window.firstMotionMs=null; let last,elapsed;const tick=now=>{const el=document.querySelector('[data-testid="rolling-dice"]');if(el && el.dataset.elapsed!==elapsed){window.firstMotionMs ??= Number(el.dataset.elapsed); if(!window.motionPhases.includes(el.dataset.motionPhase))window.motionPhases.push(el.dataset.motionPhase);if(last && Number(el.dataset.elapsed)<4600)window.motionGaps.push(now-last);last=now;elapsed=el.dataset.elapsed;}requestAnimationFrame(tick);};requestAnimationFrame(tick);});
    await controller.getByRole('button',{name:'摇 卦',exact:true}).click();
    const start=Date.now();
    for(const ms of [120,350,650,1000,1600,2400,3400,4200,4850,5200,5650,6100,6600]) {
      const delay=ms-(Date.now()-start);if(delay>0)await overlay.waitForTimeout(delay);
      await overlay.screenshot({path:path.join(output,'frame-'+String(ms).padStart(4,'0')+'.png')});
      console.log(JSON.stringify({ms,state:await overlay.evaluate(()=>{const e=document.querySelector('.dice-scene');return e?{...e.dataset}:null;})}));
    }
    const perf=await overlay.evaluate(()=>{const gaps=window.motionGaps.slice(2).sort((a,b)=>a-b);return {firstMotionMs:window.firstMotionMs,phases:window.motionPhases,frames:gaps.length,medianMs:gaps[Math.floor(gaps.length/2)],p95Ms:gaps[Math.floor(gaps.length*.95)],maxMs:gaps.at(-1)};});
    await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({output,errors,perf},null,2));console.log(JSON.stringify({output,errors,perf}));
    if(errors.length || ['falling','bouncing','rolling','stopped'].some(p=>!perf.phases.includes(p)))process.exitCode=1;
  }finally{await app.close(); if(overlayVideo)await overlayVideo.saveAs(path.join(output,'骰子动画实录.webm'));}
})().catch(e=>{console.error(e);process.exitCode=1;});

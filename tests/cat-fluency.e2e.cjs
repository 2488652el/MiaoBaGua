const {_electron}=require('@playwright/test'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const out=path.resolve(process.env.ORACLE_QA_DIR||'验收截图/连续小猫-开发');await fs.mkdir(out,{recursive:true});
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'oracle-cat-fluency-'));
 await fs.writeFile(path.join(data,'oracle-state.json'),JSON.stringify({settings:{alwaysOnTop:false,catAlwaysOnTop:false,catSize:360}}));
 const env={...process.env,ORACLE_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({...process.env.ORACLE_QA_EXE?{executablePath:path.resolve(process.env.ORACLE_QA_EXE),args:[]}:{args:[path.resolve(__dirname,'..')]},env});
 try{
  let cat;for(let i=0;i<60&&!cat;i++){cat=app.windows().find(p=>p.url().includes('window=cat'));if(!cat)await new Promise(r=>setTimeout(r,100));}
  await cat.waitForSelector('[data-ready="true"]');await cat.emulateMedia({reducedMotion:process.env.ORACLE_QA_REDUCED==='1'?'reduce':'no-preference'});await cat.waitForTimeout(500);
  const controller=app.windows().find(p=>!p.url().includes('window='));
  await cat.evaluate(()=>{
   const source=document.querySelector('.cat-art'),record=document.createElement('canvas');record.width=360;record.height=360;const ctx=record.getContext('2d');
   const stream=record.captureStream(60),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:4000000});
   const q=window.qaFluency={source,record,ctx,stream,recorder,chunks:[],times:[],delays:[],frames:[],last:0,active:false,raf:0};
   recorder.ondataavailable=e=>{if(e.data.size)q.chunks.push(e.data);};recorder.start();
   function step(t){
    ctx.fillStyle='#f4ebd9';ctx.fillRect(0,0,360,360);ctx.drawImage(source,0,0,360,360);
    const el=document.querySelector('.cat-companion'),active=el.classList.contains('is-performing');
    if(active){if(q.active){q.times.push(t-q.last);if(t-q.last>25)q.delays.push({gap:t-q.last,stage:el.dataset.stage,elapsed:el.dataset.elapsed});}q.frames.push(el.dataset.frame);}
    q.active=active;q.last=t;q.raf=requestAnimationFrame(step);
   }q.raf=requestAnimationFrame(step);
  });
  await controller.evaluate(()=>window.oracle.roll());await cat.waitForTimeout(7050);
  const result=await cat.evaluate(async()=>{
   const q=window.qaFluency;cancelAnimationFrame(q.raf);const stopped=new Promise(r=>q.recorder.onstop=r);q.recorder.stop();await stopped;q.stream.getTracks().forEach(t=>t.stop());
   const video=await new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(q.chunks,{type:'video/webm'}));});
   const d=q.times.slice().sort((a,b)=>a-b),percentile=p=>d[Math.min(d.length-1,Math.floor(d.length*p))];
   return {video,metrics:{sampledIntervals:d.length,averageMs:d.reduce((a,b)=>a+b,0)/d.length,medianMs:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),maxMs:d.at(-1),over25Ms:d.filter(t=>t>25).length,delays:q.delays,textureFrames:[...new Set(q.frames)],renderer:{...document.querySelector('.cat-companion').dataset},capture:'Actual WebGL canvas, 60 fps requested; cream background is added only to recording for visibility.'}};
  });
  await fs.writeFile(path.join(out,'连续动作实录.webm'),Buffer.from(result.video,'base64'));
  await fs.writeFile(path.join(out,'流畅性实测.json'),JSON.stringify(result.metrics,null,2));
  assert.deepEqual(result.metrics.textureFrames,['0'],'the drawing must never swap');
  assert.ok(result.metrics.sampledIntervals>200,'enough actual animation frames');
  assert.ok(result.metrics.p95Ms<35,'sustained missed display frames: '+JSON.stringify(result.metrics));
  console.log(JSON.stringify(result.metrics));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

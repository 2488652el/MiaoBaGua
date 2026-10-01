const {_electron,expect:baseExpect}=require('@playwright/test');
const expect=baseExpect.configure({timeout:10000}),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const out=path.resolve(process.env.ORACLE_QA_DIR||'验收截图/随机待机小猫-开发');await fs.mkdir(out,{recursive:true});
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'oracle-cat-idle-'));
 await fs.writeFile(path.join(data,'oracle-state.json'),JSON.stringify({settings:{alwaysOnTop:false,catAlwaysOnTop:false,catSize:360}}));
 const env={...process.env,ORACLE_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({...process.env.ORACLE_QA_EXE?{executablePath:path.resolve(process.env.ORACLE_QA_EXE),args:[]}:{args:[path.resolve(__dirname,'..')]},env});
 try{
  await expect.poll(()=>app.windows().length).toBe(3);
  const cat=app.windows().find(p=>p.url().includes('window=cat')),control=app.windows().find(p=>!p.url().includes('window='));
  await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-ready','true');
  await cat.emulateMedia({reducedMotion:'no-preference'});await control.emulateMedia({reducedMotion:'no-preference'});
  const section=control.getByRole('region',{name:'小猫直播设置'}),toggle=section.getByRole('switch',{name:'随机待机动作',exact:true});
  await expect(toggle).toBeChecked();
  await cat.evaluate(()=>{
   const source=document.querySelector('.cat-art'),canvas=document.createElement('canvas');canvas.width=360;canvas.height=360;const ctx=canvas.getContext('2d');
   const stream=canvas.captureStream(60),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:3000000});
   const q=window.qaIdle={canvas,ctx,source,stream,recorder,chunks:[],stills:{},actions:[],lastAction:'',intervals:[],last:0,start:performance.now(),raf:0};
   recorder.ondataavailable=e=>{if(e.data.size)q.chunks.push(e.data);};recorder.start();
   function frame(t){ctx.fillStyle='#f4ebd9';ctx.fillRect(0,0,360,360);ctx.drawImage(source,0,0,360,360);
    const d=document.querySelector('.cat-companion').dataset;
    if(q.last)q.intervals.push(t-q.last);q.last=t;
    if(d.idleAction!==q.lastAction){q.actions.push({action:d.idleAction,at:Math.round(t-q.start)});q.lastAction=d.idleAction;}
    if(d.idleAction!=='breathing'&&d.idleProgress>.44&&d.idleProgress<.65&&!q.stills[d.idleAction])q.stills[d.idleAction]=canvas.toDataURL('image/png').split(',')[1];
    q.raf=requestAnimationFrame(frame);
   }q.raf=requestAnimationFrame(frame);
  });
  // Real wall-clock playback, no accelerated or substituted animation clock.
  await cat.waitForTimeout(28500);
  const captured=await cat.evaluate(async()=>{
   const q=window.qaIdle;cancelAnimationFrame(q.raf);const stop=new Promise(r=>q.recorder.onstop=r);q.recorder.stop();await stop;q.stream.getTracks().forEach(t=>t.stop());
   const video=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(q.chunks,{type:'video/webm'}));});
   const sorted=q.intervals.sort((a,b)=>a-b);return {video,stills:q.stills,actions:q.actions,p95FrameMs:sorted[Math.floor(sorted.length*.95)],frames:sorted.length};
  });
  await fs.writeFile(path.join(out,'随机待机实录.webm'),Buffer.from(captured.video,'base64'));
  for(const[name,png]of Object.entries(captured.stills))await fs.writeFile(path.join(out,`待机-${name}.png`),Buffer.from(png,'base64'));
  const names=captured.actions.map(x=>x.action).filter(n=>n!=='breathing');assert.ok(new Set(names).size>=2,JSON.stringify(captured.actions));
  assert.ok(captured.actions.some(x=>x.action==='breathing'),'natural quiet intervals');
  for(let i=1;i<names.length;i++)assert.notEqual(names[i],names[i-1],'avoid consecutive repeat');
  await expect.poll(async()=>{
    const a=await cat.getByTestId('cat-companion').getAttribute('data-idle-action');const b=await section.getByTestId('cat-companion').getAttribute('data-idle-action');return a===b;
  }).toBe(true);
  await section.screenshot({path:path.join(out,'待机开关.png')});
  await toggle.click();await expect(toggle).not.toBeChecked();await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-idle-action','paused');
  const pixels=()=>cat.locator('.cat-art').evaluate(c=>{const gl=c.getContext('webgl2'),p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);let h=2166136261;for(let i=0;i<p.length;i+=7)h=Math.imul(h^p[i],16777619);return h>>>0;});
  const still=await pixels();await cat.waitForTimeout(250);assert.equal(await pixels(),still);
  await control.evaluate(()=>window.oracle.roll());await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-stage','shake');
  await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-idle-action','casting');
  await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-idle-action','paused');
  await toggle.click();await expect(toggle).toBeChecked();await cat.emulateMedia({reducedMotion:'reduce'});
  await expect(cat.getByTestId('cat-companion')).not.toHaveAttribute('data-idle-action','paused');await cat.waitForTimeout(500);
  const gentle=await pixels();await cat.waitForTimeout(400);assert.notEqual(await pixels(),gentle,'explicit idle option remains gently active under reduced preference');
  const state=await cat.evaluate(()=>window.oracle.getState());assert.equal(state.settings.idleEnabled,true);
  const report={passed:true,actions:captured.actions,frames:captured.frames,p95FrameMs:captured.p95FrameMs,checks:['real 28.5-second idle loop','random variations and quiet intervals','preview/window synchronization','pause becomes visually still','casting works while idle disabled','idle resumes','reduced-motion gentle playback'],capture:'Real elapsed-time canvas recording; cream background is for visibility only.',network:'isolated data; no DeepSeek key or external request'};
  await fs.writeFile(path.join(out,'待机验收.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

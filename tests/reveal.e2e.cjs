const {_electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');

(async()=>{
  const root=path.resolve(__dirname,'..'),output=path.resolve(process.env.ORACLE_QA_DIR||'验收截图/意象衔接-开发');
  const {RESULT_REVEAL_START_MS,RESULT_REVEAL_DURATION_MS}=await import('../src/motion-timing.js');
  await fs.mkdir(output,{recursive:true});
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'oracle-reveal-'));
  await fs.writeFile(path.join(data,'oracle-state.json'),JSON.stringify({settings:{size:480,alwaysOnTop:false,background:'transparent'}}));
  const env={...process.env,ORACLE_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
  let app,video;const errors=[],reports=[];
  try{
    app=await _electron.launch({...(process.env.ORACLE_QA_EXE?{executablePath:path.resolve(process.env.ORACLE_QA_EXE),args:[]}:{args:[root]}),env,...(process.env.ORACLE_RECORD?{recordVideo:{dir:path.join(output,'video'),size:{width:480,height:480}}}:{})});
    await expect.poll(()=>app.windows().length).toBe(3);
    const controller=app.windows().find(p=>!p.url().includes('window='));
    let overlay=app.windows().find(p=>p.url().includes('overlay'));video=overlay.video();
    for(const page of [controller,overlay])page.on('pageerror',e=>errors.push(e.message));
    await controller.getByRole('button',{name:'摇 卦',exact:true}).waitFor();
    await Promise.all([controller.evaluate(()=>document.fonts.ready),overlay.evaluate(()=>document.fonts.ready)]);
    for(const reduced of ['no-preference','reduce']){
      await Promise.all([controller.emulateMedia({reducedMotion:reduced}),overlay.emulateMedia({reducedMotion:reduced})]);
      await overlay.evaluate(()=>{
        window.revealFrames=[];window.revealTracking=true;
        const tick=()=>{
          const card=document.querySelector('.oracle-card');
          const op=s=>Number(getComputedStyle(card.querySelector(s)).opacity);
          const upper=card.querySelector('.nature-upper').getBoundingClientRect();
          const lower=card.querySelector('.nature-lower').getBoundingClientRect();
          const ticket=card.querySelector('.result-ticket');
          const pose=new DOMMatrixReadOnly(getComputedStyle(ticket).transform);
          const paper=ticket.getBoundingClientRect(),bounds=card.getBoundingClientRect();
          const roll=card.classList.contains('is-rolling');
          window.revealFrames.push({time:Date.now(),roll,transition:card.dataset.transition,dice:roll?op('.dice-scene'):0,result:op('.card-result'),upper:op('.nature-upper'),lower:op('.nature-lower'),stroke:Number.parseFloat(getComputedStyle(card.querySelector('.nature-symbol path')).strokeDashoffset),upperY:upper.y,upperHeight:upper.height,lowerY:lower.y,lowerHeight:lower.height,paperScale:Math.hypot(pose.a,pose.b),paperY:pose.f,paperInside:paper.left>=bounds.left&&paper.right<=bounds.right&&paper.top>=bounds.top&&paper.bottom<=bounds.bottom,textFree:document.body.innerText.trim()===''&&document.querySelectorAll('svg text').length===0});
          if(window.revealTracking)requestAnimationFrame(tick);
        };requestAnimationFrame(tick);
      });
      await controller.getByRole('button',{name:'摇 卦',exact:true}).click();
      const state=await controller.evaluate(()=>window.oracle.getState());
      const handoff=state.diceMotion.startedAt+RESULT_REVEAL_START_MS;
      if(reduced==='no-preference'){
        for(const offset of [-200,120,300,520,740,1100]){
          await overlay.waitForTimeout(Math.max(0,handoff+offset-Date.now()));
          await overlay.screenshot({path:path.join(output,`handoff-${String(offset).padStart(4,'0')}.png`)});
        }
      }
      await expect(controller.getByRole('button',{name:'摇 卦',exact:true})).toBeEnabled({timeout:9000});
      await overlay.waitForTimeout(90);
      const frames=await overlay.evaluate(()=>{window.revealTracking=false;return window.revealFrames;});
      const early=frames.filter(f=>f.roll&&f.time<handoff-10);
      const transition=frames.filter(f=>f.time>=handoff && f.time<=handoff+RESULT_REVEAL_DURATION_MS);
      await fs.writeFile(path.join(output,`frames-${reduced}.json`),JSON.stringify({handoff,frames},null,2));
      assert.ok(frames.every(f=>f.textFree),'public window must remain text-free throughout the throw and reveal');
      assert.ok(early.length>25);assert.ok(early.every(f=>f.result<.001),'result must remain hidden until the dice are read');
      assert.ok(transition.filter(f=>f.dice>.06&&f.result>.06).length>=4,'layers overlap rather than cut or leave a blank frame');
      assert.ok(transition.every(f=>Math.max(f.dice,f.result)>.15),'no empty handoff');
      assert.ok(transition.filter(f=>f.result>.1&&f.result<.9).length>=8,'result must fade over multiple frames even with reduced motion');
      assert.ok(transition.some(f=>f.paperScale<(reduced==='reduce'?.98:.9)),'paper card visibly grows into place');
      assert.ok(transition.some(f=>f.paperScale>(reduced==='reduce'?1.002:1.02)),'paper card softly overshoots before settling');
      assert.ok(transition.filter(f=>f.result>.05).every(f=>f.paperInside),'paper card must stay within the live window while popping');
      assert.ok(transition.some(f=>f.upper>.45&&f.lower<.25),'upper and lower images reveal in sequence');
      assert.ok(transition.some(f=>f.upper>.999&&f.lower>.999),'both nature drawings finish revealing before the handoff completes');
      if(reduced==='no-preference')assert.ok(transition.some(f=>f.stroke>.05&&f.stroke<.95),'hand-drawn paths progress across frames');
      const before=frames.filter(f=>f.roll).at(-1),after=frames.find(f=>f.time>before.time&&!f.roll);
      assert.ok(before.result>.999&&before.upper>.999&&before.lower>.999&&before.dice<.001,'handoff finishes before state commit');
      assert.ok(after&&['upperY','upperHeight','lowerY','lowerHeight'].every(key=>Math.abs(after[key]-before[key])<.5),'nature drawings must not jump at state commit');
      assert.equal(after.result,1);assert.equal(after.upper,1);assert.equal(after.lower,1);
      assert.ok(Math.abs(after.paperScale-1)<.001&&Math.abs(after.paperY)<.01,'paper rests in its final position');
      const control=await controller.locator('.nature-upper,.nature-lower').evaluateAll(elements=>elements.map(el=>el.dataset.nature));
      assert.equal(control.length,2);
      assert.deepEqual(await overlay.locator('.nature-upper,.nature-lower').evaluateAll(elements=>elements.map(el=>el.dataset.nature)),control);
      assert.equal((await overlay.locator('body').innerText()).trim(),'');
      assert.equal(await overlay.locator('svg text').count(),0);
      reports.push({reducedMotion:reduced,samples:transition.length,overlapFrames:transition.filter(f=>f.dice>.06&&f.result>.06).length,paperScaleRange:[Math.min(...transition.map(f=>f.paperScale)),Math.max(...transition.map(f=>f.paperScale))],frames});
      if(reduced==='reduce')await overlay.screenshot({path:path.join(output,'第二次投掷-减少动画-完成.png')});
    }
    // A live window reopened during the handoff must join the shared timeline.
    await controller.getByRole('button',{name:'摇 卦',exact:true}).click();
    const current=await controller.evaluate(()=>window.oracle.getState());
    await controller.getByRole('button',{name:'关闭直播窗口',exact:true}).click();
    await controller.waitForTimeout(Math.max(0,current.diceMotion.startedAt+RESULT_REVEAL_START_MS+250-Date.now()));
    await controller.getByRole('button',{name:'打开直播窗口',exact:true}).click();
    await expect.poll(()=>app.windows().length).toBe(3);
    overlay=app.windows().find(p=>p.url().includes('overlay'));
    await overlay.getByTestId('card-result').waitFor();
    const joined=await overlay.getByTestId('card-result').evaluate(el=>({time:Date.now(),opacity:Number(getComputedStyle(el).opacity)}));
    assert.ok(joined.opacity>.1,'reopening must not restart from an invisible result');
    await expect(controller.getByRole('button',{name:'摇 卦',exact:true})).toBeEnabled({timeout:9000});
    await expect(overlay.getByTestId('card-result')).toHaveCSS('opacity','1');
    assert.equal((await overlay.locator('body').innerText()).trim(),'','reopened public window must remain text-free');
    assert.equal(await overlay.locator('svg text').count(),0);
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(output,'验收报告.json'),JSON.stringify({passed:true,checks:['settled dice remain readable','overlapping exit and reveal','no blank frame','paper card grows and softly settles','paper stays inside window','staggered nature imagery','drawn ink paths','both drawings complete','no jump at state commit','repeated throw','reduced motion retains gentle card pop','late window joins timeline','text-free public window through every frame'],reports,joined},null,2));
    console.log(JSON.stringify({passed:true,output,reports:reports.map(({frames,...report})=>report)},null,2));
  }finally{if(app)await app.close();if(video)await video.saveAs(path.join(output,'骰子至意象-实录.webm'));}
})().catch(e=>{console.error(e);process.exitCode=1;});

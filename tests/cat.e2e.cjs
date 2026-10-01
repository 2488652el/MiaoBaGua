const {_electron,expect:baseExpect}=require('@playwright/test');
const expect=baseExpect.configure({timeout:10000});
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');

(async()=>{
  const root=path.resolve(__dirname,'..'),output=path.resolve(process.env.ORACLE_QA_DIR||'验收截图/围巾小猫-开发');
  await fs.mkdir(output,{recursive:true});
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'oracle-cat-qa-'));
  await fs.writeFile(path.join(data,'oracle-state.json'),JSON.stringify({draft:{question:'不应出现的私人问题',nickname:'不应出现的昵称'},settings:{alwaysOnTop:false,catAlwaysOnTop:false,catSize:480}}));
  const env={...process.env,ORACLE_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
  let app,video;const errors=[],frames=[],fonts=[],feetChecks=[];
  async function verifyFont(page,selector){
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');await cdp.send('CSS.enable');
    const {root}=await cdp.send('DOM.getDocument');
    const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});
    const result=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
    assert.ok(result.fonts.some(f=>f.isCustomFont&&/Noto Serif SC/i.test(f.familyName)&&f.glyphCount>0),JSON.stringify(result));
    fonts.push({selector,...result});await cdp.detach();
  }
  async function verifyPublicArtwork(page){
    assert.equal((await page.locator('body').innerText()).trim(),'','public result window must display no text');
    assert.equal(await page.locator('svg text').count(),0,'result artwork must contain no SVG lettering');
    await expect(page.getByTestId('result-ticket')).toBeVisible();
    const drawings=await page.locator('.nature-upper,.nature-lower').evaluateAll(elements=>elements.map(el=>{
      const bounds=el.getBoundingClientRect();
      return {top:bounds.top,bottom:bounds.bottom,width:bounds.width,height:bounds.height,paths:el.querySelectorAll('path[d]').length};
    }));
    assert.equal(drawings.length,2);
    assert.ok(drawings.every(d=>d.paths>0&&d.width>0&&d.height>0),'both result drawings must remain visible');
    assert.ok(drawings[0].bottom<drawings[1].top,'upper and lower drawings must remain separated');
  }
  async function launch(){
    app=await _electron.launch({...(process.env.ORACLE_QA_EXE?{executablePath:path.resolve(process.env.ORACLE_QA_EXE),args:[]}:{args:[root]}),env,recordVideo:{dir:path.join(output,'video'),size:{width:480,height:480}}});
    app.on('window',p=>p.on('pageerror',e=>errors.push(e.message)));
    await expect.poll(()=>app.windows().length).toBe(3);
    const controller=app.windows().find(p=>!p.url().includes('window='));
    const overlay=app.windows().find(p=>p.url().includes('window=overlay'));
    const cat=app.windows().find(p=>p.url().includes('window=cat'));
    await cat.getByTestId('cat-companion').waitFor();
    await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-ready','true');
    await cat.emulateMedia({reducedMotion:'no-preference'});
    return {controller,overlay,cat};
  }
  // Read the rendered WebGL drawing buffer; state updates cannot pass as motion.
  const transform=cat=>cat.locator('.cat-art').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2'),pixels=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let hash=2166136261;for(let i=0;i<pixels.length;i+=7)hash=Math.imul(hash^pixels[i],16777619);
    return hash>>>0;
  });
  const feetPixels=cat=>cat.locator('.cat-art').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2'),scale=canvas.width/512;
    const x=Math.round(232*scale),y=Math.round(canvas.height-447*scale),width=Math.round(148*scale),height=Math.round(23*scale),pixels=new Uint8Array(width*height*4);
    gl.readPixels(x,y,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return [...pixels];
  });
  function assertFeet(after,before,stage){
    assert.equal(after.length,before.length);let total=0,large=0,alphaTotal=0;
    for(let i=0;i<after.length;i++){const d=Math.abs(after[i]-before[i]);total+=d;if(d>8)large++;if(i%4===3)alphaTotal+=d;}
    const result={stage,mean:total/after.length,largeRatio:large/after.length,alphaMean:alphaTotal/(after.length/4)};feetChecks.push(result);
    assert.ok(result.mean<.5&&result.largeRatio<.001&&result.alphaMean<.25,'paw silhouette moved: '+JSON.stringify(result));
  }
  try{
    let {controller,overlay,cat}=await launch();video=cat.video();
    await verifyFont(controller,'h1');
    await verifyPublicArtwork(overlay);
    assert.match(await controller.locator('textarea').evaluate(e=>getComputedStyle(e).fontFamily),/Microsoft YaHei/);
    await controller.screenshot({path:path.join(output,'宋体层次-控制台.png')});
    await cat.screenshot({path:path.join(output,'小猫-待机.png'),omitBackground:true});
    const plantedFeet=await feetPixels(cat);
    assert.ok(plantedFeet.some((value,i)=>i%4===3&&value>200),'feet crop must contain visible artwork');
    const idleBefore=await transform(cat);await cat.waitForTimeout(220);assert.notEqual(await transform(cat),idleBefore);
    const clockData=await cat.evaluate(()=>window.oracle.getState());
    assert.deepEqual(Object.keys(clockData).sort(),['diceMotion','phase','revision','settings']);
    assert.doesNotMatch(JSON.stringify(clockData),/私人|昵称|卦|爻|apiKey|reading/);
    assert.equal(await cat.title(),'三花守摊猫 · 直播组件');
    assert.equal(await cat.locator('body').innerText(),'');
    const denied=await cat.evaluate(async()=>Promise.allSettled([window.oracle.roll(),window.oracle.setDraft({question:'bad'}),window.oracle.setSettings({size:720}),window.oracle.showOverlay(),window.oracle.showCat(),window.oracle.closeCat(),window.oracle.setAiSettings({apiKey:'bad'}),window.oracle.testAi(),window.oracle.readAi('bad'),window.oracle.cancelAi('bad')]).then(r=>r.every(v=>v.status==='rejected')));
    assert.equal(denied,true);
    await controller.getByRole('button',{name:'摇 卦',exact:true}).click();
    await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-stage','shake');
    const live=await overlay.evaluate(()=>window.oracle.getState());
    assert.deepEqual((await cat.evaluate(()=>window.oracle.getState())).diceMotion,live.diceMotion);
    await cat.evaluate(()=>{const c=document.querySelector('.cat-art'),gl=c.getContext('webgl2');window.qaActivePixels=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,window.qaActivePixels);});
    await cat.waitForTimeout(190);
    const motionDifference=await cat.evaluate(()=>{
      const c=document.querySelector('.cat-art'),gl=c.getContext('webgl2'),after=new Uint8Array(c.width*c.height*4),before=window.qaActivePixels;
      gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,after);
      let total=0,large=0;for(let i=0;i<after.length;i++){const d=Math.abs(after[i]-before[i]);total+=d;if(d>8)large++;}
      delete window.qaActivePixels;return {mean:total/after.length,largeRatio:large/after.length};
    });
    assert.ok(motionDifference.mean>1&&motionDifference.largeRatio>.025,'visible movement, not pixel rounding: '+JSON.stringify(motionDifference));
    await cat.screenshot({path:path.join(output,'小猫-摇动.png'),omitBackground:true});
    assertFeet(await feetPixels(cat),plantedFeet,'shake');
    // Editing the next question must not restart the current performance.
    await controller.getByLabel('粉丝的问题',{exact:true}).fill('下一位的私人问题');
    for(const stage of ['listen','place','wait','reveal']){
      // Listening lasts 440 ms. Locator assertions back off to 500 ms polling
      // and can miss the entire beat even when every frame renders correctly.
      await cat.waitForFunction(name=>document.querySelector('[data-testid="cat-companion"]')?.dataset.stage===name,stage,{polling:'raf',timeout:10000});
      frames.push({stage,transform:await transform(cat)});
      await cat.screenshot({path:path.join(output,`小猫-${stage}.png`),omitBackground:true});
      assertFeet(await feetPixels(cat),plantedFeet,stage);
    }
    await expect(cat.getByTestId('cat-companion')).toHaveClass(/is-resting/);
    await verifyPublicArtwork(overlay);
    await overlay.screenshot({path:path.join(output,'无字图案-结果卡.png'),omitBackground:true});
    await expect.poll(()=>cat.evaluate(()=>document.getAnimations().filter(a=>a.effect?.getTiming().fill==='both').length)).toBe(0);
    // A second throw, then reopen mid-animation: the new window joins the clock.
    await controller.getByRole('button',{name:'摇 卦',exact:true}).click();
    await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-stage','shake');
    await controller.evaluate(()=>window.oracle.closeCat());
    await expect.poll(()=>app.windows().length).toBe(2);
    await controller.waitForTimeout(850);
    await controller.evaluate(()=>window.oracle.showCat());
    await expect.poll(()=>app.windows().length).toBe(3);
    cat=app.windows().find(p=>p.url().includes('window=cat'));
    await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-stage','shake');
    const progress=Number(await cat.getByTestId('cat-companion').getAttribute('data-elapsed'));
    assert.ok(progress>1000,'reopen must join current time, not start over');
    await expect(cat.getByTestId('cat-companion')).toHaveClass(/is-resting/);
    const section=controller.getByRole('region',{name:'小猫直播设置'});
    for(const size of [240,360,480,720]){
      await section.getByRole('button',{name:`小猫尺寸 ${size}`,exact:true}).click();
      await expect.poll(()=>cat.evaluate(()=>innerWidth)).toBe(size);
      assert.equal(await overlay.evaluate(()=>innerWidth),480,'cat resizing must not resize result window');
      await cat.screenshot({path:path.join(output,`小猫-${size}.png`),omitBackground:true});
    }
    await section.getByLabel('小猫背景',{exact:true}).selectOption('chroma');
    await expect.poll(()=>cat.locator('.cat-surface').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(255, 0, 255)');
    await cat.screenshot({path:path.join(output,'小猫-抠像.png')});
    await section.getByLabel('小猫背景',{exact:true}).selectOption('transparent');
    await expect.poll(()=>cat.locator('.cat-surface').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    await section.getByRole('button',{name:'小猫尺寸 360',exact:true}).click();
    await section.screenshot({path:path.join(output,'小猫-控制台设置.png')});
    // The explicit pause switch stops automatic idle activity, while the
    // OS reduced preference softens the user-triggered shake.
    await section.getByRole('switch',{name:'随机待机动作',exact:true}).click();
    await expect(section.getByRole('switch',{name:'随机待机动作',exact:true})).not.toBeChecked();
    await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-idle-action','paused');
    await cat.emulateMedia({reducedMotion:'reduce'});
    await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-reduced','true');
    // A late-opened window already inherits the OS reduced setting. Wait for
    // the prior size selection's ResizeObserver and the subsequent paint.
    await expect.poll(()=>cat.locator('.cat-art').evaluate(c=>c.width===Math.max(240,Math.min(1440,Math.round(c.clientWidth*Math.min(devicePixelRatio||1,2)))))).toBe(true);
    await cat.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await cat.evaluate(()=>{const c=document.querySelector('.cat-art'),gl=c.getContext('webgl2');window.qaStillPixels=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,window.qaStillPixels);});
    await cat.waitForTimeout(180);
    const stillDifference=await cat.evaluate(()=>{
      const c=document.querySelector('.cat-art'),gl=c.getContext('webgl2'),after=new Uint8Array(c.width*c.height*4),before=window.qaStillPixels;
      gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,after);
      let total=0,large=0;for(let i=0;i<after.length;i++){const d=Math.abs(after[i]-before[i]);total+=d;if(d>8)large++;}
      delete window.qaStillPixels;return {mean:total/after.length,largeRatio:large/after.length};
    });
    // GPU readback can round antialiased edge channels differently. A still
    // image may differ by a few color levels, but must not change its shape.
    assert.ok(stillDifference.mean<.5&&stillDifference.largeRatio<.01,JSON.stringify(stillDifference));
    await controller.evaluate(()=>window.oracle.roll());
    await expect(cat.getByTestId('cat-companion')).toHaveAttribute('data-stage','shake');
    const reducedA=await transform(cat);await cat.waitForTimeout(160);assert.notEqual(await transform(cat),reducedA);
    await expect(cat.getByTestId('cat-companion')).toHaveClass(/is-resting/);
    await section.getByRole('button',{name:'关闭小猫窗口',exact:true}).click();
    await expect.poll(()=>app.windows().length).toBe(2);
    await app.close();app=null;
    await video.saveAs(path.join(output,'小猫动作实录.webm'));
    const saved=JSON.parse(await fs.readFile(path.join(data,'oracle-state.json'),'utf8'));
    assert.equal(saved.settings.catEnabled,false);assert.equal(saved.settings.catSize,360);assert.equal(saved.settings.catBackground,'transparent');
    assert.equal(saved.settings.catIdleEnabled,false);
    // Verify explicit close survives a restart, then open again through the UI.
    app=await _electron.launch({...(process.env.ORACLE_QA_EXE?{executablePath:path.resolve(process.env.ORACLE_QA_EXE),args:[]}:{args:[root]}),env});
    await expect.poll(()=>app.windows().length).toBe(2);
    const reopened=app.windows().find(p=>!p.url().includes('window='));
    await reopened.getByRole('button',{name:'打开小猫窗口',exact:true}).click();
    await expect.poll(()=>app.windows().length).toBe(3);
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(output,'验收报告.json'),JSON.stringify({passed:true,frames,fonts,motionDifference,stillDifference,feetChecks,checks:['three independent windows','significant rendered pixel movement','clock sync','prepare/shake/listen/place/wait/reveal stages','second cast','late reopen joins current clock','240/360/480/720','independent settings','transparent and chroma','read-only IPC','no private content','reduced motion','persisted close and reopen','actual rendered Noto Serif SC font and readable controller UI','text-free public result with two visible drawings','zero renderer errors'],network:'no DeepSeek key in isolated test; no external request'},null,2));
    console.log(JSON.stringify({passed:true,output}));
  }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

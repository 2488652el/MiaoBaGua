const { _electron, expect:baseExpect } = require('@playwright/test');
const expect=baseExpect.configure({timeout:9000});
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

(async () => {
  const {ELEMENTS}=await import('../src/broadcast.js');
  const root = path.resolve(__dirname,'..');
  const output = process.env.ORACLE_QA_DIR || await fs.mkdtemp(path.join(os.tmpdir(),'cyber-oracle-qa-'));
  await fs.mkdir(output,{recursive:true});
  const data = await fs.mkdtemp(path.join(output,'data-'));
  const env = {...process.env, ORACLE_DATA_DIR:data}; delete env.ELECTRON_RUN_AS_NODE;
  let app;
  const errors=[];
  const assertPublic = async overlay => {
    const surface=await overlay.evaluate(()=>({text:document.body.innerText,title:document.title,labels:[...document.querySelectorAll('[aria-label]')].map(e=>e.getAttribute('aria-label')),state:window.oracle.getState()}));
    assert.equal(surface.text.trim(),'','public window must not display any text');
    assert.equal(await overlay.locator('svg text').count(),0,'public SVG artwork must contain no lettering');
    assert.doesNotMatch(JSON.stringify(surface),/卦|爻|乾|坤|艮|巽|坎|兑|算命|占卜|运势|吉凶|[\u2630-\u2637]/u);
    const publicState=await overlay.evaluate(()=>window.oracle.getState());
    assert.ok(!('history' in publicState)&&!('result' in publicState)&&!('draft' in publicState));
    assert.equal(await overlay.locator('[data-line]').count(),0);
  };
  const waitForCardInk = async overlay => {
    await assertPublic(overlay);
    await overlay.getByTestId('oracle-card').evaluate(el => Promise.all(el.getAnimations({subtree:true}).map(animation => animation.finished)));
  };
  const assertArtwork = async (overlay,first,second) => {
    await expect(overlay.locator('.nature-upper')).toHaveAttribute('data-nature',ELEMENTS[first].name);
    await expect(overlay.locator('.nature-lower')).toHaveAttribute('data-nature',ELEMENTS[second].name);
    const geometry=await overlay.getByTestId('result-ticket').evaluate(ticket=>{
      const paper=ticket.getBoundingClientRect();
      return [...ticket.querySelectorAll('.nature-symbol')].map(symbol=>{
        const bounds=symbol.getBoundingClientRect();
        return {width:bounds.width,height:bounds.height,top:bounds.top,bottom:bounds.bottom,paths:symbol.querySelectorAll('path[d]').length,inside:bounds.left>=paper.left&&bounds.right<=paper.right&&bounds.top>=paper.top&&bounds.bottom<=paper.bottom};
      });
    });
    assert.equal(geometry.length,2);
    assert.ok(geometry.every(g=>g.paths>0&&g.width>0&&g.height>0&&g.inside),'both nature drawings must fit inside the paper');
    assert.ok(geometry[0].bottom<geometry[1].top,'upper and lower drawings must remain separated');
    await assertPublic(overlay);
  };
  const launch = async () => {
    app = await _electron.launch({args:[root],env,timeout:30000});
    app.on('window', page => {page.on('pageerror',err=>errors.push(err.message)); page.on('console',msg=>{if(msg.type()==='error') errors.push(msg.text().slice(0,220));});});
    await expect.poll(()=>app.windows().length,{timeout:15000}).toBe(3);
    const pages=app.windows();
    const controller=pages.find(p=>!p.url().includes('window='));
    const overlay=pages.find(p=>p.url().includes('window=overlay'));
    // Playwright's default hides Windows reduced-motion settings: use the real OS preference.
    await Promise.all([controller.emulateMedia({reducedMotion:null}),overlay.emulateMedia({reducedMotion:null})]);
    await controller.getByRole('button',{name:'摇 卦',exact:true}).waitFor();
    await overlay.getByTestId('result-ticket').waitFor();
    return {controller,overlay};
  };
  try {
    let {controller,overlay}=await launch();
    await assertArtwork(overlay,0,1);
    await expect(overlay.locator('.nature-illustration')).toHaveClass(/is-idle/);
    await controller.getByRole('button',{name:'感情 听听彼此的心意'}).click();
    await controller.getByLabel('观众昵称',{exact:true}).fill('小满');
    await controller.getByRole('button',{name:'摇 卦',exact:true}).click();
    await expect(controller.getByRole('button',{name:'摇卦中…'})).toBeDisabled();
    await expect(overlay.getByTestId('rolling-dice')).toBeVisible();
    await expect(overlay.locator('.dice-canvas')).toBeVisible();
    await expect(overlay.locator('.dice-fallback')).toHaveCount(0);
    assert.equal(await overlay.locator('.card-lines').count(),0);
    await assertPublic(overlay);
    await overlay.screenshot({path:path.join(output,'rolling-dice-480.png')});
    assert.equal(await controller.evaluate(()=>window.oracle.roll()),false);
    await controller.getByRole('button',{name:'事业 理清手头的方向'}).click();
    await controller.getByLabel('观众昵称',{exact:true}).fill('下一位');
    await expect(controller.getByRole('button',{name:'摇 卦',exact:true})).toBeEnabled({timeout:9000});
    await expect(overlay.getByTestId('rolling-dice')).toHaveCount(0);
    let state=await controller.evaluate(()=>window.oracle.getState());
    assert.equal(state.result.nickname,'小满'); assert.equal(state.result.topic,'love');
    assert.equal(state.draft.nickname,'下一位'); assert.equal(state.history.length,1);
    await assertArtwork(overlay,state.liveResult.first,state.liveResult.second);
    assert.deepEqual((await overlay.evaluate(()=>window.oracle.getState())).liveResult,state.liveResult);
    const denied=await overlay.evaluate(()=>window.oracle.roll().then(()=>false,()=>true));
    assert.equal(denied,true,'overlay cannot mutate state');
    assert.equal(await controller.evaluate(()=>typeof window.require),'undefined');
    await controller.getByRole('button',{name:'使用说明',exact:true}).click();
    await expect(controller.getByRole('dialog')).toBeVisible();
    await controller.getByRole('button',{name:'知道了'}).click();
    await controller.getByRole('button',{name:'卦象记录 1'}).click();
    await controller.locator('.history-row').click();
    await expect(controller.getByRole('heading',{name:'历史卦象'})).toBeVisible();
    await assertArtwork(overlay,state.liveResult.first,state.liveResult.second);
    for (const size of [240,360,480,720]) {
      await controller.getByRole('button',{name:String(size),exact:true}).click();
      await expect.poll(()=>overlay.evaluate(()=>({width:innerWidth,height:innerHeight}))).toEqual({width:size,height:size});
      const bounds=await overlay.getByTestId('oracle-card').boundingBox(); assert.equal(bounds.width,bounds.height);
      await waitForCardInk(overlay);
      await assertArtwork(overlay,state.liveResult.first,state.liveResult.second);
      await overlay.screenshot({path:path.join(output,`overlay-${size}.png`)});
      await controller.getByRole('button',{name:'摇卦工作台'}).click();
      await controller.getByRole('button',{name:'摇 卦',exact:true}).click();
      await expect(overlay.getByTestId('rolling-dice')).toBeVisible();
      await overlay.screenshot({path:path.join(output,`dice-${size}.png`)});
      const diceBounds = await overlay.locator('.dice-canvas').boundingBox();
      assert.ok(diceBounds.width>0&&diceBounds.height>0&&diceBounds.x>=0&&diceBounds.y>=0&&diceBounds.x+diceBounds.width<=size&&diceBounds.y+diceBounds.height<=size,`dice canvas must fit inside the live window at ${size}`);
      await expect(overlay.getByTestId('rolling-dice')).toHaveAttribute('data-settled','true');
      const faces=await overlay.evaluate(()=>window.oracle.getState().then(s=>s.liveResult));
      assert.deepEqual(await overlay.getByTestId('rolling-dice').evaluate(el=>JSON.parse(el.dataset.topFaces)),[ELEMENTS[faces.first].name,ELEMENTS[faces.second].name,faces.pips]);
      await assertPublic(overlay);
      await overlay.screenshot({path:path.join(output,'dice-settled-'+size+'.png')});
      await expect(controller.getByRole('button',{name:'摇 卦',exact:true})).toBeEnabled();
      const actual=await controller.evaluate(()=>window.oracle.getState().then(s=>s.result));
      assert.equal(faces.first,actual.upperIndex);
      assert.equal(faces.second,actual.lowerIndex);
      assert.equal(faces.pips,actual.moving);
      state=await controller.evaluate(()=>window.oracle.getState());
    }
    await controller.getByLabel('直播窗口置顶').click();
    await expect(controller.getByLabel('直播窗口置顶')).not.toBeChecked();
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='灵感骰子 · 直播组件').isAlwaysOnTop()),false);
    await controller.getByLabel('窗外背景').selectOption('transparent');
    await expect.poll(()=>overlay.locator('.overlay-surface').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    await overlay.screenshot({path:path.join(output,'overlay-transparent.png'),omitBackground:true});
    const id=state.result.id;
    await app.close();
    ({controller,overlay}=await launch());
    state=await controller.evaluate(()=>window.oracle.getState());
    assert.equal(state.result.id,id); assert.equal(state.settings.size,720); assert.equal(state.settings.background,'transparent');
    await controller.getByRole('button',{name:'关闭直播窗口',exact:true}).click();
    await expect.poll(()=>app.windows().length).toBe(2);
    await controller.getByRole('button',{name:'打开直播窗口',exact:true}).click();
    await expect.poll(()=>app.windows().length).toBe(3);
    await app.close();

    // Reproducible design fixture, isolated from the user's actual history.
    const record={upperIndex:0,lowerIndex:1,moving:3,topic:'today',nickname:'小满',id:'visual-fixture',time:Date.now()};
    await fs.writeFile(path.join(data,'oracle-state.json'),JSON.stringify({version:1,history:[record],draft:{topic:'today',nickname:'小满'},settings:{size:480,background:'transparent',alwaysOnTop:false}}));
    ({controller,overlay}=await launch());
    await overlay.evaluate(()=>document.fonts.ready);
    await waitForCardInk(overlay);
    await assertArtwork(overlay,0,1);
    await overlay.screenshot({path:path.join(output,'final-card.png'),omitBackground:true});
    await controller.screenshot({path:path.join(output,'final-controller.png')});
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle()==='灵感骰子 · 直播组件').setContentSize(1254,1254));
    await overlay.screenshot({path:path.join(output,'concept-size-card.png'),omitBackground:true});
    for (const [upperIndex,lowerIndex] of [[5,0],[5,7],[3,6],[6,3],[0,0],[1,1]]) {
      // Restore varied drawing pairs through persistence and ordinary restart.
      await app.close();
      await fs.writeFile(path.join(data,'oracle-state.json'),JSON.stringify({history:[{...record,upperIndex,lowerIndex}],settings:{size:240,background:'transparent'}}));
      ({controller,overlay}=await launch());
      await waitForCardInk(overlay);
      await assertArtwork(overlay,upperIndex,lowerIndex);
      await overlay.screenshot({path:path.join(output,`pair-${upperIndex}-${lowerIndex}.png`)});
    }
    await app.close(); app=null;
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,output,checks:['roll lock','frozen draft','two windows sync','IPC authorization','history','guide','240/360/480/720','transparency','always-on-top','restart restore','reopen overlay','restored nature drawings fit paper','text-free public window','zero renderer errors']},null,2));
  } finally { if(app) await app.close().catch(()=>{}); }
})().catch(error=>{console.error(error);process.exitCode=1;});

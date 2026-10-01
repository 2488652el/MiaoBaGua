const {_electron,expect:baseExpect}=require('@playwright/test');
const expect=baseExpect.configure({timeout:9000});
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const output=path.resolve(process.env.ORACLE_QA_DIR||'验收截图/灵感骰子-异常验收');await fs.mkdir(output,{recursive:true});
  const env={...process.env,ORACLE_DATA_DIR:await fs.mkdtemp(path.join(os.tmpdir(),'inspiration-public-'))};delete env.ELECTRON_RUN_AS_NODE;
  const app=await _electron.launch({...(process.env.ORACLE_QA_EXE?{executablePath:path.resolve(process.env.ORACLE_QA_EXE),args:[]}:{args:[root]}),env});
  const errors=[];
  app.on('window',page=>page.on('pageerror',error=>errors.push(error.message)));
  await app.context().addInitScript(()=>{
    window.qaPaintedText=[];
    for(const method of ['fillText','strokeText']){
      const original=CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method]=function(text,...args){window.qaPaintedText.push(String(text));return original.call(this,text,...args);};
    }
  });
  const excluded=/卦|爻|乾|坤|艮|巽|坎|兑|算命|占卜|运势|吉凶|[\u2630-\u2637]/u;
  async function assertPublic(page){
    assert.doesNotMatch(await page.locator('body').innerText(),excluded);
    assert.equal((await page.locator('body').innerText()).trim(),'','public DOM must contain no visible words');
    assert.equal(await page.locator('svg text').count(),0,'SVG artwork must contain no lettering');
    assert.deepEqual(await page.evaluate(()=>window.qaPaintedText||[]),[],'canvas textures must contain no lettering');
    assert.equal(await page.title(),'灵感骰子 · 直播组件');
    const state=await page.evaluate(()=>window.oracle.getState());
    assert.deepEqual(Object.keys(state).sort(),['revision','phase','diceSettled','diceMotion','settings','liveResult'].sort());
  }
  try{
    await expect.poll(()=>app.windows().length).toBe(3);
    const controller=app.windows().find(p=>!p.url().includes('window='));
    let overlay=app.windows().find(p=>p.url().includes('overlay'));
    await overlay.reload();
    await controller.getByRole('button',{name:'摇 卦',exact:true}).waitFor();
    await overlay.getByTestId('card-result').waitFor();
    await assertPublic(overlay);
    await overlay.screenshot({path:path.join(output,'idle.png')});
    await controller.getByRole('button',{name:'摇 卦',exact:true}).click();
    await expect(overlay.getByTestId('rolling-dice')).toBeVisible();
    await assertPublic(overlay);
    await overlay.screenshot({path:path.join(output,'rolling-no-text.png')});
    await controller.getByRole('button',{name:'关闭直播窗口',exact:true}).click();
    await controller.getByRole('button',{name:'打开直播窗口',exact:true}).click();
    await expect.poll(()=>app.windows().length).toBe(3);
    overlay=app.windows().find(p=>p.url().includes('overlay'));
    await overlay.getByTestId('card-result').waitFor();await assertPublic(overlay);
    await expect(controller.getByRole('button',{name:'摇 卦',exact:true})).toBeEnabled();
    await expect(overlay.locator('.nature-illustration')).toBeVisible();
    await assertPublic(overlay);
    const result=await controller.evaluate(()=>window.oracle.getState().then(s=>s.liveResult));
    const {ELEMENTS}=await import('../src/broadcast.js');
    await expect(overlay.locator('.nature-upper')).toHaveAttribute('data-nature',ELEMENTS[result.first].name);
    await expect(overlay.locator('.nature-lower')).toHaveAttribute('data-nature',ELEMENTS[result.second].name);
    await expect(controller.getByRole('heading',{name:'本次卦象',exact:true})).toBeVisible();
    await expect(overlay.locator('.nature-symbol path').first()).toBeVisible();
    await overlay.screenshot({path:path.join(output,'result-no-text.png')});
    for(const size of [240,720]){
      await controller.getByRole('button',{name:String(size),exact:true}).click();
      await expect.poll(()=>overlay.evaluate(()=>innerWidth)).toBe(size);
      await assertPublic(overlay);
      await overlay.screenshot({path:path.join(output,`result-${size}.png`)});
    }
    await controller.getByRole('button',{name:'480',exact:true}).click();
    assert.deepEqual(errors,[]);

    // Simulate an unavailable GPU in this isolated renderer only.
    await overlay.addInitScript(()=>{
      const getContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:getContext.call(this,type,...args);};
    });
    await overlay.reload();await overlay.getByTestId('card-result').waitFor();
    await controller.getByRole('button',{name:'摇 卦',exact:true}).click();
    await expect(overlay.locator('.dice-fallback')).toBeVisible();
    await expect(overlay.locator('.dice-fallback svg')).toHaveCount(3);
    await assertPublic(overlay);
    await overlay.screenshot({path:path.join(output,'no-webgl.png')});
    await expect(controller.getByRole('button',{name:'摇 卦',exact:true})).toBeEnabled();
    await expect(overlay.locator('.nature-illustration')).toBeVisible();

    // Force a rejected state request containing private wording; the public
    // Public connection errors stay textless, including private exception text.
    await app.evaluate(({ipcMain,BrowserWindow})=>{
      const window=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='灵感骰子 · 直播组件');
      const send=window.webContents.send.bind(window.webContents);
      window.webContents.send=(channel,...args)=>{if(channel!=='oracle:update')send(channel,...args);};
      ipcMain.removeHandler('oracle:state');
      ipcMain.handle('oracle:state',()=>{throw new Error('卦象读取失败：私密内容');});
    });
    await overlay.reload();
    await expect(overlay.locator('.loading-screen')).toHaveAttribute('data-status','error');
    await expect(overlay.locator('.loading-screen')).toHaveText('');
    assert.equal((await overlay.locator('body').innerText()).trim(),'');
    await overlay.screenshot({path:path.join(output,'connection-error.png')});
    console.log(JSON.stringify({passed:true,output,checks:['public-only IPC','textless DOM, SVG and canvas textures','idle, rolling and result','correct result motifs retained','private studio results retained','240/480/720','reopen during roll','textless GPU fallback','textless connection error','zero normal renderer errors']},null,2));
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

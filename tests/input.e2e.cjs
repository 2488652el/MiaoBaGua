const {_electron,expect:baseExpect}=require('@playwright/test');
const expect=baseExpect.configure({timeout:9000});
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');

(async()=>{
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'oracle-input-'));
  const output=path.resolve(process.env.ORACLE_QA_DIR||'验收截图/输入修复-开发');await fs.mkdir(output,{recursive:true});
  const env={...process.env,ORACLE_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
  const launch=()=>_electron.launch({...(process.env.ORACLE_QA_EXE?{executablePath:path.resolve(process.env.ORACLE_QA_EXE),args:[]}:{args:[path.resolve(__dirname,'..')]}),env});
  let app=await launch();const errors=[];
  try{
    await expect.poll(()=>app.windows().length).toBe(3);
    let page=app.windows().find(p=>!p.url().includes('window='));
    page.on('pageerror',e=>errors.push(e.message));
    const input=page.getByLabel('粉丝的问题',{exact:true});await input.waitFor();
    await input.click();
    await input.pressSequentially('abcdef123456',{delay:0});await expect(input).toHaveValue('abcdef123456');
    await expect.poll(()=>page.evaluate(()=>window.oracle.getState().then(s=>s.draft.question))).toBe('abcdef123456');
    await input.fill('我想换工作');await input.evaluate(el=>el.setSelectionRange(2,2));
    await page.keyboard.insertText('最近');await expect(input).toHaveValue('我想最近换工作');
    assert.equal(await input.evaluate(el=>el.selectionStart),4,'insertion must retain the caret');
    // Wait for unrelated renderer updates: the caret must stay in the middle.
    await page.evaluate(()=>window.oracle.setSettings({size:360}));
    assert.equal(await input.evaluate(el=>el.selectionStart),4);
    await page.keyboard.press('Backspace');await expect(input).toHaveValue('我想最换工作');
    assert.equal(await input.evaluate(el=>el.selectionStart),3);
    await input.fill('');await expect.poll(()=>page.evaluate(()=>window.oracle.getState().then(s=>s.draft.question))).toBe('');
    await input.focus();const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.imeSetComposition',{text:'woxiang',selectionStart:7,selectionEnd:7});
    await expect(input).toHaveValue('woxiang');
    await page.evaluate(()=>window.oracle.setSettings({size:480}));
    assert.equal(await page.evaluate(()=>window.oracle.getState().then(s=>s.draft.question)),'','uncommitted pinyin must not be saved');
    await cdp.send('Input.insertText',{text:'我想'});await expect(input).toHaveValue('我想');
    await expect.poll(()=>page.evaluate(()=>window.oracle.getState().then(s=>s.draft.question))).toBe('我想');
    await cdp.send('Input.imeSetComposition',{text:'huan',selectionStart:4,selectionEnd:4});
    await cdp.send('Input.imeSetComposition',{text:'',selectionStart:0,selectionEnd:0});
    await expect(input).toHaveValue('我想');
    const pasted='我想换工作，应该考虑哪些条件？\n目前有两个选择，收入相近。';
    await input.fill('');await page.keyboard.insertText(pasted);await expect(input).toHaveValue(pasted);
    await input.press('Control+z');await expect(input).toHaveValue('');
    await input.press('Control+Shift+z');await expect(input).toHaveValue(pasted);
    const nickname=page.getByLabel('观众昵称',{exact:true});await nickname.focus();
    await cdp.send('Input.imeSetComposition',{text:'xiaoming',selectionStart:8,selectionEnd:8});
    await cdp.send('Input.insertText',{text:'小明'});await expect(nickname).toHaveValue('小明');
    // Model a slow main-process draft acknowledgement. The button carries the
    // editor snapshot, so a last keystroke never depends on a previous reply.
    await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('oracle:draft');ipcMain.handle('oracle:draft',async()=>{await new Promise(r=>setTimeout(r,180));return {};});});
    await input.fill('最后一字也要保存');
    await page.getByRole('button',{name:'摇 卦',exact:true}).click();
    await input.fill('下一位粉丝的问题');
    await expect(page.getByRole('button',{name:'摇 卦',exact:true})).toBeEnabled();
    let state=await page.evaluate(()=>window.oracle.getState());assert.equal(state.result.question,'最后一字也要保存');assert.equal(state.result.nickname,'小明');
    await expect(input).toHaveValue('下一位粉丝的问题');
    // Exercise the same request channel as the registered global shortcut.
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>!w.getTitle()==='灵感骰子 · 直播组件').webContents.send('oracle:request-roll'));
    await expect(page.getByRole('button',{name:'摇卦中…',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'摇 卦',exact:true})).toBeEnabled();
    state=await page.evaluate(()=>window.oracle.getState());assert.equal(state.result.question,'下一位粉丝的问题');
    await input.screenshot({path:path.join(output,'问题输入框.png')});
    await page.screenshot({path:path.join(output,'控制台.png')});
    await app.close();app=await launch();await expect.poll(()=>app.windows().length).toBe(3);
    page=app.windows().find(p=>!p.url().includes('window='));
    await expect(page.getByLabel('粉丝的问题',{exact:true})).toHaveValue('下一位粉丝的问题');
    assert.deepEqual(errors,[]);
    const report={passed:true,network:'none; isolated data and no API key',checks:['rapid typing','middle insertion and caret','backspace','IME composition and commit','IME cancellation','unrelated broadcasts during composition','multiline paste','undo and redo','nickname IME','last character with slow acknowledgement','frozen current question','shortcut captures latest question','restart restore','no renderer errors']};
    await fs.writeFile(path.join(output,'验收报告.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,output},null,2));
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const {_electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');

(async()=>{
  const root=path.resolve(__dirname,'..'),output=path.resolve(process.env.ORACLE_QA_DIR||'验收截图/体用规则-开发');
  await fs.mkdir(output,{recursive:true});
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'body-use-e2e-'));
  const oldText='【问题结论】\n旧规则验收文本。\n【体用与变化】\n上卦乾为体，下卦坤为用。';
  const fixture=moving=>({upperIndex:0,lowerIndex:1,moving,topic:'career',question:'如何安排下一阶段工作？',nickname:'规则验收',id:'line-'+moving,time:Date.now(),ai:{status:'success',text:oldText,model:'deepseek-flash',updatedAt:1}});
  await fs.writeFile(path.join(data,'oracle-state.json'),JSON.stringify({settings:{size:480,alwaysOnTop:false},history:[fixture(3),fixture(4)]}));
  const env={...process.env,ORACLE_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
  let app;const errors=[];
  try{
    app=await _electron.launch({...(process.env.ORACLE_QA_EXE?{executablePath:path.resolve(process.env.ORACLE_QA_EXE),args:[]}:{args:[root]}),env});
    app.on('window',page=>page.on('pageerror',e=>errors.push(e.message)));
    await expect.poll(()=>app.windows().length).toBe(3);
    const controller=app.windows().find(p=>!p.url().includes('window='));
    await expect(controller.locator('.body-use-rule-note')).toContainText('本次三爻在下卦，故下卦为体');
    const relation=controller.locator('.relation-row');
    await expect(relation.locator('span').nth(0)).toHaveText('体 坤 · 土下卦');
    await expect(relation.locator('span').nth(1)).toHaveText('用 乾 · 金上卦');
    await expect(relation.locator('strong')).toHaveText('体生用');
    const ai=controller.getByTestId('deepseek-reading');
    await expect(ai).toContainText('旧规则解读');
    await expect(ai.getByTestId('ai-answer')).not.toBeVisible();
    await ai.getByText('查看旧规则回答',{exact:true}).click();
    await expect(ai.getByTestId('ai-answer')).toContainText('旧规则验收文本');
    await ai.getByText('查看旧规则回答',{exact:true}).click();
    await ai.screenshot({path:path.join(output,'旧回答标记.png')});
    await controller.locator('.reading').screenshot({path:path.join(output,'三爻动-下卦为体.png')});
    await controller.getByRole('button',{name:'卦象记录 2'}).click();
    await controller.locator('.history-row').nth(1).click();
    await expect(controller.locator('.body-use-rule-note')).toContainText('本次四爻在上卦，故上卦为体');
    await expect(relation.locator('span').nth(0)).toHaveText('体 乾 · 金上卦');
    await expect(relation.locator('span').nth(1)).toHaveText('用 坤 · 土下卦');
    await expect(relation.locator('strong')).toHaveText('用生体');
    await controller.locator('.reading').screenshot({path:path.join(output,'四爻动-上卦为体.png')});
    // Isolated transport verifies manual regeneration of a legacy record without paid requests.
    await app.evaluate(()=>{
      globalThis.ruleRequests=[];
      globalThis.fetch=async(url,init)=>{
        if(url!=='https://api.deepseek.com/chat/completions')throw Error('Unexpected destination');
        ruleRequests.push(JSON.parse(init.body));
        const text='【问题结论】\n新规则模拟验收回答。\n【体用与变化】\n四爻在上卦，乾金为体、坤土为用，用生体。';
        return new Response('data: '+JSON.stringify({choices:[{delta:{content:text},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
      };
    });
    await controller.evaluate(()=>window.oracle.setAiSettings({apiKey:'isolated-rule-test-key',model:'deepseek-flash',auto:true}));
    assert.equal(await app.evaluate(()=>ruleRequests.length),0,'enabling AI must not regenerate old records');
    await controller.getByRole('button',{name:'按新规则重新解读',exact:true}).click();
    await expect(ai).toContainText('解读完成');
    await expect(ai.getByTestId('ai-answer')).toBeVisible();
    await expect(ai.locator('.ai-rule-notice')).toHaveCount(0);
    const requests=await app.evaluate(()=>ruleRequests),sent=JSON.parse(requests[0].messages[1].content);
    assert.equal(requests.length,1);assert.equal(sent.体.名称,'乾');assert.equal(sent.用.名称,'坤');assert.equal(sent.体用关系,'用生体');
    assert.equal(sent.动爻.所在卦,'上卦');assert.equal(sent.体用判定规则.版本,'moving-trigram-is-body-v1');
    assert.match(requests[0].messages[0].content,/四爻、五爻、上爻动，上卦为体、下卦为用/);
    const state=await controller.evaluate(()=>window.oracle.getState());
    assert.equal(state.history.find(r=>r.id==='line-4').ai.ruleVersion,'moving-trigram-is-body-v1');
    assert.equal(state.history.find(r=>r.id==='line-3').ai.text,oldText);
    const saved=JSON.parse(await fs.readFile(path.join(data,'oracle-state.json'),'utf8'));
    assert.equal(saved.history.find(r=>r.id==='line-4').ai.ruleVersion,'moving-trigram-is-body-v1');
    await ai.screenshot({path:path.join(output,'按新规则重新解读-模拟接口.png')});
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(output,'验收报告.json'),JSON.stringify({version:JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,passed:true,checks:['third line lower body','fourth line upper body','historical local recalculation','legacy answer preserved and collapsed','no automatic history regeneration','manual retry carries new system rule and correct payload','new answer visible and rule version persisted','zero renderer errors'],network:'isolated mock official API transport',dataDirectory:data},null,2));
    console.log(JSON.stringify({passed:true,output},null,2));
  }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

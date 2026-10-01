const {_electron,expect:baseExpect}=require('@playwright/test');
const expect=baseExpect.configure({timeout:9000});
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');

(async()=>{
  const root=path.resolve(__dirname,'..'),output=path.resolve(process.env.ORACLE_QA_DIR||'验收截图/DeepSeek-开发');
  await fs.mkdir(output,{recursive:true});
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'deepseek-e2e-'));
  await fs.writeFile(path.join(data,'oracle-state.json'),JSON.stringify({settings:{size:480,alwaysOnTop:false}}));
  const env={...process.env,ORACLE_DATA_DIR:data};delete env.ELECTRON_RUN_AS_NODE;
  const testKey='test-key-for-isolated-acceptance';
  let app;const errors=[];
  async function launch(){
    app=await _electron.launch({...(process.env.ORACLE_QA_EXE?{executablePath:path.resolve(process.env.ORACLE_QA_EXE),args:[]}:{args:[root]}),env});
    app.on('window',page=>page.on('pageerror',e=>errors.push(e.message)));
    await expect.poll(()=>app.windows().length).toBe(3);
    const controller=app.windows().find(p=>!p.url().includes('window=')),overlay=app.windows().find(p=>p.url().includes('overlay'));
    await controller.getByRole('button',{name:'摇 卦',exact:true}).waitFor();
    // Only this isolated test process replaces the network transport; no production test endpoint.
    await app.evaluate(()=>{
      globalThis.qaDeepSeek={mode:'success',requests:[]};
      globalThis.fetch=async(url,init)=>{
        if(url==='https://api.deepseek.com/models')return Response.json({data:[{id:'deepseek-flash'},{id:'deepseek-v4-pro'}]});
        if(url!=='https://api.deepseek.com/chat/completions')throw Error('Unexpected network destination');
        const test=globalThis.qaDeepSeek,body=JSON.parse(init.body);test.requests.push(body);
        if(test.mode==='401')return new Response('Do not display provider errors or headers',{status:401});
        const prefix='【问题结论】\n这是接口模拟验收回答：先核实岗位和收入条件，再决定是否换工作。';
        const rest='\n【卦象依据】\n测试服务已接收到本次真实计算的本卦与问题。\n【体用与变化】\n测试服务已接收到体用、五行关系、动爻与变卦。\n【行动建议】\n1. 对比实际岗位条件。\n2. 明确收入与时间安排。\n3. 获取更多信息后再判断。';
        const encode=(text,finish=null)=>new TextEncoder().encode('data: '+JSON.stringify({choices:[{delta:{content:text},finish_reason:finish}]})+'\n\n');
        let cancelled=false,timer;
        return new Response(new ReadableStream({
          start(c){
            c.enqueue(encode(prefix));
            init.signal.addEventListener('abort',()=>{cancelled=true;clearTimeout(timer);try{c.error(init.signal.reason);}catch{}});
            if(test.mode!=='hold')timer=setTimeout(()=>{if(cancelled)return;c.enqueue(encode(rest,'stop'));c.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));c.close();},900);
          },cancel(){cancelled=true;clearTimeout(timer);}
        }));
      };
    });
    return {controller,overlay};
  }
  try{
    let {controller,overlay}=await launch();
    await controller.getByRole('button',{name:'DeepSeek 设置',exact:true}).click();
    const settings=controller.getByRole('dialog',{name:'DeepSeek 设置'});
    await settings.getByLabel('API Key',{exact:true}).fill(testKey);
    await settings.getByRole('button',{name:'保存设置',exact:true}).click();
    await expect(settings.getByRole('status')).toContainText('设置已保存');
    await expect(settings.getByLabel('API Key',{exact:true})).toHaveValue('');
    await settings.getByRole('button',{name:'测试已保存的连接'}).click();
    await expect(settings.getByRole('status')).toContainText('连接成功');
    await settings.screenshot({path:path.join(output,'设置界面-模拟密钥.png')});
    await controller.getByRole('button',{name:'关闭 DeepSeek 设置'}).click();
    const keyFile=await fs.readFile(path.join(data,'deepseek-settings.json'),'utf8');assert.ok(!keyFile.includes(testKey));
    await controller.getByLabel('粉丝的问题',{exact:true}).fill('我正在考虑换工作，应当先准备什么？');
    await controller.getByLabel('观众昵称',{exact:true}).fill('不传给模型的昵称');
    await controller.screenshot({path:path.join(output,'输入问题.png')});
    await controller.getByRole('button',{name:'摇 卦',exact:true}).click();
    await controller.getByLabel('粉丝的问题',{exact:true}).fill('下一位粉丝的问题');
    await expect(controller.getByTestId('deepseek-reading')).toContainText('解读完成',{timeout:12000});
    let state=await controller.evaluate(()=>window.oracle.getState());
    assert.equal(state.result.question,'我正在考虑换工作，应当先准备什么？');assert.equal(state.draft.question,'下一位粉丝的问题');
    const requests=await app.evaluate(()=>qaDeepSeek.requests);assert.equal(requests.length,1);
    const sent=JSON.parse(requests[0].messages[1].content);
    assert.equal(sent.问题,state.result.question);assert.equal(sent.本卦.名称,state.result.base.fullName);assert.equal(sent.体.名称,state.result.body.name);assert.equal(sent.体用关系,state.result.relation.name);assert.equal(sent.变卦.名称,state.result.changed.fullName);
    assert.equal(sent.体.名称,state.result.moving<=3?state.result.lower.name:state.result.upper.name);
    assert.equal(sent.体.位置,state.result.moving<=3?'下卦':'上卦');
    assert.equal(sent.动爻.所在卦,sent.体.位置);
    assert.equal(sent.体用判定规则.版本,'moving-trigram-is-body-v1');
    assert.equal(state.result.ai.ruleVersion,sent.体用判定规则.版本);
    assert.match(requests[0].messages[0].content,/动者为体/);
    assert.match(requests[0].messages[0].content,/第一句以“按本次卦象，我的判断是：”开头/);
    assert.match(requests[0].messages[0].content,/比较或二选一问题，必须明确更建议哪一项/);
    assert.match(requests[0].messages[0].content,/结论、分析和建议必须一致/);
    assert.doesNotMatch(requests[0].messages[0].content,/不强行给绝对是非/);
    assert.ok(!JSON.stringify(requests).includes('不传给模型的昵称'));assert.ok(!JSON.stringify(state).includes(testKey));
    const publicState=await overlay.evaluate(()=>window.oracle.getState());
    for(const key of ['aiConfig','question','history','draft','ai'])assert.ok(!(key in publicState));
    assert.doesNotMatch(JSON.stringify(publicState),/换工作|粉丝|test-key|模拟验收/);
    const denied=await overlay.evaluate(async()=>{
      const results=await Promise.allSettled([window.oracle.setAiSettings({apiKey:'malicious-test'}),window.oracle.testAi(),window.oracle.readAi('one'),window.oracle.cancelAi('one')]);return results.every(r=>r.status==='rejected');
    });assert.equal(denied,true);
    await controller.getByTestId('deepseek-reading').screenshot({path:path.join(output,'自动解读-模拟接口.png')});
    await overlay.screenshot({path:path.join(output,'直播窗口.png')});
    await app.evaluate(()=>{qaDeepSeek.mode='401';});
    await controller.getByRole('button',{name:'重新解读',exact:true}).click();
    await expect(controller.getByTestId('deepseek-reading')).toContainText('API Key 无效');
    await app.evaluate(()=>{qaDeepSeek.mode='success';});
    await controller.getByRole('button',{name:'重试解读',exact:true}).click();
    await expect(controller.getByTestId('deepseek-reading')).toContainText('解读完成');
    await app.evaluate(()=>{qaDeepSeek.mode='hold';});
    await controller.getByRole('button',{name:'重新解读',exact:true}).click();
    await expect(controller.getByTestId('deepseek-reading')).toContainText('正在生成');
    await controller.getByRole('button',{name:'停止生成'}).click();
    await expect(controller.getByTestId('deepseek-reading')).toContainText('已停止生成');
    await app.evaluate(()=>{qaDeepSeek.mode='success';});
    await controller.getByRole('button',{name:'重试解读',exact:true}).click();
    await expect(controller.getByTestId('deepseek-reading')).toContainText('解读完成');
    const originalId=state.result.id;
    await controller.getByLabel('粉丝的问题',{exact:true}).fill('');
    await controller.getByRole('button',{name:'摇 卦',exact:true}).click();
    await expect(controller.getByRole('button',{name:'摇 卦',exact:true})).toBeEnabled();
    assert.equal(await app.evaluate(()=>qaDeepSeek.requests.length),5,'empty question must not request AI');
    await controller.getByRole('button',{name:'卦象记录 2'}).click();
    await controller.locator('.history-row').last().click();
    await expect(controller.getByTestId('deepseek-reading')).toContainText('解读完成');
    await app.close();app=null;
    ({controller,overlay}=await launch());
    state=await controller.evaluate(()=>window.oracle.getState());
    assert.equal(state.aiConfig.configured,true);assert.equal(state.aiConfig.keyStorage,'encrypted');assert.equal(state.history.find(r=>r.id===originalId).ai.status,'success');
    assert.equal(await app.evaluate(()=>qaDeepSeek.requests.length),0,'restart must not trigger billable requests');
    await controller.getByRole('button',{name:'卦象记录 2'}).click();await controller.locator('.history-row').last().click();
    await expect(controller.getByTestId('deepseek-reading')).toContainText('模拟验收回答');
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(output,'验收报告.json'),JSON.stringify({version:JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,passed:true,network:'mocked official API transport in isolated test process; no real DeepSeek request',checks:['Windows encrypted key','settings and connection test','frozen question','one automatic request per cast','accurate original and changed data','streamed answer','401 and retry','cancel','empty question skips request','history and restart','no billable request on restart','overlay IPC denied','private content isolated','zero renderer errors'],dataDirectory:data},null,2));
    console.log(JSON.stringify({passed:true,output,network:'mocked; no live credentials'},null,2));
  }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

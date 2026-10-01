import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildMessages,streamReading,ReadingManager,DeepSeekError,testConnection} from '../electron/deepseek.js';
import {DeepSeekConfig} from '../electron/deepseek-config.js';
import {OracleEngine} from '../src/state.js';
import {cast,TRIGRAMS,BODY_USE_RULE} from '../src/oracle.js';
import {toBroadcastState} from '../src/broadcast.js';

const row=(id='one')=>({upperIndex:0,lowerIndex:1,moving:3,question:'我该如何准备换工作？',nickname:'不要发送这个昵称',topic:'career',time:1,id});
const piece=(content,finish_reason=null)=>'data: '+JSON.stringify({choices:[{delta:{content},finish_reason}]})+'\r\n\r\n';
function response(text){const bytes=new TextEncoder().encode(text);return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close();}}));}
const options={key:'test-secret-do-not-return',model:'deepseek-flash',record:row(),onText:()=>{}};

test('全部384组请求准确包含本卦变卦动爻体用，仅发送本次问题和主题',()=>{
  for(let a=0;a<8;a++)for(let b=0;b<8;b++)for(let p=1;p<=6;p++){
    const record={...row(),upperIndex:a,lowerIndex:b,moving:p,base:{fullName:'伪造名称'},history:['不应发送']};
    const messages=buildMessages(record),payload=JSON.parse(messages[1].content),r=cast(a,b,p);
    assert.equal(payload.本卦.名称,r.base.fullName);assert.equal(payload.变卦.名称,r.changed.fullName);
    assert.equal(payload.动爻.序号,p);assert.equal(payload.体.名称,r.body.name);assert.equal(payload.用.名称,r.use.name);
    assert.equal(payload.体用关系,r.relation.name);assert.equal(payload.问题,record.question);
    assert.equal(payload.体.名称,TRIGRAMS[p<=3?b:a].name);assert.equal(payload.用.名称,TRIGRAMS[p<=3?a:b].name);
    assert.equal(payload.动爻.所在卦,p<=3?'下卦':'上卦');
    assert.equal(payload.体用判定规则.版本,BODY_USE_RULE.id);
    assert.match(messages[0].content,/动者为体/);assert.match(messages[0].content,/初爻、二爻、三爻动，下卦为体、上卦为用/);
    assert.doesNotMatch(JSON.stringify(messages),/不要发送这个昵称|伪造名称|不应发送/);
  }
});
test('SSE处理碎片UTF8、心跳与多行；只显示回答，不显示推理内容',async()=>{
  let body;const updates=[];
  const answer=await streamReading({...options,onText:t=>updates.push(t),fetchImpl:async(url,request)=>{
    assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(request.redirect,'error');body=JSON.parse(request.body);
    return response(': heartbeat\r\n\r\ndata: '+JSON.stringify({choices:[{delta:{reasoning_content:'不展示'}}]})+'\r\n\r\n'+piece('【问题结论】\n先做准备。')+piece('再作决定。','stop')+'data: [DONE]\r\n\r\n');
  }});
  assert.equal(answer,'【问题结论】\n先做准备。再作决定。');assert.equal(updates.length,2);
  assert.equal(body.stream,true);assert.equal(body.thinking.type,'disabled');assert.doesNotMatch(answer,/不展示/);
  const prompt=body.messages[0].content;
  assert.match(prompt,/第一句以“按本次卦象，我的判断是：”开头/);
  assert.match(prompt,/比较或二选一问题，必须明确更建议哪一项/);
  assert.match(prompt,/不得用“可能、也许、或许、看情况、因人而异、取决于你自己”代替主判断/);
  assert.match(prompt,/体用及五行生克方向如何支持判断/);
  assert.match(prompt,/动爻的位置与阴阳变化/);
  assert.match(prompt,/变卦如何补充后续变化/);
  assert.match(prompt,/不构成捏造现实事实的许可/);
  assert.doesNotMatch(prompt,/不强行给绝对是非/);
});
test('HTTP错误使用固定提示，不回显服务端响应或密钥',async()=>{
  for(const status of [401,402,429,503])await assert.rejects(streamReading({...options,fetchImpl:async()=>new Response('leaked test-secret-do-not-return',{status})}),e=>e instanceof DeepSeekError&&!e.message.includes('test-secret')&&!e.message.includes('leaked'));
});
test('截断、无结束状态、错误数据和取消都不会标为成功',async()=>{
  for(const text of [piece('部分答案','length'),piece('未完整答案'), 'data: wrong\n\n',piece('','stop')])await assert.rejects(streamReading({...options,fetchImpl:async()=>response(text)}),DeepSeekError);
  const controller=new AbortController();controller.abort();
  await assert.rejects(streamReading({...options,signal:controller.signal,fetchImpl:async()=>response(piece('晚到答案','stop'))}),/停止/);
  await assert.rejects(streamReading({...options,timeoutMs:10,fetchImpl:(_url,{signal})=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve(response('')),60);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);});})}),/超时/);
});
test('测试连接只读取模型列表，不发送问题或请求解读',async()=>{
  const result=await testConnection({...options,fetchImpl:async(url,init)=>{assert.equal(url,'https://api.deepseek.com/models');assert.equal(init.body,undefined);return Response.json({data:[{id:'deepseek-flash'}]});}});
  assert.match(result,/成功/);
});
test('请求取消后晚到响应不能覆盖下一条记录；重试独立且不重复发送',async()=>{
  const engine=new OracleEngine({saved:{history:[row(),row('two')]}});const jobs=[];
  const manager=new ReadingManager({engine,config:()=>({key:'fake-key',model:'deepseek-flash'}),request:opts=>new Promise(resolve=>jobs.push({opts,resolve}))});
  assert.equal(manager.run('one'),true);const firstPromise=manager.job.promise;
  assert.equal(manager.run('one'),false);jobs[0].opts.onText('旧的部分回答');
  manager.run('two');const secondPromise=manager.job.promise;
  jobs[0].resolve('旧的完整回答');await firstPromise;
  assert.equal(engine.state.history[0].ai.status,'cancelled');assert.equal(engine.state.history[0].ai.text,'旧的部分回答');
  jobs[1].resolve('新的完整回答');await secondPromise;
  assert.equal(engine.state.history[1].ai.text,'新的完整回答');assert.equal(engine.state.result.id,'one');
  assert.ok(!('ai' in toBroadcastState(engine.state)));assert.ok(!JSON.stringify(toBroadcastState(engine.state)).includes(row().question));
  manager.run('one');jobs[2].resolve('重试的结果');await manager.job.promise;
  assert.equal(engine.state.result.ai.text,'重试的结果');
  assert.equal(engine.state.result.ai.ruleVersion,BODY_USE_RULE.id);
});
test('新问题在起卦时冻结，AI记录重启恢复；中断状态可重试',()=>{
  let finish,saved,completed;const timers={setInterval:()=>1,clearInterval:()=>{},setTimeout:fn=>(finish=fn,2),clearTimeout:()=>{}};
  const engine=new OracleEngine({timers,persist:s=>saved=structuredClone(s),onResult:r=>completed=r});
  engine.updateDraft({question:'第一位的问题'});engine.start();engine.updateDraft({question:'下一位的问题'});finish();
  assert.equal(completed.question,'第一位的问题');assert.equal(engine.state.result.question,'第一位的问题');
  engine.updateAi(completed.id,{status:'streaming',text:'部分内容',model:'deepseek-flash',updatedAt:1});
  const restored=new OracleEngine({saved});assert.equal(restored.state.result.ai.status,'cancelled');assert.equal(restored.state.result.ai.text,'部分内容');assert.equal(restored.state.draft.question,'下一位的问题');
});
test('密钥只加密落盘，公共配置无密钥；可保留、恢复和移除',()=>{
  const directory=mkdtempSync(path.join(os.tmpdir(),'deepseek-key-test-'));
  const storage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from([...s].reverse().join('')),decryptString:b=>[...b.toString()].reverse().join('')};
  const config=new DeepSeekConfig(directory,storage);config.update({apiKey:'test-key-never-public',model:'deepseek-v4-pro',auto:false});
  const serialized=readFileSync(config.file,'utf8');assert.ok(!serialized.includes('test-key-never-public'));assert.ok(!JSON.stringify(config.publicState()).includes('test-key-never-public'));
  config.update({apiKey:'',auto:true});assert.equal(config.privateState().key,'test-key-never-public');
  const restored=new DeepSeekConfig(directory,storage);assert.equal(restored.privateState().key,'test-key-never-public');assert.equal(restored.publicState().keyStorage,'encrypted');
  restored.update({clearKey:true});assert.equal(new DeepSeekConfig(directory,storage).publicState().configured,false);
});

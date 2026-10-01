import { useEffect, useRef, useState } from 'react';
import { bridge } from '../bridge.js';
import { BODY_USE_RULE } from '../oracle.js';

function friendlyError(error){return (error.message||'操作未完成，请重试。').replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}

export function DeepSeekSettings({config,onClose}) {
  const dialog=useRef(null);
  const [key,setKey]=useState(''),[model,setModel]=useState(config?.model||'deepseek-flash');
  const [auto,setAuto]=useState(config?.auto!==false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{dialog.current.showModal();},[]);
  const perform=async action=>{if(busy)return;setBusy(true);setMessage('');setError('');try{await action();}catch(e){setError(friendlyError(e));}finally{setBusy(false);}};
  return <dialog ref={dialog} className="guide-dialog deepseek-dialog" aria-label="DeepSeek 设置" onCancel={onClose}>
    <div className="dialog-heading"><div><h2>连接 DeepSeek</h2><p>骰子停稳后，自动解读本次问题</p></div><button className="icon-button" aria-label="关闭 DeepSeek 设置" onClick={onClose}>×</button></div>
    <form onSubmit={e=>{e.preventDefault();perform(async()=>{const saved=await bridge.setAiSettings({apiKey:key,model,auto});setKey('');setMessage(saved.warning||'设置已保存。可以测试连接或开始提问。');});}}>
      <label className="ai-field">API Key<input type="password" autoComplete="off" spellCheck="false" value={key} onChange={e=>setKey(e.target.value)} placeholder={config?.configured?'已保存，留空则保留现有密钥':'粘贴你的 DeepSeek API Key'} maxLength={256}/></label>
      <p className="ai-key-state">{config?.configured?(config.keyStorage==='encrypted'?'密钥已由 Windows 加密保存':'密钥仅用于本次运行'):'尚未保存密钥'} · 密钥不会显示在直播窗口</p>
      <p className="ai-key-state">API Key 可在 DeepSeek 开放平台 platform.deepseek.com 创建。</p>
      <label className="ai-field">模型<select value={model} onChange={e=>setModel(e.target.value)}><option value="deepseek-flash">DeepSeek Flash · 默认</option><option value="deepseek-v4-pro">DeepSeek V4 Pro</option></select></label>
      <label className="ai-auto"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>摇骰子后自动解读</label>
      <p className="ai-data-note">启用后，每次有问题的投掷会将问题、主题和本次卦象体用发送至 DeepSeek 官方 API，按你的账户计费。回答仅在主播控制台显示，问题与回答随记录保存在本机。观众昵称和其他历史不会发送。</p>
      <div className="ai-settings-actions"><button className="primary-button" disabled={busy} type="submit">{busy?'处理中…':'保存设置'}</button><button type="button" className="secondary-button" disabled={busy||!config?.configured} onClick={()=>perform(async()=>setMessage(await bridge.testAi()))}>测试已保存的连接</button></div>
      {config?.configured && <button type="button" className="quiet-button ai-remove-key" disabled={busy} onClick={()=>perform(async()=>{await bridge.setAiSettings({clearKey:true});setKey('');setMessage('密钥已移除。');})}>移除已保存的密钥</button>}
      {(error||message||config?.warning) && <p role={error?'alert':'status'} className={error?'error-message':'ai-config-message'}>{error||message||config.warning}</p>}
    </form>
  </dialog>;
}

function Answer({text}) {
  const parts=text.split(/【(问题结论|卦象依据|体用与变化|行动建议)】/);
  return <div className="ai-answer" data-testid="ai-answer">
    {parts[0].trim() && <p>{parts[0]}</p>}
    {parts.slice(1).reduce((sections,value,index,array)=>{
      if(index%2===0)sections.push(<section key={index} className={value==='问题结论'?'ai-conclusion':'ai-answer-section'}><h3>{value}</h3><p>{(array[index+1]||'').trim()}</p></section>);
      return sections;
    },[])}
  </div>;
}

export function DeepSeekReading({record,config,act,onSettings}) {
  if(!record)return null;
  const hasQuestion=!!record.question?.trim();
  const ai=record.ai,busy=ai?.status==='pending'||ai?.status==='streaming';
  const oldRule=!!ai?.text && ai.ruleVersion!==BODY_USE_RULE.id;
  const status=!hasQuestion?'未填写问题':oldRule?'旧规则解读':({pending:'正在连接…',streaming:'正在生成…',success:'解读完成',error:'生成未完成',cancelled:'已停止'})[ai?.status]||'等待解读';
  return <section className="ai-reading" data-testid="deepseek-reading">
    <div className="section-heading"><h2>DeepSeek 解读</h2><span className={busy?'ai-busy':''}>{status}</span></div>
    {hasQuestion?<div className="ai-question"><span>本次问题 · 仅你可见</span><p>{record.question}</p></div>:<p className="ai-empty">本次未填写问题。填写问题后摇卦，可结合卦象与体用生成 DeepSeek 解读。</p>}
    {hasQuestion && !ai && <p className="ai-empty">{config?.configured?'点击下方按钮，解读这条记录的问题与卦象。':'连接 DeepSeek 后，就能自动获得问题结论与完整解读。'}</p>}
    {oldRule && <div className="ai-rule-notice" role="note">此回答生成于体用规则更新前，可能采用相反的体用。当前卦象已按“动爻所在卦为体”重算。{config?.configured?'点击“按新规则重新解读”可更新回答。':'连接 DeepSeek 后可按新规则重新解读。'}</div>}
    {ai?.text && (oldRule?<details className="ai-old-answer"><summary>查看旧规则回答</summary><Answer text={ai.text}/></details>:<Answer text={ai.text}/>)}
    {ai?.status==='pending' && <p role="status" className="ai-waiting">正在结合问题、本卦、变卦与体用关系生成解读…</p>}
    {ai?.error && <p role="alert" className="error-message">{ai.error}</p>}
    <div className="ai-reading-actions">
      {hasQuestion && (busy?<button className="secondary-button" onClick={()=>act(()=>bridge.cancelAi(record.id))}>停止生成</button>:config?.configured?<button className="secondary-button" onClick={()=>act(()=>bridge.readAi(record.id))}>{oldRule?'按新规则重新解读':ai?.status==='success'?'重新解读':ai?'重试解读':'解读本次问题'}</button>:<button className="secondary-button" onClick={onSettings}>连接 DeepSeek</button>)}
      <span>{ai?.model||'DeepSeek'} · AI 文化解读，供思考参考</span>
    </div>
  </section>;
}

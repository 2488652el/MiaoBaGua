import { useCallback, useEffect, useRef, useState } from 'react';
import { version as APP_VERSION } from '../package.json';
import { bridge } from './bridge.js';
import { NUMERALS, LINE_NAMES } from './oracle.js';
import { SIZES } from './state.js';
import { TOPICS } from './readings.js';
import { LIVE_TITLE, CAT_TITLE, liveIdea } from './broadcast.js';
import OracleCard from './components/OracleCard.jsx';
import Hexagram from './components/Hexagram.jsx';
import Icon from './components/Icon.jsx';
import { DeepSeekReading, DeepSeekSettings } from './components/DeepSeek.jsx';
import { QUESTION_LIMIT } from './ai-record.js';
import { useStudioDraft } from './useStudioDraft.js';
import CatCompanion from './components/CatCompanion.jsx';
import CatSettings from './components/CatSettings.jsx';

const overlayMode = new URLSearchParams(window.location.search).get('window') === 'overlay';
const catMode = new URLSearchParams(window.location.search).get('window') === 'cat';
const publicMode = overlayMode || catMode;
const dateFormat = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

function Reading({ result, historical, children }) {
  if (!result) return <section className="empty-reading"><div className="empty-symbol">卦</div><h2>心中有问，静候一卦</h2><p>选择主题，点击「摇卦」。<br/>直播窗口只显示图案，文字结果留在控制台。</p></section>;
  const topic = TOPICS.find(t => t.id === result.topic);
  return <div className="reading">
    <section className="hexagram-reading" aria-live="polite" aria-label={historical ? '历史卦象' : '本次卦象'}>
      <div className="section-heading"><h2>{historical ? '历史卦象' : '本次卦象'}</h2><span>{result.nickname || '未署名'} · {topic.name} · {dateFormat.format(result.time)}</span></div>
      <div className="cast-values"><span>上卦 <b>{result.upper.name} · {result.upper.nature}</b></span><span>下卦 <b>{result.lower.name} · {result.lower.nature}</b></span><span>动爻 <b>{NUMERALS[result.moving - 1]} · {LINE_NAMES[result.moving - 1]}</b></span></div>
      <div className="hex-pair">
        <div className="result-tile"><span className="tile-label">本卦 · 第 {result.base.number} 卦</span><div><Hexagram bits={result.base.bits} moving={result.moving}/><h3>{result.base.fullName}<small>{result.upper.name}上 · {result.lower.name}下</small></h3></div></div>
        <Icon name="arrow"/>
        <div className="result-tile changed"><span className="tile-label">变卦 · 第 {result.changed.number} 卦</span><div><Hexagram bits={result.changed.bits} moving={result.moving}/><h3>{result.changed.fullName}<small>{LINE_NAMES[result.moving - 1]} · {result.base.bits[result.moving - 1] ? '阳变阴' : '阴变阳'}</small></h3></div></div>
      </div>
    </section>
    <section className="body-use-reading" aria-label="体用关系">
      <div className="section-heading"><h2>体用关系</h2><span>动爻所在卦为体</span></div>
      <div className="relation-row"><span>体 <b>{result.body.name} · {result.body.element}</b><small>{result.bodyPosition}</small></span><span>用 <b>{result.use.name} · {result.use.element}</b><small>{result.usePosition}</small></span><strong>{result.relation.name}</strong></div>
      <p className="body-use-rule-note">体用规则：动爻所在卦为体，另一卦为用。本次{LINE_NAMES[result.moving-1]}在{result.bodyPosition}，故{result.bodyPosition}为体。</p>
    </section>
    {children}
    <details className="local-reading" key={result.id}>
      <summary>本地参考解读 <Icon name="chevron" size={14}/></summary>
      <article className="interpretation"><div className="reading-title"><span>{topic.name}解读</span><h3>{result.reading.title}</h3></div><p>{result.reading.meaning}</p><p className="action-text">{result.reading.action}</p><p><b>{result.relation.name}：</b>{result.reading.relation}</p><p><b>{LINE_NAMES[result.moving - 1]}：</b>{result.reading.stage}</p><p><b>变卦 · {result.changed.fullName}：</b>{result.reading.changed}</p><p className="muted">以上为本地规则生成的民俗文化趣味解读。</p></article>
    </details>
  </div>;
}

function Guide({ onClose }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className="guide-dialog" onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="dialog-heading"><h2>把图案卡放进直播间</h2><button className="icon-button" aria-label="关闭使用说明" onClick={onClose}><Icon name="close"/></button></div>
    <ol className="guide-steps"><li><b>打开独立窗口</b><p>在右侧点击“打开直播窗口”。默认大小 480 × 480，可按需要调整。</p></li><li><b>直播伴侣添加素材</b><p>选择“窗口捕获”，找到 <strong>灵感骰子 · 直播组件</strong>。只采集这一个窗口。</p></li><li><b>抠除窗外背景</b><p>在窗口素材设置中启用绿幕抠图，用取色器选取图案卡外的洋红色。只移除背景，保留黄色卡面。</p></li><li><b>回到控制台摇卦</b><p>点击“摇卦”或按 Ctrl + Shift + G。直播画面先显示三个图案骰子，停下后显示上下排列的图案；标题、含义和所有文字结果都留在控制台。</p></li></ol>
    <div className="guide-note"><Icon name="info"/><p>透明模式是否能被采集取决于捕获方式；出现黑底时请切回纯色抠像。采集期间保持直播组件窗口打开，不要最小化。窗口可以拖到屏幕边缘。</p></div>
    <button className="primary-button" onClick={onClose}>知道了</button>
  </dialog>;
}

function Studio({ state, act, error }) {
  const [tab, setTab] = useState('studio');
  const [selectedId, setSelectedId] = useState(null);
  const [guide, setGuide] = useState(false);
  const [aiSettings,setAiSettings]=useState(false);
  const {draft,update,compositionStart,compositionEnd,snapshot,isComposing}=useStudioDraft(state.draft,act);
  const rolling = state.phase === 'rolling';
  const publicIdea = !rolling && liveIdea(state.liveResult);
  const record = selectedId ? state.history.find(row => row.id === selectedId) : state.result;
  const roll = useCallback(() => {
    if(isComposing())return;
    const currentDraft=snapshot();
    setSelectedId(null);setTab('studio');act(()=>bridge.roll(currentDraft));
  },[act,snapshot,isComposing]);
  useEffect(()=>bridge.onRollRequested(roll),[roll]);
  return <div className="studio-shell">
    <header className="app-header"><div className="brand"><span className="brand-seal">卦</span><div><h1>MiaoBaGua</h1><span>主播控制台 · v{APP_VERSION}</span></div></div><div className="header-actions"><button className="quiet-button deepseek-entry" onClick={()=>setAiSettings(true)}>DeepSeek <span>{state.aiConfig?.configured?'已配置':'未配置'}</span></button><button className="quiet-button" onClick={() => setGuide(true)}><Icon name="info"/>使用说明</button></div></header>
    <div className="studio-body">
      <main className="main-column">
        <nav className="tabs" aria-label="工作区"><button className={tab === 'studio' ? 'active' : ''} onClick={() => { setTab('studio'); setSelectedId(null); }}><Icon name="roll"/>摇卦工作台</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><Icon name="history"/>卦象记录 <span>{state.history.length}</span></button></nav>
        {tab === 'studio' ? <>
          <section className="cast-form"><div className="section-heading"><h2>这一次，问什么？</h2><span>仅你可见</span></div><div className="topic-options" role="group" aria-label="解读主题">{TOPICS.map(topic => <button key={topic.id} aria-pressed={draft.topic === topic.id} className={draft.topic === topic.id ? 'selected' : ''} onClick={() => update('topic',topic.id)}>{topic.name}<small>{topic.hint}</small></button>)}</div>
            <label className="question-label"><span>粉丝的问题 <small>{draft.question?.length||0} / {QUESTION_LIMIT}</small></span><textarea aria-label="粉丝的问题" rows={3} maxLength={QUESTION_LIMIT} placeholder="例如：我正在考虑换工作，该优先看哪些条件？" value={draft.question||''} onChange={event=>update('question',event.target.value)} onCompositionStart={()=>compositionStart('question')} onCompositionEnd={event=>compositionEnd('question',event.currentTarget.value)}/></label>
            <div className="ai-form-status"><span>{!state.aiConfig?.configured?'配置 DeepSeek 后可自动解读':state.aiConfig.auto?'骰子停稳后自动解读 · 仅控制台':'已配置 · 当前为手动解读'}</span><button className="quiet-button" onClick={()=>setAiSettings(true)}>DeepSeek 设置</button></div>
            <div className="roll-form-row"><label className="nickname-label"><span>观众昵称 <small>选填</small></span><input aria-label="观众昵称" maxLength={24} placeholder="为谁起这一卦…" value={draft.nickname} onChange={event=>update('nickname',event.target.value)} onCompositionStart={()=>compositionStart('nickname')} onCompositionEnd={event=>compositionEnd('nickname',event.currentTarget.value)}/></label><button className="primary-button roll-button" onClick={roll} disabled={rolling}><Icon name="roll" size={22}/>{rolling ? '摇卦中…' : '摇 卦'}</button></div>
            <div className="cast-hint"><span>{rolling ? '本次问题、主题与昵称已固定，修改将用于下一次。' : '填写问题后摇骰子，留空则只生成本地结果。'}</span><kbd>Ctrl</kbd><span>+</span><kbd>Shift</kbd><span>+</span><kbd>G</kbd></div>
          </section>
          {rolling ? <div className="rolling-notice" role="status"><span/>卦象正在变化，片刻即定…</div> : <Reading result={record} historical={!!selectedId}><DeepSeekReading record={record} config={state.aiConfig} act={act} onSettings={()=>setAiSettings(true)}/></Reading>}
        </> : <section className="history-panel"><div className="section-heading"><h2>最近 30 次</h2><span>记录只保存在这台电脑</span></div>{state.history.length === 0 ? <div className="history-empty"><Icon name="history" size={32}/><p>还没有卦象记录</p><button className="quiet-button" onClick={() => setTab('studio')}>去摇第一卦 <Icon name="arrow"/></button></div> : <div className="history-list">{state.history.map(row => <button key={row.id} className="history-row" onClick={() => { setSelectedId(row.id); setTab('studio'); }}><Hexagram bits={row.base.bits}/><span className="history-name"><b>{row.base.fullName}</b><small>{row.nickname || '未署名'} · {TOPICS.find(t => t.id === row.topic).name}</small></span><span className="history-time">{dateFormat.format(row.time)}<small>{row.relation.name}</small></span><Icon name="chevron" size={16}/></button>)}</div>}</section>}
        {(error || state.storageError) && <p role="alert" className="error-message">{error || state.storageError}</p>}
        {!state.shortcutAvailable && <p className="subtle-note">{state.desktop ? '全局快捷键未能注册（可能已被其他程序占用），请使用摇卦按钮。' : '浏览器模式仅供界面预览；独立窗口和全局快捷键请使用桌面版。'}</p>}
        <footer className="studio-footer">民俗文化 · 趣味解读<span>本地结果离线可用 · DeepSeek 解读需要联网</span></footer>
      </main>
      <aside className="preview-column"><div className="section-heading"><h2><Icon name="window"/>直播画面</h2><span className={state.overlayOpen ? 'window-status open' : 'window-status'}>{state.overlayOpen ? '窗口已打开' : '窗口未打开'}</span></div>
        <div className="preview-stage"><OracleCard result={state.liveResult} rolling={rolling} settled={state.diceSettled} motion={state.diceMotion}/></div><p className="preview-caption">直播仅显示图案，文字结果仅在控制台可见</p>
        {publicIdea && <div className="live-prompt"><span>意象释义 · 仅控制台</span><strong>{publicIdea.title}</strong><p>{publicIdea.prompt}</p></div>}
        <button className="secondary-button window-button" onClick={() => act(() => state.overlayOpen ? bridge.closeOverlay() : bridge.showOverlay())}><Icon name="window"/>{state.overlayOpen ? '关闭直播窗口' : '打开直播窗口'}</button>
        <section className="window-settings"><h3><Icon name="settings"/>窗口设置</h3><label className="setting-label">组件尺寸 <span>1 : 1</span></label><div className="size-options">{SIZES.map(size => <button key={size} aria-pressed={state.settings.size === size} className={state.settings.size === size ? 'selected' : ''} onClick={() => act(() => bridge.setSettings({ size }))}>{size}</button>)}</div><label className="setting-label" htmlFor="background">窗外背景</label><select id="background" value={state.settings.background} onChange={event => act(() => bridge.setSettings({ background: event.target.value }))}><option value="chroma">纯色抠像 · 推荐</option><option value="transparent">透明背景 · 兼容测试</option></select>
          {state.settings.background === 'chroma' && <div className="color-row"><label htmlFor="key-color">抠除颜色</label><label className="color-input"><input id="key-color" type="color" value={state.settings.chromaColor} onChange={event => act(() => bridge.setSettings({ chromaColor: event.target.value }))}/><span>{state.settings.chromaColor.toUpperCase()}</span></label></div>}
          <label className="switch-row" htmlFor="on-top"><span>直播窗口置顶</span><input id="on-top" type="checkbox" role="switch" checked={state.settings.alwaysOnTop} onChange={event => act(() => bridge.setSettings({ alwaysOnTop: event.target.checked }))}/></label>
          <p className="setting-note">在直播伴侣中添加“窗口捕获”，<br/>选择「灵感骰子 · 直播组件」。</p>
        </section>
        <CatSettings state={state} act={act}/>
      </aside>
    </div>
    {guide && <Guide onClose={() => setGuide(false)}/>}
    {aiSettings && <DeepSeekSettings config={state.aiConfig} onClose={()=>setAiSettings(false)}/>}
  </div>;
}

export default function App() {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const act = useCallback(async action => { try { setError(''); await action(); } catch (err) { setError(err.message || '操作未完成，请重试。'); } }, []);
  useEffect(() => {
    let active = true;
    const accept = next => { if (active) setState(old => !old || next.revision >= old.revision ? next : old); };
    const unsubscribe = bridge.subscribe(accept);
    bridge.getState().then(accept).catch(err => setError(err.message));
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    document.body.classList.toggle('overlay-body', publicMode);
    document.documentElement.classList.toggle('overlay-root', publicMode);
    document.title = catMode ? CAT_TITLE : overlayMode ? LIVE_TITLE : 'MiaoBaGua · 主播控制台';
  }, []);
  if (!state) return <div className="loading-screen" data-status={error?'error':'loading'}>{publicMode ? null : error || '正在打开控制台…'}</div>;
  if (catMode) return <main className="cat-surface" style={{backgroundColor:state.settings.background==='transparent'?'transparent':state.settings.chromaColor}} aria-label="小猫直播组件"><CatCompanion motion={state.diceMotion} rolling={state.phase==='rolling'} idleEnabled={state.settings.idleEnabled}/></main>;
  if (overlayMode) return <main className="overlay-surface" style={{ backgroundColor: state.settings.background === 'transparent' ? 'transparent' : state.settings.chromaColor }} aria-label="灵感骰子直播组件"><OracleCard result={state.liveResult} rolling={state.phase === 'rolling'} settled={state.diceSettled} motion={state.diceMotion}/></main>;
  return <Studio state={state} act={act} error={error}/>;
}

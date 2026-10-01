import { bridge } from '../bridge.js';
import { SIZES } from '../state.js';
import CatCompanion from './CatCompanion.jsx';

export default function CatSettings({ state, act }) {
  const s=state.settings;
  const update=value=>act(()=>bridge.setSettings(value));
  return <section className="cat-settings" aria-label="小猫直播设置">
    <div className="section-heading"><h3>三花守摊猫</h3><span className={`window-status ${state.catOpen?'open':''}`}>{state.catOpen?'独立窗口已打开':'独立窗口已关闭'}</span></div>
    <div className="cat-preview"><CatCompanion motion={state.diceMotion} rolling={state.phase==='rolling'} idleEnabled={s.catIdleEnabled}/></div>
    <p className="preview-caption">陪你一起摇 · 三花守摊猫</p>
    <button className="secondary-button window-button" onClick={()=>act(()=>state.catOpen?bridge.closeCat():bridge.showCat())}>{state.catOpen?'关闭小猫窗口':'打开小猫窗口'}</button>
    <label className="setting-label">小猫尺寸 <span>1 : 1</span></label>
    <div className="size-options">{SIZES.map(size=><button key={size} aria-label={`小猫尺寸 ${size}`} aria-pressed={s.catSize===size} className={s.catSize===size?'selected':''} onClick={()=>update({catSize:size})}>{size}</button>)}</div>
    <label className="setting-label" htmlFor="cat-background">小猫背景</label>
    <select id="cat-background" value={s.catBackground} onChange={event=>update({catBackground:event.target.value})}><option value="transparent">透明背景</option><option value="chroma">纯色抠像</option></select>
    {s.catBackground==='chroma'&&<div className="color-row"><label htmlFor="cat-key-color">小猫抠除颜色</label><label className="color-input"><input id="cat-key-color" type="color" value={s.catChromaColor} onChange={event=>update({catChromaColor:event.target.value})}/><span>{s.catChromaColor.toUpperCase()}</span></label></div>}
    <label className="switch-row" htmlFor="cat-on-top"><span>小猫窗口置顶</span><input id="cat-on-top" type="checkbox" role="switch" checked={s.catAlwaysOnTop} onChange={event=>update({catAlwaysOnTop:event.target.checked})}/></label>
    <label className="switch-row" htmlFor="cat-idle"><span>随机待机动作</span><input id="cat-idle" type="checkbox" role="switch" checked={s.catIdleEnabled} onChange={event=>update({catIdleEnabled:event.target.checked})}/></label>
    <p className="setting-note">歪头、看盅、摆尾等小动作随机轮换。关闭后安静待机，摇卦时仍会跟随。</p>
    <p className="setting-note">{"直播伴侣另外添加\"窗口捕获\"，选择"}<br/>{"「三花守摊猫 · 直播组件」。"}<br/>{"拖动小猫可以移动窗口，开关状态会记住。"}</p>
  </section>;
}

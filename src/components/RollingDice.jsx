import { useEffect, useRef, useState } from 'react';
import { ELEMENTS } from '../broadcast.js';
import { createDiceRenderer } from '../dice-renderer.js';
import { NATURE_PATHS } from '../nature-art.js';

const DOTS={1:[[32,32]],2:[[20,20],[44,44]],3:[[20,20],[32,32],[44,44]],4:[[20,20],[44,20],[20,44],[44,44]],5:[[20,20],[44,20],[32,32],[20,44],[44,44]],6:[[20,18],[44,18],[20,32],[44,32],[20,46],[44,46]]};

function DiceFallback({values}) {
  const faces=values||{first:0,second:1,pips:3};
  return <div className="dice-fallback" role="img" aria-label="骰子静态图案">
    {[faces.first,faces.second,null].map((value,i)=><svg key={i} viewBox="0 0 88 88" aria-hidden="true">
      <rect x="4" y="4" width="80" height="80" rx="16" fill={['#ad482f','#397768','#e5ba66'][i]}/>
      <g transform="translate(12 12)" fill="none" stroke="#ffedc8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {i<2?NATURE_PATHS[ELEMENTS[value].id].map((d,j)=><path key={j} d={d}/>):DOTS[faces.pips].map(([cx,cy],j)=><circle key={j} cx={cx} cy={cy} r="5" fill="#65391f" stroke="none"/>)}
      </g>
    </svg>)}
  </div>;
}

export default function RollingDice({ values, settled, motion, active }) {
  const canvas = useRef(null), scene = useRef(null);
  const renderer = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!canvas.current) return;
    try {
      renderer.current = createDiceRenderer(canvas.current, ({ topFaces, phase, ms }) => {
        if (!scene.current) return;
        scene.current.dataset.motionPhase = phase;
        scene.current.dataset.elapsed = Math.round(ms);
        scene.current.dataset.topFaces = JSON.stringify(topFaces);
      });
      return () => {renderer.current?.dispose(); renderer.current=null;};
    } catch (error) { console.error('Dice renderer:', error); setFailed(true); }
  }, []);
  useEffect(() => {
    if(values && motion && renderer.current) {
      try { renderer.current.play(values,motion); } catch(error) { console.error('Dice playback:',error);setFailed(true); }
    }
  }, [motion?.id]);
  return <div ref={scene} className={'dice-scene dice-3d '+(failed?'has-fallback ':'')+(settled ? 'is-settled ' : '')+(active?'is-active':'')} data-testid={active?"rolling-dice":undefined} data-settled={settled} data-motion-phase="falling" aria-label="三枚自然主题骰子依次掉落、回弹、滚动、停稳">
    <canvas ref={canvas} className="dice-canvas" aria-hidden="true"/>
    {failed && <DiceFallback values={values}/>}
  </div>;
}

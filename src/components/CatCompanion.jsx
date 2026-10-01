import { useEffect, useRef } from 'react';
import { createCatRenderer } from '../cat-renderer.js';

export default function CatCompanion({ motion, rolling = false, idleEnabled = true }) {
  const root=useRef(null),canvas=useRef(null),playback=useRef({motion,rolling,idleEnabled});
  playback.current={motion,rolling,idleEnabled};
  useEffect(()=>{
    let renderer;
    try { renderer=createCatRenderer(canvas.current,root.current,()=>playback.current); }
    catch(error){ root.current.dataset.ready='error'; console.error(error); }
    return ()=>renderer?.dispose();
  },[]);
  return <div ref={root} className={`cat-companion ${rolling?'is-performing':'is-resting'}`} data-testid="cat-companion" data-art="calico-handpainted">
    <canvas ref={canvas} className="cat-art" width="512" height="512" role="img" aria-label="手绘三花猫先看盅蓄力，再抱盅摇动、竖耳倾听，最后抬眼看向观众"/>
  </div>;
}

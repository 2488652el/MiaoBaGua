import * as THREE from 'three';
import atlas from './cat-atlas.json';
import { CAT_CHANNELS, ease, sampleCatPlayback } from './cat-motion.js';
import { createCatRig, deformCatRig } from './cat-rig.js';

let artwork;
function loadArtwork(){
  if(!artwork)artwork=new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>{
      const {rect,anchor}=atlas.frames[0],canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
      const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';
      ctx.drawImage(image,...rect,282-anchor[0]*1.27,446-anchor[1]*1.27,rect[2]*1.27,rect[3]*1.27);
      resolve(canvas);
    };
    image.onerror=()=>{artwork=null;reject(new Error('小猫手绘素材未能加载'));};
    image.src='./assets/cat/ink-cat-poses.png';
  });
  return artwork;
}
export function createCatRenderer(canvas,root,getPlayback){
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(0,512,512,0,.1,20);camera.position.z=10;
  const rig=createCatRig(),geometry=new THREE.BufferGeometry();
  const positions=new THREE.BufferAttribute(rig.positions,3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',positions);geometry.setAttribute('uv',new THREE.BufferAttribute(rig.uv,2));geometry.setIndex(new THREE.BufferAttribute(rig.indices,1));
  const material=new THREE.MeshBasicMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=32;
  const shadowCtx=shadowCanvas.getContext('2d');shadowCtx.scale(1,.25);
  const shade=shadowCtx.createRadialGradient(64,64,0,64,64,63);shade.addColorStop(0,'#30291c2e');shade.addColorStop(1,'#30291c00');
  shadowCtx.fillStyle=shade;shadowCtx.fillRect(0,0,128,128);
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas);shadowTexture.colorSpace=THREE.SRGBColorSpace;
  const shadowMaterial=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,depthTest:false});
  const shadowGeometry=new THREE.PlaneGeometry(218,23),shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.position.set(272,60,-1);shadow.renderOrder=-1;scene.add(shadow);
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,loaded=false,raf=0,lastKey='',lastStage='',texture,lastReport=0,renderTotal=0,renderCount=0,renderPeak=0;
  // Map the monotonic rAF timestamp onto the shared epoch once. IPC draft
  // updates do not reset this clock; reopening still joins motion.startedAt.
  const epoch=Date.now()-performance.now();
  let idleTarget=getPlayback().idleEnabled===false?0:1,idleFrom=idleTarget,idleChangedAt=-Infinity;
  const resize=new ResizeObserver(()=>{
    const size=Math.max(240,Math.min(1440,Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,2))));
    if(canvas.width!==size){renderer.setSize(size,size,false);lastKey='';}
  });resize.observe(canvas);
  function paint(timestamp){
    if(disposed)return;
    const {motion,rolling,idleEnabled=true}=getPlayback();
    let idleGain=idleFrom+(idleTarget-idleFrom)*ease((timestamp-idleChangedAt)/350);
    if(Number(idleEnabled)!==idleTarget){idleFrom=idleGain;idleTarget=Number(idleEnabled);idleChangedAt=timestamp;}
    const pose=sampleCatPlayback(epoch+timestamp,motion,rolling,media.matches,idleGain);
    const key=canvas.width+'|'+CAT_CHANNELS.map(k=>pose[k].toFixed(4)).join('|');
    if(loaded&&key!==lastKey){
      const begin=performance.now();deformCatRig(rig,pose);positions.needsUpdate=true;
      shadow.scale.setScalar(1+pose.rootY*.005);shadowMaterial.opacity=1+pose.rootY*.018;
      renderer.render(scene,camera);lastKey=key;
      const cost=performance.now()-begin;renderTotal+=cost;renderPeak=Math.max(renderPeak,cost);renderCount++;
    }
    if(lastStage!==pose.stage){root.dataset.stage=pose.stage;lastStage=pose.stage;}
    if(root.dataset.idleAction!==pose.idleAction)root.dataset.idleAction=pose.idleAction;
    // UI/debug attributes never drive playback and update at only 10 Hz.
    if(timestamp-lastReport>=100){
      root.dataset.elapsed=String(Math.round(pose.elapsed));root.dataset.reduced=String(media.matches);
      root.dataset.idleProgress=pose.idleProgress.toFixed(3);
      root.dataset.renderMs=(renderTotal/Math.max(1,renderCount)).toFixed(3);root.dataset.peakRenderMs=renderPeak.toFixed(3);
      lastReport=timestamp;
    }
    raf=requestAnimationFrame(paint);
  }
  loadArtwork().then(image=>{
    if(disposed)return;
    texture=new THREE.CanvasTexture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    material.map=texture;material.needsUpdate=true;loaded=true;
    root.dataset.ready='true';root.dataset.animation='continuous-rig';root.dataset.frame='0';paint(performance.now());
  }).catch(error=>{if(!disposed){root.dataset.ready='error';console.error(error);}});
  return {dispose(){disposed=true;cancelAnimationFrame(raf);resize.disconnect();texture?.dispose();geometry.dispose();material.dispose();shadowTexture.dispose();shadowGeometry.dispose();shadowMaterial.dispose();renderer.dispose();}};
}

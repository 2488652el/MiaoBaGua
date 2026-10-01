import * as THREE from 'three';
import { CAT_CHANNELS, ease, sampleCatPlayback } from './cat-motion.js';
import { solveCatPose, CAT_SKELETON, IDENTITY } from './cat-rig.js';
import { loadCatArtwork, CAT_PARTS, createPartCanvas } from './cat-artwork.js';
import { animateHeadVertices, animateTailVertices } from './cat-features.js';

// Body, cup and arms stay rigid; small ear, eye, cloth and tail motions overlap.
export function createCatPainter(canvas,image){
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(0,512,0,512,.1,20);camera.position.z=10;
  const resources=[],parts={};
  const textures=Object.fromEntries(Object.keys(CAT_PARTS).map(name=>[name,createPartCanvas(image,name)]));
  // Overlapping fur at the hip hides the join; neither layer is stretched.
  const hips=document.createElement('canvas');hips.width=textures.body.width;hips.height=textures.body.height;
  const hctx=hips.getContext('2d');hctx.drawImage(textures.body,0,0);
  const line=y=>(y-CAT_PARTS.body.rect[1])/CAT_PARTS.body.rect[3]*hips.height;
  hctx.globalCompositeOperation='destination-in';
  const mask=hctx.createLinearGradient(0,line(379),0,line(389));mask.addColorStop(0,'#0000');mask.addColorStop(1,'#000');
  hctx.fillStyle=mask;hctx.fillRect(0,0,hips.width,hips.height);
  const bctx=textures.body.getContext('2d');bctx.clearRect(0,line(397),hips.width,hips.height);
  function layer(name,source,rect,order,grid=1){
    const texture=new THREE.CanvasTexture(source);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    const [x,y,w,h]=rect,geometry=new THREE.BufferGeometry(),positions=[],uv=[],indices=[];
    for(let r=0;r<=grid;r++)for(let c=0;c<=grid;c++){positions.push(x+w*c/grid,y+h*r/grid,0);uv.push(c/grid,1-r/grid);if(r<grid&&c<grid){const i=r*(grid+1)+c,n=i+grid+1;indices.push(i,i+1,n,i+1,n+1,n);}}
    const position=new THREE.Float32BufferAttribute(positions,3);if(grid>1)position.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position',position);geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:name==='shadow'?0:.12,alphaToCoverage:true,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false});
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;mesh.renderOrder=order;scene.add(mesh);
    resources.push(texture,geometry,material);return parts[name]={mesh,rect,position,rest:position.array.slice()};
  }
  const sc=document.createElement('canvas');sc.width=256;sc.height=48;const sx=sc.getContext('2d');sx.scale(1,48/256);
  const shade=sx.createRadialGradient(128,128,0,128,128,126);shade.addColorStop(0,'#30291c24');shade.addColorStop(1,'#30291c00');sx.fillStyle=shade;sx.fillRect(0,0,256,256);
  layer('shadow',sc,[190,433,222,23],-2);
  layer('tail',textures.tail,CAT_PARTS.tail.rect,0,20);
  layer('body',textures.body,CAT_PARTS.body.rect,2);
  layer('hips',hips,CAT_PARTS.body.rect,3);
  layer('head',textures.head,CAT_PARTS.head.rect,9,64);
  layer('grip',textures.grip,CAT_PARTS.grip.rect,10);
  for(const side of ['near','far']){
    const lengths=CAT_SKELETON.arms[side].lengths;
    layer(side+'Upper',textures[side+'Upper'],[-19,-13,38,lengths[0]+26],side==='near'?8:1);
    layer(side+'Fore',textures[side+'Fore'],[-17,-12,34,lengths[1]+24],side==='near'?7:4);
  }
  function matrix(part,m){part.mesh.matrix.set(m[0],m[2],0,m[4],m[1],m[3],0,m[5],0,0,1,0,0,0,0,1);part.mesh.matrixWorldNeedsUpdate=true;}
  function limb(part,origin,angle){const r=angle-Math.PI/2,c=Math.cos(r),s=Math.sin(r);matrix(part,[c,s,-s,c,...origin]);}
  let lastFace='',lastCurl;
  return {
    parts,
    render(pose={},options={}){
      const rig=solveCatPose(pose);if(!rig.reachable)throw new Error('Hand target outside arm reach');
      for(const name of ['body','head','tail','grip'])matrix(parts[name],rig[name]);
      matrix(parts.hips,IDENTITY);matrix(parts.shadow,IDENTITY);
      for(const side of ['near','far']){const a=rig.arms[side];limb(parts[side+'Upper'],a.shoulder,a.upperAngle);limb(parts[side+'Fore'],a.elbow,a.foreAngle);}
      const faceKey=['blink','pupilX','pupilY','earL','earR','scarf'].map(k=>pose[k]??0).join('|');
      if(faceKey!==lastFace){const {rest,position}=parts.head;animateHeadVertices(rest,position.array,pose);position.needsUpdate=true;lastFace=faceKey;}
      if(pose.tailCurl!==lastCurl){const {rest,position}=parts.tail;animateTailVertices(rest,position.array,pose);position.needsUpdate=true;lastCurl=pose.tailCurl;}
      for(const [name,part] of Object.entries(parts))part.mesh.visible=!options.only||options.only.includes(name);
      renderer.render(scene,camera);return rig;
    },
    resize(size){renderer.setSize(size,size,false);},
    dispose(){resources.forEach(r=>r.dispose());renderer.dispose();}
  };
}
export function createCatRenderer(canvas,root,getPlayback){
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,painter,raf=0,lastKey='',lastStage='',lastReport=0,renderTotal=0,renderCount=0,renderPeak=0;
  const epoch=Date.now()-performance.now();
  let idleTarget=getPlayback().idleEnabled===false?0:1,idleFrom=idleTarget,idleChangedAt=-Infinity;
  const size=()=>Math.max(240,Math.min(1440,Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,2))));
  const resize=new ResizeObserver(()=>{if(painter&&canvas.width!==size()){painter.resize(size());lastKey='';}});resize.observe(canvas);
  const onRestore=()=>{lastKey='';};canvas.addEventListener('webglcontextrestored',onRestore);
  function paint(timestamp){
    if(disposed)return;
    const {motion,rolling,idleEnabled=true}=getPlayback(),idleGain=idleFrom+(idleTarget-idleFrom)*ease((timestamp-idleChangedAt)/350);
    if(Number(idleEnabled)!==idleTarget){idleFrom=idleGain;idleTarget=Number(idleEnabled);idleChangedAt=timestamp;}
    const pose=sampleCatPlayback(epoch+timestamp,motion,rolling,media.matches,idleGain),key=canvas.width+'|'+CAT_CHANNELS.map(k=>pose[k].toFixed(4)).join('|');
    if(painter&&key!==lastKey){const begin=performance.now();painter.render(pose);lastKey=key;const cost=performance.now()-begin;renderTotal+=cost;renderPeak=Math.max(renderPeak,cost);renderCount++;}
    if(lastStage!==pose.stage){root.dataset.stage=pose.stage;lastStage=pose.stage;}
    root.dataset.idleAction=pose.idleAction;
    if(timestamp-lastReport>=100){root.dataset.elapsed=String(Math.round(pose.elapsed));root.dataset.reduced=String(media.matches);root.dataset.idleProgress=pose.idleProgress.toFixed(3);root.dataset.renderMs=(renderTotal/Math.max(1,renderCount)).toFixed(3);root.dataset.peakRenderMs=renderPeak.toFixed(3);lastReport=timestamp;}
    raf=requestAnimationFrame(paint);
  }
  loadCatArtwork().then(image=>{if(disposed)return;painter=createCatPainter(canvas,image);painter.resize(size());root.dataset.ready='true';root.dataset.animation='articulated-arms';root.dataset.frame='0';root.dataset.art='calico-handpainted';paint(performance.now());}).catch(error=>{if(!disposed){root.dataset.ready='error';console.error(error);}});
  return {dispose(){disposed=true;cancelAnimationFrame(raf);resize.disconnect();canvas.removeEventListener('webglcontextrestored',onRestore);painter?.dispose();}};
}

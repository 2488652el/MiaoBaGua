import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createDiceTake, warmDiceTakes, STEP, SIMULATION_SECONDS, D8_RADIUS, D6_HALF, D8_VERTICES, D8_FACES } from './dice-motion.js';
import { PHYSICS_SECOND_MS, RESULT_REVEAL_START_MS } from './motion-timing.js';
import { ELEMENTS } from './broadcast.js';
import { paintNature } from './nature-art.js';

const V = (a) => new THREE.Vector3(...a);
const PIPS = { 1:[[0,0]], 2:[[-1,-1],[1,1]], 3:[[-1,-1],[0,0],[1,1]], 4:[[-1,-1],[1,-1],[-1,1],[1,1]], 5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]], 6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]] };
const PALETTE = [ {base:'#ad482f',ink:'#ffedc8',edge:'#d17a51'}, {base:'#397768',ink:'#fff0c9',edge:'#70a08c'}, {base:'#e5ba66',ink:'#65391f',edge:'#f4d99a'} ];

function faceTexture(index, value) {
  const canvas = document.createElement('canvas'); canvas.width=256; canvas.height=256;
  const ctx=canvas.getContext('2d'); const colors=PALETTE[index];
  ctx.fillStyle=colors.base; ctx.fillRect(0,0,256,256);
  // Fine paint grain stays fixed to the object as it turns.
  for(let i=0;i<450;i++) { ctx.fillStyle=i%2?'#fff3d508':'#41261e09'; ctx.fillRect((i*79)%256,(i*137)%256,1+(i%3),1); }
  ctx.fillStyle=colors.ink;
  if(index<2) {
    paintNature(ctx,value.id,128,128,66,colors.ink);
  } else {
    for(const [x,y] of PIPS[value]) {
      ctx.beginPath(); ctx.arc(128+x*57,128+y*57+2,12,0,Math.PI*2); ctx.fillStyle='#fff0b5'; ctx.fill();
      ctx.beginPath(); ctx.arc(128+x*57,128+y*57,11,0,Math.PI*2); ctx.fillStyle=colors.ink; ctx.fill();
    }
    ctx.strokeStyle='#94602d55'; ctx.lineWidth=2; ctx.beginPath(); ctx.roundRect(13,13,230,230,18); ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; texture.anisotropy=4;
  return texture;
}

export function upwardFace(normals, q) {
  let selected=0, max=-Infinity;
  normals.forEach((n,i)=>{ const y=n.clone().applyQuaternion(q).y; if(y>max) {max=y;selected=i;} });
  return selected;
}

function addFace(group, points, normal, restQ, material, cameraUp, uvScale) {
  const center=points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/points.length);
  const up=points.length===4 ? points[3].clone().sub(points[0]).normalize() : cameraUp.clone().applyQuaternion(restQ.clone().invert());
  up.addScaledVector(normal,-up.dot(normal)).normalize();
  if(up.lengthSq()<.01) up.set(0,0,1).addScaledVector(normal,-normal.z).normalize();
  const right=up.clone().cross(normal).normalize();
  const positions=[],uv=[];
  for(const p of points) {
    positions.push(...p.clone().addScaledVector(normal,.002).toArray());
    const d=p.clone().sub(center); uv.push(.5+d.dot(right)/uvScale,.5+d.dot(up)/uvScale);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(points.length===3?[0,1,2]:[0,1,2,0,2,3]); geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material); mesh.receiveShadow=true; group.add(mesh);
}

function makeDie(index, value, rest, cameraUp, textureForFace) {
  const group=new THREE.Group(); const restQ=new THREE.Quaternion(...rest.q);
  const mat=new THREE.MeshStandardMaterial({color:PALETTE[index].edge,roughness:.55,metalness:0});
  let normals, faceValues;
  if(index<2) {
    const vertices=D8_VERTICES.map(p=>V(p).multiplyScalar(D8_RADIUS));
    const faces=D8_FACES.map(face=>{
      const p=face.map(i=>vertices[i].clone());
      const center=p.reduce((s,v)=>s.add(v),new THREE.Vector3()).multiplyScalar(1/3);
      return p.map(v=>v.lerp(center,.055));
    });
    normals=faces.map(p=>p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize());
    const top=upwardFace(normals,restQ); const desired=ELEMENTS.findIndex(t=>t.id===value.id);
    faceValues=faces.map((_,i)=>ELEMENTS[(i-top+desired+8)%8]);
    const hull=new ConvexGeometry(faces.flat()); const body=new THREE.Mesh(hull,mat); body.castShadow=true; body.receiveShadow=true; group.add(body);
    faces.forEach((points,i)=>addFace(group,points,normals[i],restQ,new THREE.MeshStandardMaterial({map:textureForFace(index,faceValues[i]),roughness:.76}),cameraUp,1.05));
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(hull,20),new THREE.LineBasicMaterial({color:'#502e24',transparent:true,opacity:.18})); group.add(edges);
  } else {
    const h=D6_HALF; const s=h-.047;
    const body=new THREE.Mesh(new RoundedBoxGeometry(h*2,h*2,h*2,3,.055),mat); body.castShadow=true; body.receiveShadow=true; group.add(body);
    const faces=[[[s,h,s],[s,h,-s],[-s,h,-s],[-s,h,s]], [[-s,-h,s],[-s,-h,-s],[s,-h,-s],[s,-h,s]], [[h,-s,s],[h,-s,-s],[h,s,-s],[h,s,s]], [[-h,s,s],[-h,s,-s],[-h,-s,-s],[-h,-s,s]], [[-s,-s,h],[s,-s,h],[s,s,h],[-s,s,h]], [[-s,s,-h],[s,s,-h],[s,-s,-h],[-s,-s,-h]]].map(f=>f.map(V));
    normals=[V([0,1,0]),V([0,-1,0]),V([1,0,0]),V([-1,0,0]),V([0,0,1]),V([0,0,-1])];
    const top=upwardFace(normals,restQ); faceValues=Array(6); faceValues[top]=value; faceValues[top^1]=7-value;
    const unused=[1,2,3].filter(n=>n!==Math.min(value,7-value));
    for(let i=0;i<6;i+=2) if(faceValues[i]===undefined) {const n=unused.shift();faceValues[i]=n;faceValues[i+1]=7-n;}
    faces.forEach((p,i)=>addFace(group,p,normals[i],restQ,new THREE.MeshStandardMaterial({map:textureForFace(index,faceValues[i]),roughness:.7}),cameraUp,s*2));
  }
  group.userData={normals,faceValues}; return group;
}

export function createDiceRenderer(canvas, onFrame) {
  let motion, take, dice=[], rings=[];
  const faceTextures = new Map();
  function textureForFace(index, value) {
    const key = `${index}:${value.id ?? value}`;
    if (!faceTextures.has(key)) faceTextures.set(key, faceTexture(index, value));
    return faceTextures.get(key);
  }
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setClearColor(0,0);
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.VSMShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12;
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-2.48,2.48,2.1,-2.1,.1,40);
  camera.position.set(0,7.8,7); camera.lookAt(0,.7,0); camera.updateMatrixWorld();
  const cameraUp=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  scene.add(new THREE.HemisphereLight('#fff2d4','#8f6b4e',2.1));
  const sun=new THREE.DirectionalLight('#fff7e2',3.3); sun.position.set(-3,7,4); sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-3;sun.shadow.camera.right=3;sun.shadow.camera.top=3;sun.shadow.camera.bottom=-3;
  sun.shadow.radius=3; sun.shadow.blurSamples=8; sun.shadow.bias=-.0002; sun.shadow.normalBias=.012; scene.add(sun);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({color:'#513a29',opacity:.25})); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true;scene.add(floor);
  function load(values, nextMotion) {
    dice.concat(rings).forEach(object=>{scene.remove(object);disposeObject(object);});
    motion=nextMotion; take=createDiceTake(motion.id);
    dice=[ELEMENTS[values.first],ELEMENTS[values.second],values.pips].map((v,i)=>makeDie(i,v,take.rest[i],cameraUp,textureForFace)); dice.forEach(d=>scene.add(d));
    rings=dice.map(()=>{
    const ring=new THREE.Mesh(new THREE.RingGeometry(.28,.291,48),new THREE.MeshBasicMaterial({color:'#9c6741',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2; scene.add(ring); return ring;
    });
  }
  const resize=()=>{const {width,height}=canvas.getBoundingClientRect(); if(!width||!height)return; renderer.setSize(width,height,false);camera.top=2.48*height/width;camera.bottom=-camera.top;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize); observer.observe(canvas); resize();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0, disposed=false, playing=false; const qa=new THREE.Quaternion(), qb=new THREE.Quaternion();
  function draw() {
    if(disposed)return;
    // This user-triggered throw is the content itself. Reduced motion suppresses
    // decorative impact rings, but must not turn the requested dice throw static.
    const ms=Math.max(0,Date.now()-motion.startedAt); const t=Math.min(ms/PHYSICS_SECOND_MS,SIMULATION_SECONDS);
    const sample=Math.min(Math.floor(t/STEP),take.frames.length-1), next=Math.min(sample+1,take.frames.length-1), mix=(t/STEP)-sample;
    const positions=[], topFaces=[];
    dice.forEach((die,i)=>{
      const a=take.frames[sample][i], b=take.frames[next][i]; die.position.fromArray(a.p).lerp(V(b.p),mix);
      qa.fromArray(a.q); qb.fromArray(b.q); die.quaternion.copy(qa.slerp(qb,mix));
      const anchor=die.position.clone(); anchor.y=0;anchor.z+=.62; anchor.project(camera);
      positions.push({x:(anchor.x+1)*50,y:(1-anchor.y)*50});
      const top=upwardFace(die.userData.normals,die.quaternion); const v=die.userData.faceValues[top]; topFaces.push(v.name||v);
      const hit=take.impacts[i].filter(h=>h<=t).at(-1); const age=hit===undefined?1:t-hit;
      rings[i].position.set(die.position.x,.008,die.position.z);rings[i].scale.setScalar(1+Math.min(age,1)*4);rings[i].material.opacity=!reduced.matches && age<.18?.16*(1-age/.18):0;
    });
    const phase=take.frames[sample].every(d=>d.sleep)?'stopped':t<.3?'falling':t<1.3?'bouncing':'rolling';
    renderer.render(scene,camera); if(playing) onFrame({positions,topFaces,phase,ms});
    if(playing && ms<RESULT_REVEAL_START_MS+600) frame=requestAnimationFrame(draw);
  }
  function disposeObject(object) { object.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}}); }
  // Warm the real shader, shadow and texture path while the card is idle.
  warmDiceTakes();
  load({first:0,second:1,pips:3},{id:'warmup',startedAt:Date.now()-SIMULATION_SECONDS*PHYSICS_SECOND_MS});
  draw();
  return {
    play(values, nextMotion) { playing=true; cancelAnimationFrame(frame); load(values,nextMotion); draw(); },
    dispose() { disposed=true;cancelAnimationFrame(frame);observer.disconnect();disposeObject(scene);faceTextures.forEach(texture=>texture.dispose());faceTextures.clear();renderer.dispose();renderer.forceContextLoss(); }
  };
}

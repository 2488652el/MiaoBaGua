import { loadCatArtwork } from '../../src/cat-artwork.js';
import { createCatPainter } from '../../src/cat-renderer.js';
import { sampleCatMotion, CAT_MOTION_DURATION } from '../../src/cat-motion.js';
import { CAT_SKELETON, transformPoint } from '../../src/cat-rig.js';
const SIZE=512;
function snapshot(c){const out=document.createElement('canvas');out.width=out.height=SIZE;out.getContext('2d').drawImage(c,0,0);return out;}
const read=c=>c.getContext('2d').getImageData(0,0,SIZE,SIZE);
function diff(a,b,rect=[0,0,SIZE,SIZE]){
  let sum=0,large=0,count=0;const[x,y,w,h]=rect;
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const i=(yy*SIZE+xx)*4;let max=0;for(let k=0;k<4;k++){const v=k===3?Math.abs(a.data[i+3]-b.data[i+3]):Math.abs(a.data[i+k]*a.data[i+3]/255-b.data[i+k]*b.data[i+3]/255);sum+=v;max=Math.max(max,v);}if(max>24)large++;count++;}
  return {mean:sum/(count*4),largeRatio:large/count};
}
function extent(im){
  let left=SIZE,top=SIZE,right=0,bottom=0,count=0;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(im.data[(y*SIZE+x)*4+3]>60){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
  return {left,top,right,bottom,count,margin:Math.min(left,top,SIZE-1-right,SIZE-1-bottom)};
}
function components(im){
  const seen=new Uint8Array(SIZE*SIZE),sizes=[];
  for(let i=0;i<seen.length;i++){
    if(seen[i]||im.data[i*4+3]<80)continue;
    const stack=[i];seen[i]=1;let size=0;
    while(stack.length){const p=stack.pop();size++;const x=p%SIZE,y=Math.floor(p/SIZE);
      for(const n of [x? p-1:-1,x<SIZE-1?p+1:-1,y?p-SIZE:-1,y<SIZE-1?p+SIZE:-1])if(n>=0&&!seen[n]&&im.data[n*4+3]>=80){seen[n]=1;stack.push(n);}
    }if(size>180)sizes.push(size);
  }return sizes.sort((a,b)=>b-a);
}
export async function runCatRenderingChecks(){
  const checks=[],failures=[],images={},frames=[],check=(ok,name,details)=>{const v={name,passed:!!ok,details};checks.push(v);if(!ok)failures.push(v);};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;
  const painter=createCatPainter(canvas,await loadCatArtwork());painter.resize(SIZE);
  try{
    painter.render({});const neutral=read(snapshot(canvas));images['neutral-actual']=snapshot(canvas).toDataURL();
    const rigid=['body','hips','grip','nearUpper','nearFore','farUpper','farFore'];
    check(rigid.every(n=>painter.parts[n].position.count===4),'body and arm segments use rigid quads, no whole-body deformation',rigid);
    const fixed=['body','hips','head','tail','shadow'];
    painter.render({}, {only:fixed});const a=read(snapshot(canvas));
    const handPose={cupX:20,cupY:-20,cupAngle:9};
    painter.render(handPose,{only:fixed});const bodyDifference=diff(a,read(snapshot(canvas)));
    check(bodyDifference.mean===0,'hand input leaves the actually rendered chest, belly, head and legs unchanged',bodyDifference);
    painter.render({});const baseline=read(snapshot(canvas));
    painter.render(handPose);const hand=read(snapshot(canvas)),handDifference=diff(baseline,hand);
    images['hand-only-actual']=snapshot(canvas).toDataURL();
    check(handDifference.mean>1&&handDifference.largeRatio>.01,'independent hands visibly move while body remains fixed',handDifference);
    check(diff(baseline,hand,[150,60,260,190]).mean===0,'independent hand motion cannot drag the face');
    check(diff(baseline,hand,[225,412,181,35]).mean===0,'independent hand motion cannot drag the seated legs');
    const times=new Map([[0,'neutral'],[320,'prepare'],[1060,'shake-left'],[1360,'shake-right'],[2250,'listen'],[3150,'fast'],[4230,'place'],[4900,'blink'],[CAT_MOTION_DURATION,'finished']]);
    let disconnected=[],clipped=[],maxFeet=0;
    for(let t=0;t<=CAT_MOTION_DURATION;t+=80){
      const rig=painter.render(sampleCatMotion(t)),im=read(snapshot(canvas)),e=extent(im),c=components(im);
      if(c.length!==1)disconnected.push({t,sizes:c});if(e.margin<24)clipped.push({t,bounds:e});
      maxFeet=Math.max(maxFeet,diff(neutral,im,[232,425,156,18]).mean);
      for(const side of ['near','far']){const [x,y]=transformPoint(rig.grip,CAT_SKELETON.grip.wrists[side]);if(im.data[(Math.round(y)*SIZE+Math.round(x))*4+3]<80)disconnected.push({t,side,joint:'wrist'});}
    }
    check(disconnected.length===0,'complete cast keeps both arms, paws, cup and body visibly connected',disconnected);
    check(clipped.length===0,'complete cast remains within the transparent frame',clipped);
    check(maxFeet<.5,'actual feet stay planted throughout the cast',{maximumMeanPixelDifference:maxFeet});
    for(const [elapsed,name]of times){
      painter.render(sampleCatMotion(elapsed));const shot=snapshot(canvas),im=read(shot),bounds=extent(im);
      images[name+'-actual']=shot.toDataURL();frames.push({name,elapsed,bounds});
    }
    // Independent head blink must not move the torso's four immutable vertices.
    painter.render({blink:1});check(rigid.every(n=>painter.parts[n].position.array.every((v,i)=>v===painter.parts[n].rest[i])),'all non-eye geometry remains immutable even during blinking');
    const blink=read(snapshot(canvas));check(diff(baseline,blink,[220,178,130,53]).mean>1,'the eye interiors visibly close');
    check(diff(baseline,blink,[150,60,260,100]).mean===0,'blinking does not squash the ears or forehead');
    for(const [name,pose,rect]of [['gaze',{pupilX:2.5,pupilY:1.5},[212,176,135,55]],['ears',{earL:6,earR:-5},[155,55,205,106]],['scarf',{scarf:6},[162,257,95,56]]]){
      painter.render(pose);const im=read(snapshot(canvas)),change=diff(baseline,im,rect);
      check(change.mean>.2,name+' is visible in the actual artwork',change);
      check(diff(baseline,im,[220,325,185,120]).mean===0,name+' cannot move the torso or feet');
    }
  }finally{painter.dispose();}
  return {passed:failures.length===0,checks,failures,frames,images};
}

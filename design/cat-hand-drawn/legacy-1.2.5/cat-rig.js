// Coordinates refer to the normalized 512px neutral artwork. Weights are built
// once; all frames deform this SAME drawing. No pose texture swaps or dissolves.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export const CAT_RIG_GRID=96;
export function rigWeights(x,y){
  // The entire head, including both ears and the chin, follows ONE rigid
  // transform. Blend only below the jaw, through the scarf/upper chest.
  const head=1-smooth(278,342,y),belowHead=1-head;
  const cup=smooth(216,270,x)*smooth(272,313,y)*(1-smooth(390,444,y))*belowHead;
  // A horizontal torso mask on the head used to stretch the left ear/cheek
  // whenever bodyAngle increased. The head inherits the full torso transform.
  const body=head+belowHead*smooth(157,195,x)*(1-smooth(407,446,y));
  const tail=(1-smooth(160,190,x))*smooth(263,290,y)*(1-smooth(391,431,y))*belowHead;
  const scarf=(1-smooth(218,252,x))*smooth(258,274,y)*(1-smooth(305,328,y))*belowHead;
  // Compact support preserves cheek/eyebrow shape while eyelids close.
  const eyes=[[224,218,24,27],[303,205,23,27]];
  let eye=0,eyeY=0;
  for(const [ex,ey,rx,ry] of eyes){
    const d=Math.hypot((x-ex)/rx,(y-ey)/ry),w=1-smooth(.65,1.45,d);
    if(w>eye){eye=w;eyeY=ey;}
  }
  return {head,cup,body,tail,scarf,eye,eyeY};
}
export function createCatRig(grid=CAT_RIG_GRID){
  const count=(grid+1)**2,rest=new Float32Array(count*2),weights=new Float32Array(count*7),positions=new Float32Array(count*3),uv=new Float32Array(count*2),indices=[];
  for(let row=0;row<=grid;row++)for(let col=0;col<=grid;col++){
    const i=row*(grid+1)+col,x=col/grid*512,y=row/grid*512,w=rigWeights(x,y);
    rest[i*2]=x;rest[i*2+1]=y;weights.set([w.head,w.cup,w.body,w.tail,w.scarf,w.eye,w.eyeY],i*7);
    uv[i*2]=x/512;uv[i*2+1]=1-y/512;
    if(row<grid&&col<grid){const n=i+grid+1;indices.push(i,n,i+1,i+1,n,n+1);}
  }
  return {rest,weights,positions,uv,indices:new Uint16Array(indices)};
}
export function deformCatRig(rig,pose){
  const {rest,weights:w,positions:p}=rig;
  const hr=pose.headAngle*Math.PI/180,hc=Math.cos(hr),hs=Math.sin(hr);
  const cr=pose.cupAngle*Math.PI/180,cc=Math.cos(cr),cs=Math.sin(cr);
  const br=pose.bodyAngle*Math.PI/180,bc=Math.cos(br),bs=Math.sin(br);
  for(let i=0,j=0,k=0;i<rest.length;i+=2,j+=7,k+=3){
    const rx=rest[i],ry=rest[i+1];let x=rx,y=ry;
    y-=(y-w[j+6])*w[j+5]*pose.blink*.9;
    const dx=x-257,dy=y-268,ex=rx-302,ey=ry-349;
    x+=(dx*hc-dy*hs-dx+pose.headX)*w[j];
    y+=(dx*hs+dy*hc-dy+pose.headY)*w[j];
    x+=(ex*cc-ey*cs-ex+pose.cupX)*w[j+1];
    y+=(ex*cs+ey*cc-ey+pose.cupY)*w[j+1];
    x+=pose.tail*w[j+3];y+=pose.tail*w[j+3]*.25;
    x-=pose.scarf*w[j+4]*.3;y+=pose.scarf*w[j+4];
    const bx=x-270,by=y-420;
    x+=(bx*bc-by*bs-bx)*w[j+2];y+=(bx*bs+by*bc-by+pose.bodyY)*w[j+2];
    p[k]=x;p[k+1]=512-y-pose.rootY;p[k+2]=0;
  }
  return p;
}

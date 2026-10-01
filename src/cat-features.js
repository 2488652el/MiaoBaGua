// Cached local masks keep secondary motion inexpensive at high refresh rates.
import {CAT_SKELETON} from './cat-rig.js';
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const clamp=v=>Math.max(0,Math.min(1,v));
const headCache=new WeakMap(),tailCache=new WeakMap();
function headFeatures(rest){
  let table=headCache.get(rest);if(table)return table;
  table=new Float32Array(rest.length/3*8);
  for(let i=0,k=0;i<rest.length;i+=3,k+=8){
    const x=rest[i],y=rest[i+1];let lid=0,pupil=0;
    for(const[ex,ey]of CAT_SKELETON.eyes){lid+=(y-ey)*(1-smooth(.78,1.48,Math.hypot((x-ex)/17,(y-ey)/20)));pupil+=1-smooth(.55,1.15,Math.hypot((x-ex)/10.8,(y-ey)/14.5));}
    const l=(1-smooth(119,163,y))*(1-smooth(224,250,x)),r=(1-smooth(107,154,y))*smooth(247,270,x),c=smooth(253,266,y)*(1-smooth(221,248,x));
    table[k]=lid;table[k+1]=pupil;table[k+2]=(x-205)*l;table[k+3]=(y-164)*l;table[k+4]=(x-294)*r;table[k+5]=(y-153)*r;table[k+6]=(x-230)*c;table[k+7]=(y-266)*c;
  }headCache.set(rest,table);return table;
}
export function animateHeadVertices(rest,positions,p={}){
  const table=headFeatures(rest),blink=clamp(p.blink??0),gx=(p.pupilX??0)*(1-blink),gy=(p.pupilY??0)*(1-blink);
  const l=(p.earL??0)*Math.PI/180,r=(p.earR??0)*Math.PI/180,c=(p.scarf??0)*Math.PI/180;
  const lc=Math.cos(l)-1,ls=Math.sin(l),rc=Math.cos(r)-1,rs=Math.sin(r),cc=Math.cos(c)-1,cs=Math.sin(c);
  for(let i=0,k=0;i<rest.length;i+=3,k+=8){
    positions[i]=rest[i]+gx*table[k+1]+table[k+2]*lc-table[k+3]*ls+table[k+4]*rc-table[k+5]*rs+table[k+6]*cc-table[k+7]*cs;
    positions[i+1]=rest[i+1]+gy*table[k+1]-table[k]*blink*.91+table[k+2]*ls+table[k+3]*lc+table[k+4]*rs+table[k+5]*rc+table[k+6]*cs+table[k+7]*cc;
  }
}
export function animateTailVertices(rest,positions,p={}){
  let table=tailCache.get(rest);if(!table){table=new Float32Array(rest.length/3*2);for(let i=0,k=0;i<rest.length;i+=3,k+=2){const x=rest[i],y=rest[i+1],w=1-smooth(336,408,y);table[k]=(x-178)*w;table[k+1]=(y-375)*w;}tailCache.set(rest,table);}
  const a=(p.tailCurl??0)*8*Math.PI/180,c=Math.cos(a)-1,s=Math.sin(a);
  for(let i=0,k=0;i<rest.length;i+=3,k+=2){positions[i]=rest[i]+table[k]*c-table[k+1]*s;positions[i+1]=rest[i+1]+table[k]*s+table[k+1]*c;}
}

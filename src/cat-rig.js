// Rigid painted layers and two-bone arms. A cup input never deforms the belly.
export const IDENTITY=Object.freeze([1,0,0,1,0,0]);
export const CAT_SKELETON=Object.freeze({
  body:{pivot:[296,407]},head:{pivot:[282,278]},tail:{root:[210,423]},
  grip:{center:[328,350],wrists:{near:[292,355],far:[367,354]}},
  arms:{near:{shoulder:[246,299],lengths:[47,47],bend:1},far:{shoulder:[351,301],lengths:[37,37],bend:1}},
  feet:[[284,432],[379,431]],eyes:[[237.5,210],[322,197]],
});
export const transformPoint=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
export function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
function at(pivot,degrees=0,x=0,y=0){const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),[px,py]=pivot;return[c,s,-s,c,px-c*px+s*py+x,py-s*px-c*py+y];}
function arm(shoulder,wrist,lengths,bend){
  const [dx,dy]=[wrist[0]-shoulder[0],wrist[1]-shoulder[1]],d=Math.hypot(dx,dy),[a,b]=lengths;
  const reachable=d>Math.abs(a-b)+.001&&d<a+b-.001;
  if(!reachable)return {shoulder,wrist,lengths,reachable,distance:d,elbow:null};
  const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
  const elbow=[shoulder[0]+dx*along/d-dy*height/d*bend,shoulder[1]+dy*along/d+dx*height/d*bend];
  return {shoulder,elbow,wrist,lengths,reachable,distance:d,
    upperAngle:Math.atan2(elbow[1]-shoulder[1],elbow[0]-shoulder[0]),foreAngle:Math.atan2(wrist[1]-elbow[1],wrist[0]-elbow[0])};
}
export function solveCatPose(p={}){
  const body=at(CAT_SKELETON.body.pivot,p.bodyAngle,0,(p.bodyY??0)+(p.rootY??0));
  const head=multiply(body,at(CAT_SKELETON.head.pivot,p.headAngle,p.headX,p.headY));
  const grip=multiply(body,at(CAT_SKELETON.grip.center,p.cupAngle,p.cupX,p.cupY));
  const tail=at(CAT_SKELETON.tail.root,(p.tail??0)*.45+(p.tailCurl??0)*2);
  const arms=Object.fromEntries(Object.entries(CAT_SKELETON.arms).map(([name,c])=>[name,arm(transformPoint(body,c.shoulder),transformPoint(grip,CAT_SKELETON.grip.wrists[name]),c.lengths,c.bend)]));
  return {body,head,grip,tail,arms,feetMatrix:[...IDENTITY],feet:CAT_SKELETON.feet,reachable:Object.values(arms).every(a=>a.reachable)};
}

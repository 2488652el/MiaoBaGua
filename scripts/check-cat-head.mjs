import assert from 'node:assert/strict';
import {solveCatPose,transformPoint} from '../src/cat-rig.js';
import {sampleCatMotion} from '../src/cat-motion.js';
const points=[[170,100],[290,70],[380,210],[270,263]],d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
let max=0;
for(let t=0;t<6220;t+=8){const pose=sampleCatMotion(t),r=solveCatPose(pose),m=points.map(p=>transformPoint(r.head,p));
for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)max=Math.max(max,Math.abs(d(points[i],points[j])-d(m[i],m[j])));
assert.deepEqual(r.head,solveCatPose({...pose,blink:1}).head);}
assert.ok(max<1e-8);console.log(JSON.stringify({maximumHeadDistanceError:max,blink:'only painted eye interiors, head matrix unchanged'}));

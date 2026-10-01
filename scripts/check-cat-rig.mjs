import assert from 'node:assert/strict';
import {solveCatPose,transformPoint,CAT_SKELETON} from '../src/cat-rig.js';
import {sampleCatMotion,sampleCatIdle} from '../src/cat-motion.js';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
let samples=0,maxBoneError=0,maxScaleError=0;
for(let t=0;t<126000;t+=16){
  const rig=solveCatPose(t<6220?sampleCatMotion(t):sampleCatIdle(t));samples++;
  assert.ok(rig.reachable,'unreachable at '+t);
  for(const a of Object.values(rig.arms))maxBoneError=Math.max(maxBoneError,Math.abs(distance(a.shoulder,a.elbow)-a.lengths[0]),Math.abs(distance(a.elbow,a.wrist)-a.lengths[1]));
  for(const key of ['body','head','grip','tail']){const[a,b,c,d]=rig[key];maxScaleError=Math.max(maxScaleError,Math.abs(a*a+b*b-1),Math.abs(c*c+d*d-1),Math.abs(a*d-b*c-1));}
}
const isolation=solveCatPose({cupX:20,cupY:-20,cupAngle:9});
for(const p of [[280,305],[282,382],[325,408]])assert.deepEqual(transformPoint(isolation.body,p),p);
assert.ok(maxBoneError<1e-8&&maxScaleError<1e-10);
console.log(JSON.stringify({samples,maxBoneError,maxScaleError,handInputBodyDisplacement:0,rig:'two-bone arms with fixed lengths; rigid torso/head/cup; planted hips'},null,2));

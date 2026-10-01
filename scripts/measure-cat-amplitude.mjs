import {sampleCatMotion} from '../src/cat-motion.js';import {solveCatPose,transformPoint} from '../src/cat-rig.js';
const span=a=>Math.max(...a)-Math.min(...a),results={};
for(const[name,start,end]of[['slow',800,1720],['fast',2840,3560]]){const hand=[],body=[],vertical=[],angles=[];
for(let t=start;t<=end;t+=8){const p=sampleCatMotion(t),r=solveCatPose(p);hand.push(p.cupX);vertical.push(p.cupY);body.push(transformPoint(r.body,[280,305])[0]);angles.push(r.arms.near.foreAngle-r.arms.near.upperAngle);}
results[name]={handRelativeTorsoWidth:span(hand),handHeight:span(vertical),chestWidth:span(body),nearElbowChangeDegrees:span(angles)*180/Math.PI};}
console.log(JSON.stringify(results,null,2));

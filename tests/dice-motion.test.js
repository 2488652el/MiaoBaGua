import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { ContactEquation } from 'cannon-es';
import { simulateDice, createDiceTake, TAKES, STEP, D8_VERTICES, D8_RADIUS, D6_HALF } from '../src/dice-motion.js';
import { PHYSICS_SECOND_MS,DICE_SETTLE_MS,DICE_START_DELAY_MS,RESULT_REVEAL_START_MS } from '../src/motion-timing.js';

test('全部物理轨迹：真实落地回弹、翻滚、三枚骰子平放停稳且不穿桌', () => {
  for (const seed of TAKES) {
    const take=simulateDice(seed);
    const sleep=take.frames.findIndex(f=>f.every(d=>d.sleep));
    const stoppedMs=sleep*STEP*PHYSICS_SECOND_MS;
    assert.ok(stoppedMs>=4100 && stoppedMs<=4600,`${seed}: natural motion should last 4.1–4.6s (${stoppedMs})`);
    assert.ok(stoppedMs+DICE_START_DELAY_MS<=DICE_SETTLE_MS,`${seed}: settled state must follow physical stop`);
    assert.ok(RESULT_REVEAL_START_MS-stoppedMs>=550 && RESULT_REVEAL_START_MS-stoppedMs<=1100,`${seed}: leave a short readable pause`);
    let lateRotation=0;
    for(let die=0;die<3;die++) {
      const vertices=die===2 ? [-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[x*D6_HALF,y*D6_HALF,z*D6_HALF]))) : D8_VERTICES.map(v=>v.map(n=>n*D8_RADIUS));
      let bounced=false, rotation=0;
      for(let f=1;f<take.frames.length;f++) {
        const pose=take.frames[f][die], last=take.frames[f-1][die];
        const q=new Quaternion(...pose.q);
        const bottom=Math.min(...vertices.map(v=>new Vector3(...v).applyQuaternion(q).y+pose.p[1]));
        assert.ok(bottom>-.035,`${seed}: die ${die} must stay above table (${bottom})`);
        if(f>35&&pose.p[1]-last.p[1]>.003) bounced=true;
        if(f>60&&f<180) rotation+=q.angleTo(new Quaternion(...last.q));
        if(f*STEP>2.5 && f<sleep)lateRotation+=q.angleTo(new Quaternion(...last.q));
      }
      assert.ok(bounced,`${seed}: die ${die} rebounds`);
      assert.ok(rotation>.1,`${seed}: die ${die} turns after landing`);
      assert.ok(take.impacts[die].length>=4,`${seed}: die ${die} has multiple natural impacts`);
      const expected=die===2?D6_HALF:D8_RADIUS/Math.sqrt(3);
      assert.ok(Math.abs(take.rest[die].p[1]-expected)<.005,`${seed}: die ${die} rests on a face`);
      assert.deepEqual(take.frames.at(-2)[die],take.frames.at(-1)[die]);
    }
    assert.ok(lateRotation>.2,`${seed}: the extended tail must contain rotation, not just stationary waiting`);
  }
});

test('同一摇卦在控制台和直播窗口得到完全相同的轨迹', () => {
  assert.deepEqual(createDiceTake('shared-roll-9381'),createDiceTake('shared-roll-9381'));
});

test('八面骰接触点留在真实骰面上，轻触不会被误判成深度重叠', () => {
  const computeB = ContactEquation.prototype.computeB;
  let contacts = 0, maxOutside = 0, maxPenetration = 0;
  ContactEquation.prototype.computeB = function (dt) {
    if (this.bi.mass && this.bj.mass) {
      contacts++;
      for (const [body, point] of [[this.bi, this.ri], [this.bj, this.rj]]) {
        const local = body.quaternion.conjugate().vmult(point);
        const outside = body.shapes[0].type === 16
          ? Math.abs(local.x) + Math.abs(local.y) + Math.abs(local.z) - D8_RADIUS
          : Math.max(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)) - D6_HALF;
        maxOutside = Math.max(maxOutside, outside);
      }
      const gap = this.bj.position.vadd(this.rj).vsub(this.bi.position).vsub(this.ri);
      maxPenetration = Math.max(maxPenetration, -this.ni.dot(gap));
    }
    return computeB.call(this, dt);
  };
  try {
    // These original throws produced contact points far outside an octahedron,
    // including a nearly stationary touch that launched both dice sideways.
    for (const seed of ['suspense-92', 'suspense-118', 'suspense-265', 'suspense-314', ...TAKES]) {
      simulateDice(seed);
    }
  } finally {
    ContactEquation.prototype.computeB = computeB;
  }
  assert.ok(contacts > 20, 'must exercise real die-to-die contacts');
  assert.ok(maxOutside < .006, `contact point outside the actual hull: ${maxOutside}`);
  assert.ok(maxPenetration < .03, `false deep overlap: ${maxPenetration}`);
});

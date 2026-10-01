import * as CANNON from 'cannon-es';
import { DiceConvexPolyhedron } from './dice-contact.js';

export const STEP = 1 / 120;
export const SIMULATION_SECONDS = 5;
export const D8_RADIUS = .66;
export const D6_HALF = .37;
export const D8_VERTICES = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
export const D8_FACES = [[2,4,0],[2,0,5],[2,5,1],[2,1,4],[3,0,4],[3,5,0],[3,1,5],[3,4,1]];

function randomFrom(seed) {
  let n = 2166136261;
  for (const char of String(seed)) n = Math.imul(n ^ char.charCodeAt(0), 16777619);
  return () => { n += 0x6D2B79F5; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// A deterministic rigid-body take. Both windows play exactly these poses.
// Values are assigned to the final upward faces before the first frame is drawn.
export function simulateDice(seed) {
  const random = randomFrom(seed);
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -26, 0), allowSleep: true });
  world.solver.iterations = 18;
  const wood = new CANNON.Material('painted wood');
  const table = new CANNON.Material('paper table');
  world.addContactMaterial(new CANNON.ContactMaterial(wood, table, { friction: .38, restitution: .66 }));
  world.addContactMaterial(new CANNON.ContactMaterial(wood, wood, { friction: .28, restitution: .08 }));
  const floor = new CANNON.Body({ mass: 0, material: table, shape: new CANNON.Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);
  // Invisible physical bounds are outside the visible resting area.
  for (const [x,z,hx,hz] of [[-2.18,0,.1,3],[2.18,0,.1,3],[0,-1.6,3,.1],[0,1.8,3,.1]]) {
    world.addBody(new CANNON.Body({mass:0, material:table, position:new CANNON.Vec3(x,1,z), shape:new CANNON.Box(new CANNON.Vec3(hx,2,hz))}));
  }
  const starts = [[-1.2,1.8,-.95],[1.16,2.15,-.95],[.05,2.45,1.05]];
  const bodies = starts.map((p, i) => {
    const shape = i === 2 ? new CANNON.Box(new CANNON.Vec3(D6_HALF,D6_HALF,D6_HALF)) : new DiceConvexPolyhedron({
      vertices:D8_VERTICES.map(v=>new CANNON.Vec3(...v.map(n=>n*D8_RADIUS))), faces:D8_FACES,
    });
    const body = new CANNON.Body({ mass:i===2?.85:1, material:wood, shape, linearDamping:.12, angularDamping:.12, sleepSpeedLimit:.16, sleepTimeLimit:.22 });
    body.position.set(...p);
    body.quaternion.setFromEuler(random()*3,random()*3,random()*3);
    body.velocity.set((i===0?.9:i===1?-.8:-.2)+(random()-.5)*.25, -.8, (i===2?-.65:1.2));
    body.angularVelocity.set(13+random()*7, (random()-.5)*10, (i===1?-1:1)*(13+random()*7));
    world.addBody(body);
    return body;
  });
  const frames=[];
  const impacts=[[],[],[]];
  let elapsed=0;
  bodies.forEach((body,i)=>body.addEventListener('collide', e=>{
    if(e.body===floor && Math.abs(e.contact.getImpactVelocityAlongNormal())>1.1 && elapsed-(impacts[i].at(-1)||-1)>.09) impacts[i].push(elapsed);
  }));
  for(let frame=0;frame<=Math.round(SIMULATION_SECONDS/STEP);frame++) {
    frames.push(bodies.map(body=>({p:body.position.toArray(),q:body.quaternion.toArray(),sleep:body.sleepState===2})));
    elapsed=(frame+1)*STEP;
    // Four contact substeps prevent fast corners from tunnelling into the table.
    for(let sub=0;sub<4;sub++) world.step(STEP/4);
  }
  return {frames,impacts,rest:frames.at(-1)};
}

// Curated physical throws: every die rests on a face with a readable, spaced layout.
export const TAKES = ['gentle-1329','gentle-1664','gentle-2070','gentle-2325'];
const preparedTakes = new Map();
function preparedTake(id) {
  if (!preparedTakes.has(id)) preparedTakes.set(id, simulateDice(id));
  return preparedTakes.get(id);
}
// The four deterministic trajectories are read-only during playback. Prepare
// them before a live cast so physics never blocks the cat's first movement.
export function warmDiceTakes() {
  TAKES.forEach(preparedTake);
}
export function createDiceTake(seed) {
  return preparedTake(TAKES[Math.floor(randomFrom(seed)()*TAKES.length)]);
}

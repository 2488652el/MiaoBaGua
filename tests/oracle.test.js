import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cast, TRIGRAMS, relation, randomInt } from '../src/oracle.js';
import { MEANINGS, TOPICS, interpret } from '../src/readings.js';

test('全部 384 组：六爻方向、唯一变爻、体用归属与64卦覆盖', () => {
  const names = new Set(), numbers = new Set();
  for (let upper = 0; upper < 8; upper++) for (let lower = 0; lower < 8; lower++) for (let moving = 1; moving <= 6; moving++) {
    const r = cast(upper,lower,moving);
    names.add(r.base.name); numbers.add(r.base.number);
    assert.deepEqual(r.base.bits.slice(0,3), TRIGRAMS[lower].bits);
    assert.deepEqual(r.base.bits.slice(3), TRIGRAMS[upper].bits);
    assert.deepEqual(r.base.bits.flatMap((bit,i) => bit !== r.changed.bits[i] ? [i+1] : []), [moving]);
    assert.equal(r.body, TRIGRAMS[moving <= 3 ? lower : upper]);
    assert.equal(r.use, TRIGRAMS[moving <= 3 ? upper : lower]);
    assert.equal(r.bodyPosition,moving<=3?'下卦':'上卦');
    assert.equal(r.usePosition,moving<=3?'上卦':'下卦');
    assert.ok(r.changed.number >= 1 && r.changed.number <= 64);
    for (const topic of TOPICS) assert.ok(Object.values(interpret(r,topic.id)).every(value => typeof value === 'string' && value.length > 3));
  }
  assert.equal(names.size,64);
  assert.deepEqual([...numbers].sort((a,b)=>a-b),Array.from({length:64},(_,i)=>i+1));
  assert.deepEqual(new Set(Object.keys(MEANINGS)), names);
});
test('文王卦序与上下卦的已知对照', () => {
  const fixtures = [
    ['乾','乾','乾',1],['坤','坤','坤',2],['坎','震','屯',3],['艮','坎','蒙',4],
    ['坎','乾','需',5],['乾','坎','讼',6],['坤','坎','师',7],['坎','坤','比',8],
    ['巽','乾','小畜',9],['乾','兑','履',10],['坤','乾','泰',11],['乾','坤','否',12],
    ['兑','震','随',17],['巽','兑','中孚',61],['震','艮','小过',62],['坎','离','既济',63],['离','坎','未济',64],
  ];
  for (const [u,l,name,n] of fixtures) {
    const r = cast(TRIGRAMS.findIndex(t=>t.name===u),TRIGRAMS.findIndex(t=>t.name===l),1);
    assert.equal(r.base.name,name); assert.equal(r.base.number,n);
  }
});
test('天地否三爻动为天山遁；四爻动切换体用', () => {
  const third = cast(0,1,3), fourth = cast(0,1,4);
  assert.equal(third.base.fullName,'天地否'); assert.equal(third.changed.fullName,'天山遁');
  assert.equal(third.body.name,'坤'); assert.equal(third.use.name,'乾'); assert.equal(third.relation.name,'体生用');
  assert.equal(fourth.changed.fullName,'风地观'); assert.equal(fourth.body.name,'乾'); assert.equal(fourth.use.name,'坤'); assert.equal(fourth.relation.name,'用生体');
});
test('五种体用关系方向正确', () => {
  const cases = [['金','金','体用比和'],['金','土','用生体'],['金','水','体生用'],['金','木','体克用'],['金','火','用克体']];
  for (const [body,use,name] of cases) assert.equal(relation({element:body},{element:use}).name,name);
});
test('拒绝越界和非整数', () => {
  for (const values of [[8,0,1],[-1,0,1],[0,8,1],[0,0,0],[0,0,7],[0,0,1.5],['0',0,1]]) assert.throws(()=>cast(...values),RangeError);
  for (const sides of [0,-1,2.5,Infinity]) assert.throws(()=>randomInt(sides),RangeError);
});
test('六选一拒绝有偏尾区间，八选一覆盖所有面', context => {
  const samples = [4294967295, 5];
  context.mock.method(globalThis.crypto,'getRandomValues', array => { array[0] = samples.shift(); return array; });
  assert.equal(randomInt(6),5); assert.equal(samples.length,0);
  for (let i=0;i<8;i++) { samples.push(i); assert.equal(randomInt(8),i); }
});

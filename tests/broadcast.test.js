import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ELEMENTS, IDEAS, LIVE_COPY, LIVE_TITLE, makeLiveResult, liveIdea, toBroadcastState } from '../src/broadcast.js';
import { cast, TRIGRAMS } from '../src/oracle.js';
import { MEANINGS } from '../src/readings.js';
import { OracleEngine } from '../src/state.js';

// Product content restrictions chosen for this live presentation, not a platform blacklist.
const excluded=/卦|爻|乾|坤|艮|巽|坎|兑|算命|占卜|运势|预测|开运|改运|吉凶|姻缘|正缘|天命|命运|\u262f|[\u2630-\u2637]|[\u4dc0-\u4dff]/u;

test('384种点数组合：64条独立主题、八种自然图案，没有直播排除内容',()=>{
  assert.equal(IDEAS.length,64);assert.equal(new Set(IDEAS.map(i=>i.title)).size,64);
  assert.equal(ELEMENTS.length,8);
  assert.deepEqual(ELEMENTS.map(e=>e.name),TRIGRAMS.map(t=>t.nature));
  assert.doesNotMatch(JSON.stringify({ELEMENTS,IDEAS,LIVE_COPY,LIVE_TITLE}),excluded);
  const ids=new Set();
  for(let first=0;first<8;first++)for(let second=0;second<8;second++)for(let pips=1;pips<=6;pips++){
    const result=makeLiveResult({...cast(first,second,pips),nickname:'卦爻泄漏测试',reading:{title:'算命'}});
    assert.deepEqual(result,{first,second,pips});
    const idea=liveIdea(result);assert.ok(idea);ids.add(idea.id);
    const original=cast(first,second,pips);
    assert.equal(idea.title,MEANINGS[original.base.name][0]);
    assert.equal(idea.composition,original.upper.nature+'在上 · '+original.lower.nature+'在下');
    assert.doesNotMatch(JSON.stringify({result,idea}),excluded);
    assert.ok([...idea.title].length<=4);
  }
  assert.equal(ids.size,64);
});

test('重启与IPC只传递公共数字数据；昵称、历史、错误和原始解读留在控制台',()=>{
  const row={upperIndex:2,lowerIndex:3,moving:6,id:'saved-private',time:1,nickname:'私密卦名',topic:'today'};
  const engine=new OracleEngine({saved:{history:[row],draft:{nickname:'算命'}}});
  engine.state.storageError='卦象文件错误';
  const publicState=toBroadcastState(engine.snapshot());
  assert.deepEqual(publicState.liveResult,{first:2,second:3,pips:6});
  for(const key of ['result','history','draft','storageError','display','dice'])assert.ok(!(key in publicState));
  assert.doesNotMatch(JSON.stringify(publicState),excluded);
  assert.equal(makeLiveResult({upperIndex:8,lowerIndex:0,moving:3}),null);
  assert.equal(makeLiveResult(null),null);
});

test('直播渲染组件和骰面材质不引用原始词库或六线图形',()=>{
  for(const name of ['components/OracleCard.jsx','components/ResultPaper.jsx','components/RollingDice.jsx','components/NatureIllustration.jsx','dice-renderer.js','nature-art.js']){
    const source=readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
    assert.doesNotMatch(source,excluded,name);
    assert.doesNotMatch(source,/from ['"].*(?:oracle|readings)\.js['"]|<Hexagram|\.bits\b|\.fullName\b/,name);
  }
});

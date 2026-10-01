// Public imagery follows the numeric upper/lower arrangement. The vocabulary below
// contains approved nature names and interpretive themes, without private records.
export const LIVE_TITLE = '灵感骰子 · 直播组件';
export const CAT_TITLE = '三花守摊猫 · 直播组件';
export const LIVE_COPY = Object.freeze({ idle:'静候一象', rolling:'骰子滚动中', settled:'意象呈现', footer:'传统意象 · 互动娱乐', loading:'正在打开灵感骰子…', error:'画面暂未连接', fallback:'三维画面暂不可用', points:'点数' });
export const ELEMENTS = Object.freeze([
  {
    "id": "sky",
    "name": "天"
  },
  {
    "id": "earth",
    "name": "地"
  },
  {
    "id": "thunder",
    "name": "雷"
  },
  {
    "id": "fire",
    "name": "火"
  },
  {
    "id": "mountain",
    "name": "山"
  },
  {
    "id": "wind",
    "name": "风"
  },
  {
    "id": "water",
    "name": "水"
  },
  {
    "id": "lake",
    "name": "泽"
  }
].map(Object.freeze));

// Rows are upper images; columns are lower images. Themes preserve their meaning.
const GROUPS = [
  [
    ["自强不息","方向清楚时，保持主动，也给行动留出余地。"],
    ["疏通阻隔","感觉不顺时，先理清哪里卡住，不必一味用力。"],
    ["真诚行事","从事实出发，认真完成自己能够负责的事情。"],
    ["求同存异","目标相近并不代表想法相同，倾听能让合作更稳。"],
    ["适时退让","暂时退开不等于放弃，给自己留下调整的空间。"],
    ["留心相遇","新的人与事值得了解，先观察，再决定靠近的距离。"],
    ["把话说开","分歧出现时，先确认事实，再表达自己的需要。"],
    ["谨慎前行","在行动之前看清边界，稳妥也是一种进步。"],
  ],
  [
    ["彼此通达","交流顺畅时，把好想法落实为具体的行动。"],
    ["厚积而行","踏实承接眼前的事，耐心往往比催促更有力量。"],
    ["回到起点","回到最初的目标，重新出发也可以是一种进步。"],
    ["护住心力","环境不顺时先照顾自己，保持内心清楚的方向。"],
    ["谦而有度","不必急于证明自己，让扎实的行动表达能力。"],
    ["一步一阶","一步步提升能力，不用与别人的速度比较。"],
    ["齐心有方","协作需要清楚的分工，先找到共同的目标。"],
    ["主动关照","带着耐心靠近问题，也认真听取不同的反馈。"],
  ],
  [
    ["有力有节","有把握时可以主动，但不要忽略分寸与反馈。"],
    ["准备在先","热情值得珍惜，事先准备能让行动更从容。"],
    ["稳住回应","变化来得突然时，先稳住自己，再作出回应。"],
    ["繁中有序","事情多起来时，分清轻重，让精力有序分配。"],
    ["细处用心","先做好眼前的小事，细节比宏大的承诺更有帮助。"],
    ["持之有常","稳定的小习惯，比一时的热情更容易积累成果。"],
    ["松开绳结","有些压力可以逐步放下，从最容易解决的一件事开始。"],
    ["摆正位置","看清彼此的期待和所处位置，别让急切替代判断。"],
  ],
  [
    ["珍惜所长","看见手中的资源，善用长处，也记得有所节制。"],
    ["循序进取","把握能够向前的一步，让进展建立在实际行动上。"],
    ["直面症结","找到真正的障碍，用清楚的方法逐步解决。"],
    ["看清重点","让目标与信息更清楚，不被表面的热闹带走。"],
    ["轻装适应","处在陌生环境里，保持观察，先找到自己的落脚点。"],
    ["整合所长","把已有的能力与资源重新组合，寻找更合适的方法。"],
    ["继续打磨","还有未完成的部分，耐心收尾，不必急于定论。"],
    ["理解不同","看法不同未必无法同行，先找到能达成一致的部分。"],
  ],
  [
    ["厚积蓄势","积累能力与经验，暂时的慢是为了走得更稳。"],
    ["收拾根基","暂时减少消耗，优先照顾最基本、最重要的部分。"],
    ["养好节奏","留意日常的输入与消耗，把精力用在值得的地方。"],
    ["内外相称","表达可以更好看，但内容扎实才更能打动人。"],
    ["知止有定","适时停一停，让注意力回到此刻能够完成的事。"],
    ["整理旧事","把遗留的问题一件件理清，为新的进展腾出空间。"],
    ["虚心求知","遇到不懂的地方，先问清楚，再下判断。"],
    ["有所取舍","主动减少不必要的负担，把注意力还给真正重要的事。"],
  ],
  [
    ["点滴积累","小小的积累自有价值，不必急着一次完成所有事。"],
    ["先看后行","拉开一点距离看全局，或许能发现忽略的细节。"],
    ["互相成就","帮助与学习可以相互发生，让付出有方向也有边界。"],
    ["各尽其责","日常相处需要清晰的边界，也需要温和的沟通。"],
    ["慢慢成形","稳定推进，给新的习惯和关系一点生长的时间。"],
    ["温和深入","耐心说明、反复尝试，温和也可以带来真实的改变。"],
    ["重聚心力","注意力分散时重新整理目标，把力量集中到一处。"],
    ["诚意为先","让承诺与行动一致，信任来自可感受到的小事。"],
  ],
  [
    ["耐心蓄力","尚未成熟的事不必强推，等待时也能做好准备。"],
    ["相互靠近","找到合拍的人，也记得在关系里保留真诚。"],
    ["起步有序","开头难免磕绊，把大问题拆成能够完成的小步骤。"],
    ["完成之后","阶段性完成后，检查细节，也留意新的变化。"],
    ["换条路径","前路受阻时停下来看看，调整方法或请求帮助。"],
    ["打好基础","稳定可靠的基础值得反复维护，别忽略日常的小事。"],
    ["稳渡难处","遇到困难先稳住节奏，一次处理一个具体问题。"],
    ["有度有序","为时间与精力设好边界，让日常安排更加可持续。"],
  ],
  [
    ["清楚决断","需要表态时说明理由，坚定之余也保持平和。"],
    ["凝聚共识","把分散的想法聚到一起，找到共同能够推进的一件事。"],
    ["顺势调整","观察实际变化，适当调整方法，而不是随波逐流。"],
    ["有序改变","想改变时先说明原因，用可验证的小尝试探路。"],
    ["用心感受","留意细微的回应，用真诚的表达代替猜测。"],
    ["减轻负担","承担过多时，分清必要与多余，及时寻求协作。"],
    ["守住节奏","资源有限时，先守住核心任务，给自己保留恢复的时间。"],
    ["坦诚交流","愉快的交流始于认真倾听，也需要真实表达。"],
  ],
];
export const IDEAS = Object.freeze(GROUPS.flatMap((group,first)=>group.map(([title,prompt],second)=>Object.freeze({id:first*8+second,title,prompt,composition:ELEMENTS[first].name+'在上 · '+ELEMENTS[second].name+'在下'}))));

export function makeLiveResult(record) {
  if(!record || !Number.isInteger(record.upperIndex) || !Number.isInteger(record.lowerIndex) || !ELEMENTS[record.upperIndex] || !ELEMENTS[record.lowerIndex] || !Number.isInteger(record.moving) || record.moving<1 || record.moving>6) return null;
  return {first:record.upperIndex,second:record.lowerIndex,pips:record.moving};
}
export function liveIdea(result) {
  return result && ELEMENTS[result.first] && ELEMENTS[result.second] ? IDEAS[result.first*8+result.second] : null;
}

// A narrow IPC payload for the public window, including reconnects and restores.
export function toBroadcastState(state) {
  const {revision,phase,diceSettled,diceMotion,settings,liveResult}=state;
  return {
    revision, phase, diceSettled:!!diceSettled,
    diceMotion:diceMotion?{id:diceMotion.id,startedAt:diceMotion.startedAt}:null,
    liveResult:liveResult?{first:liveResult.first,second:liveResult.second,pips:liveResult.pips}:null,
    settings:{size:settings.size,background:settings.background,chromaColor:settings.chromaColor},
  };
}

// The companion needs only a clock. It never receives questions, results or AI.
export function toCatState({revision,phase,diceMotion,settings}) {
  return {
    revision,phase,
    diceMotion:diceMotion?{id:diceMotion.id,startedAt:diceMotion.startedAt}:null,
    settings:{size:settings.catSize,background:settings.catBackground,chromaColor:settings.catChromaColor,idleEnabled:settings.catIdleEnabled},
  };
}

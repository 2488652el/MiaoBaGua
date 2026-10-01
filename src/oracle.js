// Trigram bits are always stored from bottom line to top line.
export const TRIGRAMS = [
  { name: '乾', symbol: '☰', nature: '天', element: '金', bits: [1, 1, 1] },
  { name: '坤', symbol: '☷', nature: '地', element: '土', bits: [0, 0, 0] },
  { name: '震', symbol: '☳', nature: '雷', element: '木', bits: [1, 0, 0] },
  { name: '离', symbol: '☲', nature: '火', element: '火', bits: [1, 0, 1] },
  { name: '艮', symbol: '☶', nature: '山', element: '土', bits: [0, 0, 1] },
  { name: '巽', symbol: '☴', nature: '风', element: '木', bits: [0, 1, 1] },
  { name: '坎', symbol: '☵', nature: '水', element: '水', bits: [0, 1, 0] },
  { name: '兑', symbol: '☱', nature: '泽', element: '金', bits: [1, 1, 0] },
];
export const NUMERALS = ['一', '二', '三', '四', '五', '六'];
export const LINE_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
export const BODY_USE_RULE = Object.freeze({
  id: 'moving-trigram-is-body-v1',
  description: '本卦中含动爻的三画卦为体，另一个三画卦为用。爻位自下而上编号：初爻、二爻、三爻动，下卦为体、上卦为用；四爻、五爻、上爻动，上卦为体、下卦为用。体用五行取本卦中对应三画卦的五行。',
});

// Traditional 8 × 8 table. Rows = upper; columns = lower.
const ORDER = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
const TABLE = [
  ['乾','履','同人','无妄','姤','讼','遁','否'],
  ['夬','兑','革','随','大过','困','咸','萃'],
  ['大有','睽','离','噬嗑','鼎','未济','旅','晋'],
  ['大壮','归妹','丰','震','恒','解','小过','豫'],
  ['小畜','中孚','家人','益','巽','涣','渐','观'],
  ['需','节','既济','屯','井','坎','蹇','比'],
  ['大畜','损','贲','颐','蛊','蒙','艮','剥'],
  ['泰','临','明夷','复','升','师','谦','坤'],
];
const KING_WEN = '乾 坤 屯 蒙 需 讼 师 比 小畜 履 泰 否 同人 大有 谦 豫 随 蛊 临 观 噬嗑 贲 剥 复 无妄 大畜 颐 大过 坎 离 咸 恒 遁 大壮 晋 明夷 家人 睽 蹇 解 损 益 夬 姤 萃 升 困 井 革 鼎 震 艮 渐 归妹 丰 旅 巽 兑 涣 节 中孚 小过 既济 未济'.split(' ');
const GENERATES = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CONTROLS = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const RELATIONS = {
  harmony: { name: '体用比和', mood: '同心相应', text: '步调相合，稳稳向前。把心里的想法，化成眼前的一小步。' },
  supported: { name: '用生体', mood: '顺势而行', text: '借一分外力，添一分从容。留心身边的善意，也记得接住帮助。' },
  giving: { name: '体生用', mood: '量力而行', text: '付出也需要分寸。照顾好自己的节奏，再慢慢完成想做的事。' },
  active: { name: '体克用', mood: '以行动应变', text: '方向在心，行动在手。理清轻重缓急，先做好能够掌握的部分。' },
  challenged: { name: '用克体', mood: '以静待时', text: '遇到阻力，不妨稍作停顿。换个角度看问题，给自己一些余地。' },
};

export function hexagram(upper, lower) {
  const name = TABLE[ORDER.indexOf(upper.name)][ORDER.indexOf(lower.name)];
  const fullName = upper.name === lower.name ? `${upper.name}为${upper.nature}` : `${upper.nature}${lower.nature}${name}`;
  return { name, fullName, number: KING_WEN.indexOf(name) + 1, bits: [...lower.bits, ...upper.bits] };
}

export function relation(body, use) {
  if (body.element === use.element) return RELATIONS.harmony;
  if (GENERATES[use.element] === body.element) return RELATIONS.supported;
  if (GENERATES[body.element] === use.element) return RELATIONS.giving;
  if (CONTROLS[body.element] === use.element) return RELATIONS.active;
  return RELATIONS.challenged;
}

export function cast(upperIndex, lowerIndex, moving) {
  if (!Number.isInteger(upperIndex) || !Number.isInteger(lowerIndex) || !TRIGRAMS[upperIndex] || !TRIGRAMS[lowerIndex] || !Number.isInteger(moving) || moving < 1 || moving > 6) throw new RangeError('卦象结果超出范围');
  const upper = TRIGRAMS[upperIndex];
  const lower = TRIGRAMS[lowerIndex];
  const base = hexagram(upper, lower);
  const changedBits = [...base.bits];
  changedBits[moving - 1] ^= 1;
  const fromBits = bits => TRIGRAMS.find(t => t.bits.every((bit, i) => bit === bits[i]));
  const changedUpper = fromBits(changedBits.slice(3));
  const changedLower = fromBits(changedBits.slice(0, 3));
  const body = moving <= 3 ? lower : upper;
  const use = moving <= 3 ? upper : lower;
  return {
    upperIndex, lowerIndex, moving, upper, lower, body, use, base,
    bodyPosition: moving <= 3 ? '下卦' : '上卦',
    usePosition: moving <= 3 ? '上卦' : '下卦',
    changed: hexagram(changedUpper, changedLower),
    relation: relation(body, use),
  };
}

// Rejection sampling avoids modulo bias; these are independent virtual dice.
export function randomInt(sides) {
  if (!Number.isInteger(sides) || sides < 1 || sides > 0x100000000) throw new RangeError('随机范围无效');
  const limit = Math.floor(0x100000000 / sides) * sides;
  const values = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % sides;
}

export function randomCast() { return cast(randomInt(8), randomInt(8), randomInt(6) + 1); }

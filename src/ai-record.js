export const QUESTION_LIMIT = 1000;
export const AI_TEXT_LIMIT = 16000;

export function cleanQuestion(value) {
  return typeof value === 'string' ? value.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,QUESTION_LIMIT) : '';
}

export function cleanAi(value, restoring=false) {
  if (!value || typeof value !== 'object' || !['pending','streaming','success','error','cancelled'].includes(value.status)) return undefined;
  const interrupted = restoring && ['pending','streaming'].includes(value.status);
  return {
    status: interrupted ? 'cancelled' : value.status,
    text: typeof value.text==='string' ? value.text.slice(0,AI_TEXT_LIMIT) : '',
    error: interrupted ? '上次生成被中断，可重新解读。' : typeof value.error==='string' ? value.error.slice(0,300) : '',
    model: typeof value.model==='string' ? value.model.slice(0,80) : '',
    ruleVersion: typeof value.ruleVersion==='string' ? value.ruleVersion.slice(0,80) : '',
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : 0,
  };
}

import { buildDailyHints } from '../domain/daily-hints.js';

export function renderDailyHints(context = {}) {
  const host = document.querySelector('#daily-hints[data-hints]'); if (!host) return;
  const heading = host.querySelector('h2');
  const hints = buildDailyHints(context);
  const list = document.createElement('ul'); list.className = 'daily-hint-list';
  hints.slice(0, 4).forEach((hint, index) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    const path = hint.id.includes('recovery') || hint.id.includes('coverage') ? 'workout' : hint.id === 'apple-health' ? 'apple-health' : 'food';
    link.href = `#/${path}`; link.textContent = hint.text.replace(/(\d+(?:\.\d+)?)\s*小时/g, (_match, hours) => `约 ${Math.round(Number(hours))} 小时`);
    const basisValue = hint.basis;
    const basisText = typeof basisValue === 'string' ? basisValue : Object.values(basisValue || {}).map(value => typeof value === 'object' ? Object.values(value).join('、') : String(value)).join('；');
    const basis = document.createElement('small'); basis.textContent = `依据：${basisText || '所选日期的演示记录'} · 规则提示，非医疗建议`;
    item.append(link, basis); list.append(item);
  });
  const fallback = document.createElement('p'); fallback.className = 'hint-fallback';
  fallback.textContent = hints.length ? '数据依据不完整的项目会显示为未知或记录不完整。' : '当前数据不足，无法生成提示。';
  host.replaceChildren(...(heading ? [heading] : []), list, fallback);
}

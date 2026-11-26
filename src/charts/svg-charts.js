const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, content = '') => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) if (value != null) node.setAttribute(key, value);
  if (content) node.textContent = content;
  return node;
};
const attachTooltip = (node, text) => {
  node.dataset.tooltip = text;
  node.addEventListener('pointerenter', event => showTooltip(node, event.clientX, event.clientY));
  node.addEventListener('pointermove', event => positionTooltip(event.clientX, event.clientY));
  node.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') hideTooltip(); });
  node.addEventListener('focus', () => { const box = node.getBoundingClientRect(); showTooltip(node, box.left + box.width / 2, box.top); });
  node.addEventListener('blur', hideTooltip);
  node.addEventListener('click', event => showTooltip(node, event.clientX || node.getBoundingClientRect().left, event.clientY || node.getBoundingClientRect().top));
  return node;
};
function positionTooltip(x, y) {
  const tip = document.querySelector('.chart-tooltip');
  if (!tip || tip.hidden) return;
  tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, x + 12))}px`;
  tip.style.top = `${Math.max(8, Math.min(window.innerHeight - tip.offsetHeight - 8, y - tip.offsetHeight - 12))}px`;
}
function showTooltip(node, x, y) { const tip = document.querySelector('.chart-tooltip'); if (!tip) return; tip.textContent = node.dataset.tooltip; tip.hidden = false; positionTooltip(x, y); }
function hideTooltip() { const tip = document.querySelector('.chart-tooltip'); if (tip) tip.hidden = true; }
export function initChartTooltip() { document.addEventListener('keydown', event => { if (event.key === 'Escape') hideTooltip(); }); }
const label = (svg, x, y, text, anchor = 'end') => svg.append(svgEl('text', { x, y, 'text-anchor': anchor, fill: '#344b47', 'font-size': 16 }, text));

export function lineChart(values, dates, title, unit, id = 'trend', color = '#17685f', sources = []) {
  const svg = svgEl('svg', { viewBox: '0 0 360 220', role: 'group', 'aria-label': title, 'data-chart': id });
  const present = values.filter(value => typeof value === 'number' && Number.isFinite(value));
  if (!present.length) { label(svg, 180, 110, '暂无足够数据', 'middle'); return svg; }
  const max = Math.max(...present), min = Math.min(...present), spread = max - min || Math.max(max * .1, 1);
  const low = Math.max(0, min - spread * .15), high = max + spread * .15;
  const xAt = index => 48 + index * (300 / Math.max(1, values.length - 1));
  const yAt = value => 174 - (value - low) / (high - low || 1) * 132;
  for (let tick = 0; tick <= 3; tick++) { const value = low + (high - low) * tick / 3, y = yAt(value); svg.append(svgEl('line', { x1: 42, y1: y, x2: 350, y2: y, stroke: '#d6e0dd' })); label(svg, 36, y + 4, String(Math.round(value))); }
  let segment = [];
  const flush = () => { if (segment.length > 1) svg.append(svgEl('path', { d: segment.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })); segment = []; };
  values.forEach((value, index) => {
    const x = xAt(index);
    if (typeof value !== 'number' || !Number.isFinite(value)) { flush(); const missing = attachTooltip(svgEl('text', { x, y: 65, 'text-anchor': 'middle', fill: '#344b47', 'font-size': 16, tabindex: 0, role: 'img' }, '未知'), `${dates[index]} · 未知 ${unit}（数据不足）`); svg.append(missing); label(svg, x, 207, dates[index].slice(5), 'middle'); return; }
    const y = yAt(value); segment.push({ x, y });
    const detail = `${dates[index]} · ${value} ${unit}（${sources[index] || '示例汇总'}）`;
    const hit = attachTooltip(svgEl('rect', { x: x - 16, y: y - 16, width: 32, height: 32, fill: 'transparent', tabindex: 0, role: 'img', 'aria-label': detail }), detail);
    svg.append(hit, svgEl('circle', { cx: x, cy: y, r: 6, fill: '#fff', stroke: color, 'stroke-width': 3 }));
    label(svg, x, 207, dates[index].slice(5), 'middle');
  });
  flush();
  return svg;
}

export function heatmap(workouts, dates, onPick, selectedDate = null) {
  const svg = svgEl('svg', { viewBox: '0 0 360 104', role: 'group', 'aria-label': '最近训练热力图', 'data-chart': 'training-heatmap' });
  dates.forEach((date, index) => {
    const count = workouts.filter(workout => workout.local_date === date).length, x = 8 + index * 50;
    const tip = `${date} · ${count} 次训练（记录汇总）`;
    const group = svgEl('g', { tabindex: 0, role: 'button', 'aria-label': tip, 'aria-pressed': selectedDate === date, 'data-tooltip': tip });
    group.append(svgEl('rect', { x, y: 8, width: 42, height: 54, rx: 6, fill: count ? '#17685f' : '#d6e0dd', stroke: selectedDate === date ? '#834f00' : '#fff', 'stroke-width': selectedDate === date ? 3 : 1 }));
    group.append(svgEl('text', { x: x + 21, y: 42, 'text-anchor': 'middle', fill: count ? '#fff' : '#182b2c', 'font-size': 16 }, String(count)));
    group.append(svgEl('text', { x: x + 21, y: 87, 'text-anchor': 'middle', fill: '#344b47', 'font-size': 16 }, date.slice(8)));
    attachTooltip(group, tip);
    group.addEventListener('click', () => onPick(date));
    group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPick(date); } });
    svg.append(group);
  });
  return svg;
}

export function bars(items, id, title, onPick) {
  const colors = ['#17685f', '#6d8d70', '#9b6500'];
  const svg = svgEl('svg', { viewBox: `0 0 360 ${Math.max(120, items.length * 44 + 16)}`, role: 'group', 'aria-label': title, 'data-chart': id });
  const max = Math.max(...items.map(item => Number(item.value) || 0), 1);
  items.forEach((item, index) => {
    const y = 8 + index * 44, width = item.value == null ? 0 : Math.max(12, item.value / max * 210);
    label(svg, 92, y + 22, item.label);
    const tip = `${item.date || ''}${item.date ? ' · ' : ''}${item.label} · ${item.value} ${item.unit || '次'}（${item.source || '示例汇总'}）`;
    if (item.value == null) {
      const missingTip = `${item.date || ''}${item.date ? ' · ' : ''}${item.label} · 未知 ${item.unit || ''}（数据不足）`;
      const missing = attachTooltip(svgEl('text', { x: 110, y: y + 22, fill: '#344b47', 'font-size': 16, tabindex: 0, role: 'img' }, '未知'), missingTip);
      svg.append(missing);
      return;
    }
    const group = svgEl('g', { tabindex: 0, role: onPick ? 'button' : 'img', 'aria-label': tip, 'data-tooltip': tip });
    group.append(svgEl('rect', { x: 104, y: y + 3, width: Math.max(width, 32), height: 32, rx: 5, fill: colors[index % colors.length] }));
    group.append(svgEl('text', { x: 116 + width, y: y + 24, fill: '#182b2c', 'font-size': 16 }, String(item.value)));
    attachTooltip(group, tip);
    if (onPick) { group.addEventListener('click', () => onPick(item.label)); group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPick(item.label); } }); }
    svg.append(group);
  });
  return svg;
}

export function timeline(entries, date) {
  const svg = svgEl('svg', { viewBox: '0 0 360 110', role: 'group', 'aria-label': `${date} 进食时间轴`, 'data-chart': 'eating-timeline' });
  svg.append(svgEl('line', { x1: 24, y1: 35, x2: 336, y2: 35, stroke: '#b8c9c5', 'stroke-width': 3 }));
  const points = entries.map(entry => ({ ...entry, minutes: Number(entry.local_time.slice(0, 2)) * 60 + Number(entry.local_time.slice(3)) }));
  const low = Math.min(...points.map(point => point.minutes), 0), high = Math.max(...points.map(point => point.minutes), 24 * 60);
  points.forEach((point, index) => {
    const x = points.length < 2 ? 180 : 24 + (point.minutes - low) / (high - low || 1) * 312;
    const detail = `${date} · ${point.local_time} ${point.label} · ${point.kcal ?? '未知'} kcal（餐食汇总）`;
    const hit = attachTooltip(svgEl('rect', { x: x - 16, y: 19, width: 32, height: 32, fill: 'transparent', tabindex: 0, role: 'img', 'aria-label': detail }), detail);
    svg.append(hit, svgEl('circle', { cx: x, cy: 35, r: 6, fill: '#17685f', stroke: '#fff', 'stroke-width': 3 }), svgEl('text', { x, y: 68, 'text-anchor': 'middle', fill: '#182b2c', 'font-size': 16 }, point.local_time), svgEl('text', { x, y: 86, 'text-anchor': 'middle', fill: '#344b47', 'font-size': 16 }, point.label));
  });
  return svg;
}

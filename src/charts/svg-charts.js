const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, content = '') => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) if (value != null) node.setAttribute(key, value);
  if (content) node.textContent = content;
  return node;
};
const widthOf = width => Math.max(280, Math.round(width || 360));
const label = (svg, x, y, text, anchor = 'end') => svg.append(svgEl('text', { x, y, 'text-anchor': anchor, fill: '#344b47', 'font-size': 12 }, text));
const attachTooltip = (node, text) => {
  node.dataset.tooltip = text;
  node.addEventListener('pointerenter', event => showTooltip(node, event.clientX, event.clientY));
  node.addEventListener('mouseenter', event => showTooltip(node, event.clientX, event.clientY));
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
export function initChartTooltip() {
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hideTooltip(); });
  document.addEventListener('scroll', hideTooltip, { passive: true, capture: true });
}
function makeSvg(id, title, width, height) {
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-label': title, 'data-chart': id, preserveAspectRatio: 'none' });
  svg.style.width = `${width}px`;
  return svg;
}
function niceMax(value) { return Math.max(1, Math.ceil(value / (10 ** Math.floor(Math.log10(Math.max(value, 1))))) * (10 ** Math.floor(Math.log10(Math.max(value, 1))))); }

export function lineChart(values, dates, title, unit, id = 'trend', color = '#17685f', sources = [], measuredWidth = 360) {
  const width = widthOf(measuredWidth), height = 220, left = 42, right = width - 12, top = 18, bottom = 184;
  const svg = makeSvg(id, title, width, height);
  const multi = Array.isArray(values[0]);
  const series = multi ? values : [values];
  const colors = Array.isArray(color) ? color : [color];
  const sourceSets = multi && Array.isArray(sources[0]) ? sources : series.map(() => sources);
  const present = series.flat().filter(value => typeof value === 'number' && Number.isFinite(value));
  if (!present.length) { label(svg, width / 2, 110, '暂无足够数据', 'middle'); return svg; }
  const high = niceMax(Math.max(...present) * 1.08), low = Math.max(0, Math.floor(Math.min(...present) * .9 / 10) * 10);
  const xAt = index => dates.length < 2 ? (left + right) / 2 : left + index * (right - left) / (dates.length - 1);
  const yAt = value => bottom - (value - low) / (high - low || 1) * (bottom - top);
  for (let tick = 0; tick <= 3; tick++) {
    const value = Math.round(low + (high - low) * tick / 3), y = yAt(value);
    svg.append(svgEl('line', { x1: left, y1: y, x2: right, y2: y, stroke: '#dce5e2', 'stroke-width': 1 }));
    label(svg, left - 6, y + 4, String(value));
  }
  series.forEach((entries, seriesIndex) => {
    let segment = [];
    const flush = () => { if (segment.length > 1) svg.append(svgEl('path', { d: segment.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '), fill: 'none', stroke: colors[seriesIndex % colors.length], 'stroke-width': 2, 'stroke-dasharray': multi && seriesIndex ? '6 4' : null, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })); segment = []; };
    entries.forEach((value, index) => {
      const x = xAt(index);
      if (typeof value !== 'number' || !Number.isFinite(value)) { flush(); if (!multi) { const missing = attachTooltip(svgEl('text', { x, y: 62, 'text-anchor': 'middle', fill: '#344b47', 'font-size': 12, tabindex: 0, role: 'img' }, '未知'), `${dates[index]}，未知 ${unit}（数据不足）`); svg.append(missing); } return; }
      const y = yAt(value); segment.push({ x, y });
      const detail = `${dates[index]}，${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value)} ${unit}${multi ? (seriesIndex ? ' 总消耗' : ' 摄入') : ''}（${sourceSets[seriesIndex]?.[index] || '记录汇总'}）`;
      const hitWidth = Math.max(44, Math.min(72, (right - left) / Math.max(1, dates.length - 1)));
      const hit = attachTooltip(svgEl('rect', { x: x - hitWidth / 2, y: multi ? Math.max(0, y - 22) : 0, width: hitWidth, height: multi ? 44 : height, fill: 'transparent', tabindex: 0, role: 'img', 'aria-label': detail, 'data-chart-hit': 'true' }), detail);
      svg.append(hit, svgEl('circle', { cx: x, cy: y, r: 3, fill: '#fff', stroke: colors[seriesIndex % colors.length], 'stroke-width': 2 }));
    });
    flush();
  });
  dates.forEach((date, index) => label(svg, xAt(index), 207, date.slice(5), 'middle'));
  return svg;
}

export function heatmap(workouts, dates, onPick, selectedDate = null, measuredWidth = 360) {
  const width = widthOf(measuredWidth), height = 104, svg = makeSvg('training-heatmap', '最近训练热力图', width, height);
  const cellWidth = (width - 16) / dates.length;
  dates.forEach((date, index) => {
    const entries = workouts.filter(workout => workout.local_date === date), count = entries.length;
    const duration = entries.reduce((sum, item) => sum + (item.duration_min || 0), 0);
    const level = duration === 0 ? 0 : duration < 30 ? 1 : duration < 60 ? 2 : duration < 100 ? 3 : 4;
    const colors = ['#e6eeeb', '#cfdfd8', '#a4c3b4', '#6d9b83', '#155a52'];
    const x = 8 + index * cellWidth, center = x + cellWidth / 2;
    const tip = `${date}，${count} 次训练，${duration} 分钟（记录汇总）`;
    const group = svgEl('g', { tabindex: 0, role: 'button', 'aria-label': tip, 'aria-pressed': selectedDate === date, 'data-tooltip': tip, 'data-chart-hit': 'true' });
    group.append(svgEl('rect', { x: center - Math.max(22, cellWidth * .38), y: 5, width: Math.min(54, Math.max(44, cellWidth * .76)), height: 60, rx: 6, fill: colors[level], stroke: selectedDate === date ? '#18312f' : '#fff', 'stroke-width': selectedDate === date ? 2 : 1 }));
    group.append(svgEl('text', { x: center, y: 41, 'text-anchor': 'middle', fill: level > 2 ? '#fff' : '#182b2c', 'font-size': 12 }, String(count)));
    group.append(svgEl('text', { x: center, y: 88, 'text-anchor': 'middle', fill: '#344b47', 'font-size': 12 }, date.slice(8)));
    attachTooltip(group, tip);
    group.addEventListener('click', () => onPick(date));
    group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPick(date); } });
    svg.append(group);
  });
  return svg;
}

export function bars(items, id, title, onPick, measuredWidth = 360, colors = ['#155a52']) {
  const width = widthOf(measuredWidth), height = Math.max(120, items.length * 48 + 12), svg = makeSvg(id, title, width, height);
  const left = Math.min(112, Math.max(86, width * .28)), right = width - 42;
  const max = Math.max(...items.map(item => Number(item.value) || 0), 1);
  items.forEach((item, index) => {
    const y = 8 + index * 48, barWidth = item.value == null ? 0 : Math.max(8, (item.value / max) * (right - left));
    label(svg, left - 10, y + 25, item.label);
    const tip = `${item.date || ''}${item.date ? '，' : ''}${item.label}，${item.value} ${item.unit || '次'}（${item.source || '示例汇总'}）`;
    const hit = svgEl('rect', { x: 0, y, width, height: 44, fill: 'transparent', tabindex: 0, role: onPick ? 'button' : 'img', 'aria-label': tip, 'data-chart-hit': 'true' });
    attachTooltip(hit, tip);
    if (item.value != null) {
      svg.append(svgEl('rect', { x: left, y: y + 7, width: barWidth, height: 28, rx: 5, fill: colors[index % colors.length] }));
      svg.append(hit);
      label(svg, Math.min(width - 4, left + barWidth + 8), y + 26, String(item.value), 'start');
    } else {
      svg.append(hit); label(svg, left, y + 25, '未知', 'start');
    }
    if (onPick) { hit.addEventListener('click', () => onPick(item.label)); hit.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPick(item.label); } }); }
  });
  return svg;
}

export function timeline(entries, date, measuredWidth = 360) {
  const width = widthOf(measuredWidth), svg = makeSvg('eating-timeline', `${date} 进食时间轴`, width, 130), left = 24, right = width - 24;
  svg.append(svgEl('line', { x1: left, y1: 48, x2: right, y2: 48, stroke: '#b8c9c5', 'stroke-width': 2 }));
  const points = entries.map(entry => ({ ...entry, minutes: Number(entry.local_time.slice(0, 2)) * 60 + Number(entry.local_time.slice(3)) }));
  points.forEach((point, index) => {
    const x = points.length < 2 ? (left + right) / 2 : left + point.minutes / 1440 * (right - left);
    const detail = `${date}，${point.local_time} ${point.label}，${point.kcal ?? '未知'} kcal（餐食汇总）`;
    const hit = attachTooltip(svgEl('rect', { x: x - 22, y: 0, width: 44, height: 110, fill: 'transparent', tabindex: 0, role: 'img', 'aria-label': detail, 'data-chart-hit': 'true' }), detail);
    svg.append(hit, svgEl('circle', { cx: x, cy: 48, r: 3, fill: '#17685f', stroke: '#fff', 'stroke-width': 2 }), svgEl('text', { x, y: 78, 'text-anchor': 'middle', fill: '#182b2c', 'font-size': 12 }, point.local_time), svgEl('text', { x, y: 96, 'text-anchor': 'middle', fill: '#344b47', 'font-size': 12 }, point.label));
  });
  return svg;
}

import { days, goals, nutrientMeta, workouts as sampleWorkouts, syncRecords, incomingHealth, incomingWorkouts, bodyLog } from './data/sample-data.js';
import { reconcileAppleHealth } from './domain/reconcile.js';
import { summarizeNutrients, summarizeFoodEntries, rollingDays, latestWeight, formatDuration } from './domain/selectors.js';
import { lineChart, heatmap, bars, timeline, initChartTooltip } from './charts/svg-charts.js';

const $ = selector => document.querySelector(selector);
const number = value => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value);
const dates = days.map(day => day.date);
const dateSelect = $('[data-control="date-switch"]');
let selectedDate = dates.at(-1);
let workoutDate = null;
let workoutType = null;
const sourceLabels = { confirmed: '实际确认', label: '包装标签', database: '数据库估算', photo: '照片估算', unknown: '未知' };
const operationLabels = { CREATE: '新增', UPDATE: '更新', SKIP_DUPLICATE: '跳过重复项', CONFLICT: '冲突待处理', FAILED: '失败', READ_CHECK: '读取核对' };
const incomingSyncTime = '2026-11-26T20:00:00+04:00';
const burnResult = reconcileAppleHealth(syncRecords, incomingHealth, { now: incomingSyncTime, syncDate: '2026-11-26' });
const trainingResult = reconcileAppleHealth(sampleWorkouts, incomingWorkouts, { now: incomingSyncTime, syncDate: '2026-11-26' });
const audit = [...burnResult.audit, ...trainingResult.audit];
const workouts = trainingResult.records;
const resolvedBurn = burnResult.records;

function dailySummary(day) { return summarizeFoodEntries(day.foodEntries); }
function selectedDay() { return days.find(day => day.date === selectedDate); }
function setMetric(name, value) { const node = $(`[data-metric="${name}"]`); if (node) node.textContent = value; }
function displayValue(value, unit = '') { return typeof value === 'number' && Number.isFinite(value) ? `${number(value)}${unit ? ` ${unit}` : ''}` : '未知'; }
function setDateText() {
  const formatted = new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${selectedDate}T12:00:00Z`));
  $('[data-date-title]').textContent = formatted;
  $('[data-dynamic-title]').textContent = `${formatted}的身体状态`;
  $('[data-meal-title]').textContent = `${selectedDate} 三餐`;
  $('[data-nutrient-title]').textContent = `${selectedDate} 摄入概览`;
  document.title = `健康工作室 · ${selectedDate}`;
}
function showRange(dayWindow) { return dayWindow.length < 7 ? `最近 ${dayWindow.length} 天` : '最近 7 天'; }
function render() {
  const day = selectedDay();
  const summary = dailySummary(day);
  const index = dates.indexOf(selectedDate);
  const windowDays = rollingDays(days, selectedDate);
  const weights = windowDays.map(item => item.weight).filter(value => Number.isFinite(value));
  const recentWeight = latestWeight(bodyLog, selectedDate);
  const burn = resolvedBurn.find(record => record.local_date === selectedDate)?.value ?? day.burn;
  const energyGap = summary.kcal == null || burn == null ? null : burn - summary.kcal;
  setDateText();
  setMetric('intake-kcal', displayValue(summary.kcal));
  $('[data-metric-note="intake-kcal"]').textContent = summary.caloriesRange ? `区间中值；范围 ${number(summary.caloriesRange.min)}–${number(summary.caloriesRange.max)} kcal` : 'Calories Min/Max 不足，按营养素合计';
  setMetric('burn-kcal', displayValue(burn));
  setMetric('deficit-kcal', displayValue(energyGap));
  setMetric('protein-g', displayValue(summary.protein));
  $('[data-metric-note="protein-g"]').textContent = summary.proteinRange ? `区间中值；范围 ${number(summary.proteinRange.min)}–${number(summary.proteinRange.max)} g` : 'Protein Min/Max 不足，按营养素合计';
  setMetric('eating-first', summary.first || '未知');
  setMetric('eating-last', summary.last || '未知');
  setMetric('eating-duration', formatDuration(summary.durationMinutes));
  setMetric('week-workouts', workouts.filter(workout => windowDays.some(item => item.date === workout.local_date)).length);
  setMetric('latest-weight', recentWeight ? `${recentWeight.value.toFixed(1)} kg · ${recentWeight.local_date}` : '未知');
  setMetric('weight-avg7', weights.length ? `${(weights.reduce((sum, value) => sum + value, 0) / weights.length).toFixed(1)} kg · ${weights.length}/7 天` : '未知');
  $('[data-range-label]').textContent = showRange(windowDays);
  $('#overview-chart').replaceChildren(lineChart(windowDays.map(item => dailySummary(item).kcal), windowDays.map(item => item.date), '热量趋势', 'kcal', 'overview-kcal', '#17685f', windowDays.map(() => '食物记录汇总')));
  $('#heatmap').replaceChildren(heatmap(workouts, windowDays.map(item => item.date), date => { workoutDate = date; workoutType = null; drawWorkouts(); }, selectedDate));
  const trainingCounts = ['力量训练','快走','骑行'].map(label => ({ label, value: workouts.filter(workout => workout.workout_type === label).length, unit: '次', source: '训练记录', date: `${windowDays[0].date}–${selectedDate}` }));
  $('#distribution').replaceChildren(bars(trainingCounts, 'training-distribution', '训练类型分布', label => { workoutType = workoutType === label ? null : label; workoutDate = null; drawWorkouts(); }));
  drawWorkouts();
  $('#meal-total').textContent = displayValue(summary.kcal, 'kcal');
  $('#meal-bars').replaceChildren(bars(summary.meals.map(meal => ({ label: meal.label, value: meal.kcal, unit: 'kcal', source: '食物项汇总', date: selectedDate })), 'meal-distribution', '当日三餐热量'));
  $('#timeline-window').textContent = `${summary.first || '未知'} — ${summary.last || '未知'} · ${formatDuration(summary.durationMinutes)}`;
  $('#timeline').replaceChildren(timeline(summary.meals, selectedDate));
  $('#kcal-chart').replaceChildren(lineChart(windowDays.map(item => dailySummary(item).kcal), windowDays.map(item => item.date), '热量趋势', 'kcal', 'kcal-trend', '#17685f', windowDays.map(() => '食物记录汇总')));
  $('#protein-chart').replaceChildren(lineChart(windowDays.map(item => dailySummary(item).protein), windowDays.map(item => item.date), '蛋白质趋势', 'g', 'protein-trend', '#527b43', windowDays.map(() => '食物记录汇总')));
  renderNutrients(windowDays);
  renderSync();
}
function drawWorkouts() {
  const list = workouts.filter(workout => (!workoutDate || workout.local_date === workoutDate) && (!workoutType || workout.workout_type === workoutType)).sort((a,b) => b.local_date.localeCompare(a.local_date));
  $('#workout-filter-label').textContent = `${workoutDate || '最近训练'}${workoutType ? ` · ${workoutType}` : ''} · 显示时长与活动热量`;
  $('#workout-list').innerHTML = list.length ? list.map(workout => `<div class="workout-row"><time>${workout.local_date}</time><strong>${workout.workout_type}</strong><span>${workout.duration_min ?? '未知'} 分钟</span><span>${displayValue(workout.activity_kcal, 'kcal')}</span><em class="tag ${workout.data_source}">${workout.data_source === 'apple_health' ? 'Apple Health 实测' : workout.data_source === 'manual' ? '手动记录' : '估算'}</em></div>`).join('') : '<p class="empty">所选日期没有训练记录</p>';
}
function coverageText(summary) { return summary.known === summary.total && summary.total > 0 ? `覆盖 ${summary.known}/${summary.total}` : `数据不足 · 覆盖 ${summary.known}/${summary.total}`; }
function targetText(meta, summary, target) {
  if (!target || summary.value == null || summary.unitMismatch || summary.known !== summary.total || !summary.total) return `数据不足 · 覆盖 ${summary.known}/${summary.total}`;
  const percent = Math.round(summary.value / target * 100);
  const ceiling = ['sugar','sodium','sat_fat','cholesterol'].includes(meta.key);
  if (ceiling) return `上限 ${target} ${meta.unit} · 已知摄入`;
  return `${ceiling ? '上限' : '示例目标'} ${target} ${meta.unit} · ${percent}%`;
}
function renderNutrients(windowDays) {
  const select = $('#nutrient-select');
  if (!select.options.length) nutrientMeta.forEach(meta => { const option = document.createElement('option'); option.value = meta.key; option.textContent = meta.label; select.append(option); });
  const meta = nutrientMeta.find(item => item.key === select.value) || nutrientMeta[1];
  $('[data-target-mode]').textContent = ['sugar','sodium','sat_fat','cholesterol'].includes(meta.key) ? '上限' : '示例目标';
  const summary = summarizeFoodEntries(selectedDay().foodEntries).nutrients[meta.key] || summarizeNutrients([], meta.key);
  const target = goals[meta.key];
  $('#coverage-summary').textContent = coverageText(summary);
  $('#nutrient-focus').replaceChildren();
  const focus = document.createElement('div'); focus.className = 'focus-value';
  const strong = document.createElement('strong'); strong.textContent = displayValue(summary.value, meta.unit);
  const caption = document.createElement('span'); caption.textContent = `${meta.label} · ${selectedDate} 合计`;
  focus.append(strong, caption); $('#nutrient-focus').append(focus);
  if (summary.known === summary.total && summary.total > 0 && target) {
    const progress = document.createElement('div'); progress.className = 'progress-track';
    const fill = document.createElement('i'); fill.style.width = `${Math.min(100, summary.value / target * 100)}%`; progress.append(fill); $('#nutrient-focus').append(progress);
  }
  const foot = document.createElement('small'); foot.textContent = targetText(meta, summary, target); $('#nutrient-focus').append(foot);
  const trend = windowDays.map(day => summarizeFoodEntries(day.foodEntries).nutrients[meta.key]?.value ?? null);
  const sources = windowDays.map(day => { const stat = summarizeFoodEntries(day.foodEntries).nutrients[meta.key]; return `覆盖 ${stat?.known ?? 0}/${stat?.total ?? 0}`; });
  $('#nutrient-chart').replaceChildren(lineChart(trend, windowDays.map(day => day.date), `${meta.label}趋势`, meta.unit, 'nutrient-trend', '#527b43', sources));
  const nutrientRows = nutrientMeta.map(item => {
    const stat = summarizeFoodEntries(selectedDay().foodEntries).nutrients[item.key] || summarizeNutrients([], item.key);
    const targetValue = goals[item.key];
    const complete = stat.value != null && !stat.unitMismatch && stat.known === stat.total && stat.total > 0 && targetValue;
    const isCeiling = ['sugar','sodium','sat_fat','cholesterol'].includes(item.key);
    const row = document.createElement('tr');
    for (const value of [item.label, displayValue(stat.value, item.unit), targetValue ? `${isCeiling ? '上限' : '示例目标'} ${targetValue} ${item.unit}` : '—']) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    const progressCell = document.createElement('td');
    if (!complete) progressCell.textContent = `数据不足 · 覆盖 ${stat.known}/${stat.total}`;
    else if (isCeiling) progressCell.textContent = '已知摄入';
    else {
      const track = document.createElement('span');
      track.className = 'progress-mini';
      const fill = document.createElement('i');
      fill.style.width = `${Math.min(100, stat.value / targetValue * 100)}%`;
      track.append(fill);
      progressCell.append(track, document.createTextNode(`${Math.round(stat.value / targetValue * 100)}%`));
    }
    row.append(progressCell);
    return row;
  });
  $('#nutrient-rows').replaceChildren(...nutrientRows);
  const groups = selectedDay().foodEntries.map(entry => `<section class="food-meal"><h4>${entry.meal_label} · ${entry.local_time}</h4>${entry.foodItems.map(food => `<article class="food-row"><strong>${food.name} <small>${food.amount}</small></strong><div>${nutrientMeta.map(item => { const nutrient = food.nutrients[item.key]; return `<span>${item.label}: ${displayValue(nutrient?.value, item.unit)} <em class="source-chip">${sourceLabels[nutrient?.source] || '未知'}</em></span>`; }).join('')}</div></article>`).join('')}</section>`).join('');
  $('#food-details').innerHTML = groups || '<p class="empty">所选日期没有食物记录</p>';
}
function statusFor(record) {
  if (record.data_source === 'apple_health') return record.sync_state === 'delayed_synced' ? '延迟同步已补录' : record.sync_state === 'over_estimate' ? '已覆盖估算' : '已同步';
  return record.data_source === 'manual' || record.data_source === 'estimated' ? '未同步' : '冲突待处理';
}
function recordValue(record) { return record.record_type === 'workout' ? `${record.duration_min ?? '未知'} 分钟 · ${displayValue(record.activity_kcal, 'kcal')}` : displayValue(record.value, record.unit); }
function renderSync() {
  const records = [...resolvedBurn, ...workouts];
  const counts = [
    ['未同步','仍等待 Apple Health 对应记录',records.filter(record => statusFor(record) === '未同步').length],
    ['延迟同步已补录','按记录日期与同步日期计算',records.filter(record => statusFor(record) === '延迟同步已补录').length],
    ['已覆盖估算','实测更新了估算记录',records.filter(record => statusFor(record) === '已覆盖估算').length],
    ['冲突待处理','保留原值，等待人工核对',audit.filter(event => event.operation === 'CONFLICT').length]
  ];
  $('#sync-statuses').innerHTML = counts.map(([name, desc, count]) => `<article class="status-item"><span>${name}</span><strong>${count}</strong><small>${desc}</small></article>`).join('');
  const syncTimes = audit.map(event => event.synced_at).filter(Boolean).sort();
  $('#last-sync').textContent = syncTimes.length ? syncTimes.at(-1).slice(0, 16).replace('T', ' ') : '尚未同步';
  $('#source-records').innerHTML = records.map(record => {
    const related = audit.find(event => event.record_id === record.id && event.operation === 'CONFLICT');
    const details = related ? `现值 ${recordValue(record)}；实测 ${recordValue(related.incoming_value)}` : recordValue(record);
    return `<tr><td>${record.local_date}</td><td>${record.record_type === 'workout' ? `训练 · ${record.workout_type}` : '消耗 · 总消耗'}</td><td>${details}</td><td>${record.data_source === 'apple_health' ? 'Apple Health 实测' : record.data_source === 'manual' ? '手动记录' : '估算'}</td><td>${related ? '冲突待处理' : statusFor(record)}</td><td>${record.verified_at || related?.synced_at || '—'}</td></tr>`;
  }).join('');
  $('#audit-list').innerHTML = audit.map(event => `<div class="audit-row"><time>${event.local_date || '未知日期'} · ${event.synced_at.slice(11,16)}</time><strong class="operation ${event.operation}">${event.operation} · ${operationLabels[event.operation] || '处理'}</strong><span>${event.details}</span><small>${event.record_id || '未匹配'} · ${event.source === 'apple_health' ? 'Apple Health 实测' : event.source}</small></div>`).join('');
}

dates.forEach(date => { const option = document.createElement('option'); option.value = date; option.textContent = date; dateSelect.append(option); });
dateSelect.value = selectedDate;
dateSelect.addEventListener('change', () => { selectedDate = dateSelect.value; render(); });
$('#nutrient-select').addEventListener('change', render);
$('#clear-filter').addEventListener('click', () => { workoutDate = null; workoutType = null; drawWorkouts(); });
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { workoutType = workoutType === button.dataset.filter ? null : button.dataset.filter; workoutDate = null; drawWorkouts(); }));
initChartTooltip();
render();

const navLinks = [...document.querySelectorAll('.sidebar nav a')];
const observer = new IntersectionObserver(entries => {
  const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  navLinks.forEach(link => { const active = link.hash === `#${visible.target.id}`; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
}, { rootMargin: '-20% 0px -65% 0px', threshold: [0, .2, .5] });
document.querySelectorAll('[data-module]').forEach(section => observer.observe(section));

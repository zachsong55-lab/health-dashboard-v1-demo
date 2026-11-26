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
const displayValue = (value, unit = '') => typeof value === 'number' && Number.isFinite(value) ? `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: unit === 'kcal' ? 0 : 1 }).format(value)}${unit ? ` ${unit}` : ''}` : '未知';
const summaryFor = day => summarizeFoodEntries(day.foodEntries);
const selectedDay = () => days.find(day => day.date === selectedDate);
const setMetric = (name, value) => { const node = $(`[data-metric="${name}"]`); if (node) node.textContent = value; };

function setDateText() {
  const formatted = new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${selectedDate}T12:00:00Z`));
  $('[data-dynamic-title]').textContent = `${formatted}的身体状态`;
  $('[data-meal-title]').textContent = '三餐摄入';
  $('[data-nutrient-title]').textContent = `摄入趋势`;
  document.title = `健康工作室，${selectedDate}`;
}

function rangeLabel(windowDays) { return `最近 ${windowDays.length} 天`; }
function render() {
  const day = selectedDay();
  const summary = summaryFor(day);
  const windowDays = rollingDays(days, selectedDate);
  const weights = windowDays.map(item => item.weight).filter(Number.isFinite);
  const recentWeight = latestWeight(bodyLog, selectedDate);
  const burn = resolvedBurn.find(record => record.local_date === selectedDate)?.value ?? day.burn;
  const gap = summary.kcal == null || burn == null ? null : burn - summary.kcal;
  setDateText();
  setMetric('intake-kcal', displayValue(summary.kcal));
  $('[data-metric-note="intake-kcal"]').textContent = summary.caloriesRange ? `范围 ${displayValue(summary.caloriesRange.min)}–${displayValue(summary.caloriesRange.max)}` : '食物项汇总';
  setMetric('burn-kcal', displayValue(burn));
  setMetric('deficit-kcal', displayValue(gap));
  setMetric('protein-g', displayValue(summary.protein));
  $('[data-metric-note="protein-g"]').textContent = summary.proteinRange ? `范围 ${number(summary.proteinRange.min)}–${number(summary.proteinRange.max)} g` : '营养素合计';
  setMetric('eating-first', summary.first || '未知');
  setMetric('eating-last', summary.last || '未知');
  setMetric('eating-duration', formatDuration(summary.durationMinutes));
  setMetric('week-workouts', workouts.filter(workout => windowDays.some(item => item.date === workout.local_date)).length);
  setMetric('latest-weight', recentWeight ? `${recentWeight.value.toFixed(1)} kg，${recentWeight.local_date}` : '未知');
  setMetric('weight-avg7', weights.length ? `${(weights.reduce((sum, value) => sum + value, 0) / weights.length).toFixed(1)} kg，${weights.length}/7 天` : '未知');
  document.querySelectorAll('[data-range-label]').forEach(node => { node.textContent = rangeLabel(windowDays); });

  const intakeSeries = windowDays.map(item => summaryFor(item).kcal);
  const burnSeries = windowDays.map(item => resolvedBurn.find(record => record.local_date === item.date)?.value ?? item.burn);
  const chartWidth = selector => $(selector).clientWidth;
  $('#overview-chart').replaceChildren(lineChart([intakeSeries, burnSeries], windowDays.map(item => item.date), '每日摄入与总消耗热量趋势', 'kcal', 'kcal-overview', ['#ffffff', '#bdd5d2'], [windowDays.map(() => '食物记录汇总'), windowDays.map(() => '健康记录')], chartWidth('#overview-chart')));
  drawHeatmap(windowDays);
  const trainingCounts = ['力量训练', '快走', '骑行'].map(label => ({ label, value: workouts.filter(workout => workout.workout_type === label).length, unit: '次', source: '训练记录', date: `${windowDays[0].date}–${selectedDate}` }));
  $('#distribution').replaceChildren(bars(trainingCounts, 'training-distribution', '训练类型分布', label => {
    workoutType = workoutType === label ? null : label;
    workoutDate = null;
    updateFilterButtons();
    drawWorkouts();
    drawHeatmap(windowDays);
  }, chartWidth('#distribution'), ['#155a52', '#547a68', '#755f91']));
  const trainingMinutes = windowDays.map(item => workouts.filter(workout => workout.local_date === item.date).reduce((sum, workout) => sum + (workout.duration_min || 0), 0));
  const trainingKcal = windowDays.map(item => workouts.filter(workout => workout.local_date === item.date).reduce((sum, workout) => sum + (workout.activity_kcal || 0), 0));
  const trendRoot = $('#training-trends'); trendRoot.replaceChildren();
  [
    ['训练时长', '分钟', 'training-time-trend', trainingMinutes, '#155a52'],
    ['活动热量', 'kcal', 'training-kcal-trend', trainingKcal, '#755f91']
  ].forEach(([heading, unit, id, values, color]) => {
    const card = document.createElement('article'); card.className = 'trend-chart-card';
    const title = document.createElement('h4'); title.textContent = `${heading}（${unit}）`; card.append(title);
    trendRoot.append(card);
    card.append(lineChart(values, windowDays.map(item => item.date), `每日${heading}趋势，${unit}`, unit, id, color, windowDays.map(() => '训练记录'), card.clientWidth));
  });
  drawWorkouts();
  $('#meal-total').textContent = displayValue(summary.kcal, 'kcal');
  const mealChart = bars(summary.meals.map(meal => ({ label: meal.label, value: meal.kcal, unit: 'kcal', source: '食物项汇总', date: selectedDate })), 'meal-distribution', '当日三餐热量', null, chartWidth('#meal-bars'), ['#155a52']);
  const macroLegend = document.createElement('div'); macroLegend.className = 'macro-legend';
  [['蛋白', 'var(--protein)'], ['碳水', 'var(--carb)'], ['脂肪', 'var(--fat)']].forEach(([label, color]) => {
    const item = document.createElement('span'); const swatch = document.createElement('i');
    swatch.style.backgroundColor = color; item.append(swatch, document.createTextNode(label)); macroLegend.append(item);
  });
  const mealRows = summary.meals.map(meal => {
    const row = document.createElement('div'); row.className = 'meal-share';
    const label = document.createElement('span'); label.textContent = meal.label;
    const amount = document.createElement('strong'); amount.textContent = displayValue(meal.kcal, 'kcal');
    const share = document.createElement('small'); share.textContent = summary.kcal ? `${Math.round(meal.kcal / summary.kcal * 100)}%` : '未知';
    const macroTrack = document.createElement('span'); macroTrack.className = 'meal-macros';
    const macros = [['protein', '蛋白质', '#695384'], ['carbs', '碳水', '#8a5a18'], ['fat', '脂肪', '#9a4f44']];
    const macroValues = macros.map(([key]) => summarizeNutrients(meal.items || [], key).value || 0);
    const macroTotal = macroValues.reduce((sum, value) => sum + value, 0);
    macros.forEach(([key, name, color], index) => { const segment = document.createElement('i'); segment.style.width = macroTotal ? `${macroValues[index] / macroTotal * 100}%` : '0%'; segment.style.backgroundColor = color; segment.title = `${name} ${number(macroValues[index])} g`; segment.setAttribute('aria-label', segment.title); macroTrack.append(segment); });
    row.append(label, amount, share, macroTrack); return row;
  });
  $('#meal-bars').replaceChildren(mealChart, macroLegend, ...mealRows);
  $('#timeline-window').textContent = `${summary.first || '未知'} 至 ${summary.last || '未知'}，${formatDuration(summary.durationMinutes)}`;
  $('#timeline').replaceChildren(timeline(summary.meals, selectedDate, chartWidth('#timeline')));
  $('#kcal-chart').replaceChildren(lineChart(windowDays.map(item => summaryFor(item).kcal), windowDays.map(item => item.date), '每日摄入热量趋势', 'kcal', 'kcal-trend', '#155a52', windowDays.map(() => '食物记录汇总'), chartWidth('#kcal-chart')));
  $('#protein-chart').replaceChildren(lineChart(windowDays.map(item => summaryFor(item).protein), windowDays.map(item => item.date), '每日蛋白质趋势', 'g', 'protein-trend', '#695384', windowDays.map(() => '食物记录汇总'), chartWidth('#protein-chart')));
  const windowFill = $('.window-track span');
  const firstMinutes = summary.first ? Number(summary.first.slice(0, 2)) * 60 + Number(summary.first.slice(3, 5)) : null;
  const lastMinutes = summary.last ? Number(summary.last.slice(0, 2)) * 60 + Number(summary.last.slice(3, 5)) : null;
  const validWindow = Number.isFinite(firstMinutes) && Number.isFinite(lastMinutes) && lastMinutes >= firstMinutes;
  windowFill.hidden = !validWindow;
  if (validWindow) {
    windowFill.style.left = `${firstMinutes / 1440 * 100}%`;
    windowFill.style.width = `${(lastMinutes - firstMinutes) / 1440 * 100}%`;
  }
  const mealMarks = $('.window-meals'); mealMarks.replaceChildren();
  if (validWindow) selectedDay().foodEntries.forEach((entry, index) => {
    const minute = Number(entry.local_time.slice(0, 2)) * 60 + Number(entry.local_time.slice(3, 5));
    const marker = document.createElement('i'); marker.className = 'window-meal-mark';
    marker.style.left = `${minute / 1440 * 100}%`; marker.title = `${entry.meal_label} ${entry.local_time}`;
    marker.dataset.label = `${entry.meal_label} ${entry.local_time}`;
    marker.style.top = `${21 + (index % 2) * 15}px`;
    marker.setAttribute('aria-label', `${entry.meal_label} ${entry.local_time}`); mealMarks.append(marker);
  });
  renderNutrients(windowDays);
  renderSync();
}

function updateFilterButtons() {
  document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === workoutType)));
}

function drawHeatmap(windowDays = rollingDays(days, selectedDate)) {
  $('#heatmap').replaceChildren(heatmap(workouts, windowDays.map(item => item.date), date => {
    workoutDate = workoutDate === date ? null : date;
    workoutType = null;
    drawWorkouts();
    drawHeatmap(windowDays);
  }, workoutDate, $('#heatmap').clientWidth));
}

function drawWorkouts() {
  const list = workouts.filter(workout => (!workoutDate || workout.local_date === workoutDate) && (!workoutType || workout.workout_type === workoutType)).sort((a, b) => b.local_date.localeCompare(a.local_date));
  $('#workout-filter-label').textContent = `${workoutDate || '最近训练'}${workoutType ? `，${workoutType}` : ''}，显示时长与活动热量`;
  const root = $('#workout-list');
  root.replaceChildren();
  if (!list.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '所选条件没有训练记录'; root.append(empty); }
  list.forEach(workout => {
    const row = document.createElement('article'); row.className = 'workout-row';
    const time = document.createElement('time'); time.textContent = workout.local_date;
    const title = document.createElement('strong'); title.textContent = workout.workout_type;
    const duration = document.createElement('span'); duration.textContent = `${workout.duration_min ?? '未知'} 分钟`;
    const kcal = document.createElement('span'); kcal.textContent = displayValue(workout.activity_kcal, 'kcal');
    const source = document.createElement('em'); source.className = 'tag'; source.textContent = workout.data_source === 'apple_health' ? 'Apple Health 实测' : workout.data_source === 'manual' ? '手动记录' : '估算';
    row.append(time, title, duration, kcal, source); root.append(row);
  });
  updateFilterButtons();
}

function coverageText(summary) { return `覆盖 ${summary.known}/${summary.total}${summary.known !== summary.total ? '，部分未知' : ''}`; }
const ceilingKeys = new Set(['sugar', 'sodium', 'sat_fat', 'cholesterol']);

function renderNutrients(windowDays) {
  const select = $('#nutrient-select');
  if (!select.options.length) nutrientMeta.forEach(meta => { const option = document.createElement('option'); option.value = meta.key; option.textContent = meta.label; select.append(option); });
  const selectedMeta = nutrientMeta.find(item => item.key === select.value) || nutrientMeta[1];
  const current = summaryFor(selectedDay()).nutrients[selectedMeta.key] || summarizeNutrients([], selectedMeta.key);
  $('[data-target-mode]').textContent = ceilingKeys.has(selectedMeta.key) ? '摄入上限' : '示例目标';
  $('#coverage-summary').textContent = coverageText(current);
  const coreKeys = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sat_fat', 'sodium'];
  const core = $('#core-nutrients'); core.className = 'core-grid'; core.replaceChildren();
  coreKeys.forEach(key => {
    const meta = nutrientMeta.find(item => item.key === key);
    const stat = summaryFor(selectedDay()).nutrients[key] || summarizeNutrients([], key);
    const item = document.createElement('div'); item.className = 'core-item'; item.dataset.ring = key;
    const head = document.createElement('div'); head.className = 'core-head';
    const name = document.createElement('strong'); name.textContent = meta.label;
    const coverage = document.createElement('span'); coverage.textContent = `${stat.known}/${stat.total}`;
    head.append(name, coverage);
    const value = document.createElement('div'); value.className = 'core-value'; value.textContent = displayValue(stat.value, meta.unit);
    const bar = document.createElement('span'); bar.className = 'progress-track';
    const fill = document.createElement('i');
    const target = goals[key];
    const complete = stat.value != null && !stat.unitMismatch && stat.known === stat.total && stat.total > 0 && target;
    const ratio = target ? stat.value / target : null;
    const over = complete && ceilingKeys.has(key) && ratio > 1;
    bar.classList.toggle('incomplete', !complete);
    bar.classList.toggle('over-limit', over);
    fill.style.width = complete ? `${Math.min(100, ratio * 100)}%` : '0%'; bar.append(fill);
    const note = document.createElement('small'); note.className = 'core-target';
    note.textContent = !complete ? `数据不全，覆盖 ${stat.known}/${stat.total}` : ceilingKeys.has(key) ? `上限 ${target} ${meta.unit}，占比 ${Math.round(ratio * 100)}%${over ? '，已超限' : ''}` : `示例目标 ${target} ${meta.unit}，${Math.round(ratio * 100)}%`;
    item.dataset.target = String(target ?? ''); item.dataset.targetUnit = meta.unit;
    item.append(head, value, bar, note); core.append(item);
  });
  const trendValues = windowDays.map(day => summaryFor(day).nutrients[selectedMeta.key]?.value ?? null);
  const sources = windowDays.map(day => { const stat = summaryFor(day).nutrients[selectedMeta.key]; return `覆盖 ${stat?.known ?? 0}/${stat?.total ?? 0}`; });
  $('#nutrient-chart').replaceChildren(lineChart(trendValues, windowDays.map(day => day.date), `${selectedMeta.label}趋势`, selectedMeta.unit, 'nutrient-trend', '#155a52', sources, $('#nutrient-chart').clientWidth));
  const rows = $('#nutrient-rows'); rows.replaceChildren();
  nutrientMeta.filter(meta => !coreKeys.includes(meta.key)).forEach(meta => {
    const stat = summaryFor(selectedDay()).nutrients[meta.key] || summarizeNutrients([], meta.key);
    const row = document.createElement('div'); row.className = 'nutrient-detail';
    const name = document.createElement('strong'); name.textContent = meta.label;
    const value = document.createElement('span'); value.textContent = displayValue(stat.value, meta.unit);
    const detail = document.createElement('small'); detail.textContent = `${goals[meta.key] ? `${ceilingKeys.has(meta.key) ? '上限' : '示例目标'} ${goals[meta.key]} ${meta.unit}` : '无目标'}，${coverageText(stat)}`;
    row.append(name, value, detail); rows.append(row);
  });
  const groups = $('#food-details'); groups.replaceChildren();
  if (!selectedDay().foodEntries.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '所选日期没有食物记录'; groups.append(empty); return; }
  selectedDay().foodEntries.forEach(entry => {
    const meal = document.createElement('section'); meal.className = 'food-meal';
    const heading = document.createElement('h4'); heading.textContent = `${entry.meal_label}，${entry.local_time}`; meal.append(heading);
    entry.foodItems.forEach(food => {
      const article = document.createElement('article'); article.className = 'food-row';
      const name = document.createElement('strong'); name.className = 'food-name'; name.textContent = `${food.name} ${food.amount}`;
      const metrics = document.createElement('div'); metrics.className = 'food-main';
      ['kcal', 'protein', 'carbs', 'fat', 'fiber'].forEach(key => { const meta = nutrientMeta.find(item => item.key === key); const nutrient = food.nutrients[key]; const value = document.createElement('span'); value.textContent = `${meta.label} ${displayValue(nutrient?.value, meta.unit)}`; metrics.append(value); });
      const detail = document.createElement('details'); detail.dataset.expand = 'food';
      const summary = document.createElement('summary'); summary.textContent = '营养详情';
      const extra = document.createElement('div'); extra.className = 'food-extra';
      nutrientMeta.filter(meta => !['kcal', 'protein', 'carbs', 'fat', 'fiber'].includes(meta.key)).forEach(meta => { const nutrient = food.nutrients[meta.key]; const value = document.createElement('span'); value.textContent = `${meta.label} ${displayValue(nutrient?.value, meta.unit)}，${sourceLabels[nutrient?.source] || '未知'}`; extra.append(value); });
      const source = document.createElement('span'); source.textContent = `来源：${sourceLabels[food.nutrients.kcal?.source] || '未知'}`; extra.append(source);
      detail.append(summary, extra); article.append(name, metrics, detail); meal.append(article);
    });
    groups.append(meal);
  });
}

function statusFor(record) {
  if (record.data_source === 'apple_health') return { text: record.sync_state === 'delayed_synced' ? '延迟同步' : record.sync_state === 'over_estimate' ? '已同步' : '已同步', icon: '✓', kind: 'ok' };
  if (record.data_source === 'manual') return { text: '手动', icon: '✎', kind: 'manual' };
  if (record.data_source === 'estimated') return { text: '估算', icon: '≈', kind: 'estimate' };
  return { text: '失败', icon: '×', kind: 'failed' };
}
function recordValue(record) { return record.record_type === 'workout' ? `${record.duration_min ?? '未知'} 分钟，${displayValue(record.activity_kcal, 'kcal')}` : displayValue(record.value, record.unit); }
function auditRecordLabel(record) { return record?.record_type === 'workout' ? `训练${record.workout_type ? ` ${record.workout_type}` : ''}` : '消耗总热量'; }
function auditOutcome(event) {
  const record = event.incoming_value || event.current_value || {};
  if (event.operation === 'CONFLICT') return `待核对 · ${auditRecordLabel(record)}`;
  if (event.operation === 'UPDATE') return `已更新 · ${auditRecordLabel(record)} ${recordValue(record)}`;
  if (event.operation === 'CREATE') return `已新增 · ${auditRecordLabel(record)} ${recordValue(record)}`;
  if (event.operation === 'SKIP_DUPLICATE') return `已跳过重复记录 · ${auditRecordLabel(record)} ${recordValue(record)}`;
  if (event.operation === 'FAILED') return `处理失败 · ${auditRecordLabel(record)}`;
  return `已核对 · ${auditRecordLabel(record)} ${recordValue(record)}`;
}

function renderSync() {
  const records = [...resolvedBurn, ...workouts];
  const counts = [
    ['已同步', '同步确认的记录', records.filter(record => record.data_source === 'apple_health').length, '✓', 'ok'],
    ['估算', '来自估算的记录', records.filter(record => record.data_source === 'estimated').length, '≈', 'estimate'],
    ['冲突', '等待人工核对', audit.filter(event => event.operation === 'CONFLICT').length, '!', 'conflict'],
    ['手动', '手动记录', records.filter(record => record.data_source === 'manual').length, '✎', 'manual'],
    ['失败', '未成功处理的记录', audit.filter(event => event.operation === 'FAILED').length, '×', 'failed']
  ];
  const statusRoot = $('#sync-statuses'); statusRoot.replaceChildren();
  counts.forEach(([name, description, count, icon, kind]) => { const card = document.createElement('article'); card.className = `status-item ${kind}`; card.dataset.syncStatus = kind; const label = document.createElement('span'); label.dataset.icon = icon; label.textContent = name; const total = document.createElement('strong'); total.textContent = count; const note = document.createElement('small'); note.textContent = description; card.append(label, total, note); statusRoot.append(card); });
  const syncTimes = audit.map(event => event.synced_at).filter(Boolean).sort();
  $('#last-sync').textContent = syncTimes.length ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit' }).format(new Date(syncTimes.at(-1))) : '尚未同步';
  const list = $('#source-records'); list.replaceChildren();
  records.sort((a, b) => { const aConflict = audit.some(event => event.record_id === a.id && event.operation === 'CONFLICT'); const bConflict = audit.some(event => event.record_id === b.id && event.operation === 'CONFLICT'); return Number(bConflict) - Number(aConflict) || b.local_date.localeCompare(a.local_date); }).forEach(record => {
    const conflict = audit.find(event => event.record_id === record.id && event.operation === 'CONFLICT');
    const status = conflict ? { text: '冲突', icon: '!', kind: 'conflict' } : statusFor(record);
    const row = document.createElement('article'); row.className = `source-record${conflict ? ' conflict' : ''}`; row.dataset.syncStatus = status.kind;
    const date = document.createElement('time'); date.textContent = record.local_date;
    const title = document.createElement('strong'); title.textContent = record.record_type === 'workout' ? `训练，${record.workout_type}` : '消耗，总消耗';
    const value = document.createElement('span'); value.className = 'record-value'; value.textContent = conflict ? `已记录 ${recordValue(conflict.current_value || record)}；Apple Health ${recordValue(conflict.incoming_value)}` : recordValue(record);
    const chip = document.createElement('span'); chip.className = `status-chip ${status.kind}`; chip.textContent = `${status.icon} ${status.text}`;
    const source = document.createElement('small'); source.textContent = record.data_source === 'apple_health' ? 'Apple Health' : record.data_source === 'manual' ? '手动记录' : '估算来源';
    row.append(date, title, value, chip, source); list.append(row);
  });
  const auditRoot = $('#audit-list'); auditRoot.replaceChildren();
  const auditByDate = new Map();
  audit.forEach(event => {
    const key = event.local_date || '未知日期';
    if (!auditByDate.has(key)) auditByDate.set(key, []);
    auditByDate.get(key).push(event);
  });
  [...auditByDate.entries()].sort(([a], [b]) => b.localeCompare(a)).forEach(([date, events]) => {
    const group = document.createElement('section'); group.className = 'audit-day';
    const heading = document.createElement('h4'); heading.textContent = date; group.append(heading);
    events.sort((a, b) => b.synced_at.localeCompare(a.synced_at)).forEach(event => {
      const row = document.createElement('div'); row.className = 'audit-row';
      const time = document.createElement('time'); time.textContent = event.synced_at.slice(11, 16);
      const action = document.createElement('strong'); action.className = 'operation'; action.textContent = `${operationLabels[event.operation] || '已处理'} · ${auditRecordLabel(event.incoming_value || event.current_value)}`;
      const detail = document.createElement('span');
      detail.textContent = event.operation === 'CONFLICT' ? `${auditOutcome(event)}；已记录 ${recordValue(event.current_value || {})}，Apple Health ${recordValue(event.incoming_value || {})}` : auditOutcome(event);
      row.append(time, action, detail); group.append(row);
    });
    auditRoot.append(group);
  });
}

dates.forEach(date => { const option = document.createElement('option'); option.value = date; option.textContent = date; dateSelect.append(option); });
dateSelect.value = selectedDate;
dateSelect.addEventListener('change', () => { selectedDate = dateSelect.value; workoutDate = null; workoutType = null; render(); });
$('#nutrient-select').addEventListener('change', () => {
  const windowDays = rollingDays(days, selectedDate);
  const meta = nutrientMeta.find(item => item.key === $('#nutrient-select').value);
  const values = windowDays.map(day => summaryFor(day).nutrients[meta.key]?.value ?? null);
  const sources = windowDays.map(day => { const stat = summaryFor(day).nutrients[meta.key]; return `覆盖 ${stat?.known ?? 0}/${stat?.total ?? 0}`; });
  $('#nutrient-chart').replaceChildren(lineChart(values, windowDays.map(day => day.date), `${meta.label}趋势`, meta.unit, 'nutrient-trend', '#155a52', sources, $('#nutrient-chart').clientWidth));
  $('[data-nutrient-title]').textContent = `${meta.label}趋势`;
  $('[data-target-mode]').textContent = ceilingKeys.has(meta.key) ? '摄入上限' : '示例目标';
  const current = summaryFor(selectedDay()).nutrients[meta.key];
  $('#coverage-summary').textContent = current ? coverageText(current) : '覆盖 0/0，数据不全';
});
$('#clear-filter').addEventListener('click', () => { workoutDate = null; workoutType = null; drawWorkouts(); drawHeatmap(); });
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  workoutType = workoutType === button.dataset.filter ? null : button.dataset.filter;
  workoutDate = null;
  drawWorkouts();
  drawHeatmap();
}));
initChartTooltip();
render();
const chartHosts = ['#overview-chart', '#heatmap', '#distribution', '#training-trends', '#meal-bars', '#timeline', '#kcal-chart', '#protein-chart', '#nutrient-chart'].map(selector => $(selector));
const chartWidths = new WeakMap();
const chartObserver = new ResizeObserver(entries => {
  const resized = entries.some(entry => { const previous = chartWidths.get(entry.target); const current = Math.round(entry.contentRect.width); chartWidths.set(entry.target, current); return previous != null && previous !== current; });
  if (resized) render();
});
chartHosts.forEach(host => chartObserver.observe(host));

const navLinks = [...document.querySelectorAll('.sidebar nav a, .mobile-nav a')];
const observer = new IntersectionObserver(entries => {
  const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  navLinks.forEach(link => { const active = link.hash === `#${visible.target.id}`; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
}, { rootMargin: '-18% 0px -68% 0px', threshold: [0, .2, .5] });
document.querySelectorAll('[data-module]').forEach(section => observer.observe(section));

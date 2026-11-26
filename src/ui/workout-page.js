import { getDayStatus, buildSeries, meanSeries } from '../domain/day-status.js';
import { estimateMuscleRecovery } from '../domain/recovery.js';
import { getWeeklyCoverage } from '../domain/weekly-coverage.js';
import { MUSCLE_NAMES, EXERCISE_MAP } from '../domain/muscle-map.js';
import { createBodyMap } from './body-map.js';
import { lineChart } from '../charts/svg-charts.js';

const statusLabels = { confirmed_workout: '已确认训练', confirmed_rest: '已确认休息', unrecorded: '尚未记录', ah_pending: 'Apple Health 待同步', estimated: '估算', synced: '已同步' };
const recoveryLabels = { recent: '近期训练', recovering: '恢复过程中', near: '接近恢复窗口', window_passed: '估计恢复窗口已结束', unknown: '恢复状态未知' };
const sources = { user_confirmed: '用户确认', estimated: '估算', apple_health: 'Apple Health' };
const fmt = n => Number.isFinite(n) ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(n) : '未知';
const duration = session => {
  if (!session.start || !session.end) return null;
  const [sh, sm] = session.start.split(':').map(Number), [eh, em] = session.end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
};
const dateLabel = value => value ? `${value.slice(5, 7)}月${value.slice(8)}日` : '本周无记录';
let resizeBound = false;
let refreshBodyMap = () => {};
let selectedMuscle = 'chest';
let activeFilters = { dateFrom: '', dateTo: '', muscle: '', type: '', source: '' };

export function renderWorkoutPage(state) {
  const { selectedDate, sessions, dayLogs, legacyWorkouts } = state;
  const scopedSessions = sessions.filter(session => session.date <= selectedDate);
  const scopedDays = dayLogs.filter(day => day.date <= selectedDate).slice(-14);
  const recovery = estimateMuscleRecovery(scopedSessions, new Date(`${selectedDate}T20:00:00+04:00`));
  renderDayStatus(scopedDays);
  renderActivityHeatmap(scopedDays, scopedSessions);
  renderRecovery(recovery, scopedSessions, selectedDate);
  renderCoverage(scopedSessions, selectedDate, legacyWorkouts);
  if (!document.querySelector('[data-page="workout"]')?.hidden) renderTrends(scopedDays, scopedSessions, legacyWorkouts);
  else document.querySelector('#training-trends').replaceChildren();
}

function renderDayStatus(logs) {
  const root = document.querySelector('#day-status-strip'); root.replaceChildren();
  logs.slice(-14).forEach(log => {
    const result = getDayStatus(log), cell = document.createElement('div');
    cell.className = `day-status status-${result.status}`; cell.dataset.dayStatus = result.status;
    cell.setAttribute('aria-label', `${result.date}，${statusLabels[result.status]}`);
    const mark = document.createElement('span'); mark.className = 'status-mark'; mark.setAttribute('aria-hidden', 'true');
    const date = document.createElement('time'); date.dateTime = result.date; date.textContent = result.date.slice(-2);
    const label = document.createElement('small'); label.textContent = statusLabels[result.status];
    cell.append(mark, date, label); root.append(cell);
  });
  const legend = document.querySelector('#day-status-legend'); legend.replaceChildren();
  Object.entries(statusLabels).forEach(([status, label]) => {
    const item = document.createElement('span'); item.className = `legend-status status-${status}`;
    const mark = document.createElement('i'); mark.className = 'status-mark'; mark.setAttribute('aria-hidden', 'true');
    item.append(mark, document.createTextNode(label)); legend.append(item);
  });
}

function renderActivityHeatmap(logs, sessions) {
  const root = document.querySelector('#activity-heatmap'); root.replaceChildren();
  logs.forEach(log => {
    const status = getDayStatus(log).status;
    const count = sessions.filter(session => session.date === log.date).length;
    const cell = document.createElement('div'); cell.className = `activity-cell status-${status}`;
    cell.dataset.heatmapStatus = status;
    cell.setAttribute('aria-label', `${log.date}，${statusLabels[status]}${count ? `，${count} 次训练记录` : ''}`);
    const value = document.createElement('strong');
    value.textContent = count ? String(count) : ({ confirmed_rest: '休', unrecorded: '—', ah_pending: '待', estimated: '估', synced: '同步' })[status] || '训练';
    const date = document.createElement('time'); date.dateTime = log.date; date.textContent = log.date.slice(5);
    cell.append(value, date); root.append(cell);
  });
}

function renderRecovery(recovery, sessions, selectedDate) {
  const root = document.querySelector('#body-maps');
  const buttons = [...document.querySelectorAll('[data-control="body-view"]')];
  const renderMap = () => {
    const mobileView = document.querySelector('[data-control="body-view"].selected')?.dataset.view || 'front';
    root.replaceChildren();
    ['front', 'back'].filter(view => window.innerWidth >= 1024 || view === mobileView).forEach(view => {
      const panel = document.createElement('div'); panel.className = `body-map-panel view-${view}`;
      const heading = document.createElement('h3'); heading.textContent = view === 'front' ? '正面' : '背面';
      panel.append(heading, createBodyMap(view, recovery, muscle => showMuscle(muscle, recovery, sessions, selectedDate)));
      root.append(panel);
    });
  };
  refreshBodyMap = renderMap;
  buttons.forEach(button => { button.onclick = () => {
    buttons.forEach(item => { const selected = item === button; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); }); renderMap();
  }; });
  if (!resizeBound) { window.addEventListener('resize', () => refreshBodyMap(), { passive: true }); resizeBound = true; }
  renderMap();
  const legend = document.querySelector('#recovery-legend'); legend.replaceChildren();
  Object.entries(recoveryLabels).forEach(([status, label]) => {
    const item = document.createElement('span'); item.className = `recovery-key status-${status}`;
    const swatch = document.createElement('i'); swatch.setAttribute('aria-hidden', 'true'); item.append(swatch, document.createTextNode(label)); legend.append(item);
  });
  showMuscle(selectedMuscle, recovery, sessions, selectedDate);
}

function showMuscle(id, recovery, sessions, selectedDate) {
  selectedMuscle = id;
  const row = recovery.find(item => item.muscleId === id);
  const matched = sessions.flatMap(session => (session.exercises || []).filter(ex => {
    const mapping = EXERCISE_MAP[ex.exerciseId]; return mapping && [...mapping.primary, ...mapping.secondary].includes(id);
  }).map(ex => ({ session, ex }))).sort((a, b) => b.session.date.localeCompare(a.session.date));
  const latestDate = row?.lastDate?.slice(0, 10);
  const recent = matched.filter(item => item.session.date === latestDate);
  const reasonText = row?.reasons?.length ? row.reasons.join('；') : '可用训练资料不足';
  const fields = [
    ['部位', MUSCLE_NAMES[id]], ['最近训练日期', latestDate || '未知'],
    ['相关训练动作', recent.length ? [...new Set(recent.map(item => EXERCISE_MAP[item.ex.exerciseId]?.name || '其他训练动作'))].join('、') : '无可用记录'],
    ['组数（原始/有效）', row?.lastDate ? `${fmt(row.sets)} / ${fmt(row.effectiveSets)}` : '未知'],
    ['训练量', row?.volumeKg == null ? '未估算' : `${fmt(row.volumeKg)} kg`],
    ['距上次训练', row?.hoursSince == null ? '未知' : `约 ${Math.round(row.hoursSince)} 小时`],
    ['估计状态', recoveryLabels[row?.status || 'unknown']], ['依据', reasonText],
    ['数据来源与可信度', row?.source?.length ? `${row.source.map(source => sources[source] || '未知来源').join('、')}；${({ high: '高', medium: '中', low: '低' })[row.confidence] || '低'}可信度` : '无可用来源']
  ];
  const panel = document.querySelector('#muscle-detail'); panel.replaceChildren();
  const title = document.createElement('h3'); title.textContent = `${MUSCLE_NAMES[id]}详情`; panel.append(title);
  const list = document.createElement('dl');
  fields.forEach(([label, value]) => { const term = document.createElement('dt'); term.textContent = label; const detail = document.createElement('dd'); detail.textContent = value; list.append(term, detail); });
  panel.append(list);
  const disclaimer = document.createElement('p'); disclaimer.className = 'recovery-disclaimer'; disclaimer.textContent = `规则模型估算，不是医学检测结果；经过 72 小时不代表已完全恢复。所选日期：${dateLabel(selectedDate)}`; panel.append(disclaimer);
}

function renderCoverage(sessions, date, legacyWorkouts = []) {
  const root = document.querySelector('#coverage-rows');
  const controls = ['date-from', 'date-to', 'muscle', 'type', 'source'].map(name => document.querySelector(`[data-control="coverage-${name}"]`));
  const result = getWeeklyCoverage(sessions, `${date}T12:00:00+04:00`);
  const [from, to, muscle, type, source] = controls;
  [from, to].forEach(select => {
    const previous = select.value; select.replaceChildren();
    const blank = document.createElement('option'); blank.value = ''; blank.textContent = '不限日期'; select.append(blank);
    for (let d = new Date(`${result.weekStart}T12:00:00+04:00`); d.toISOString().slice(0, 10) <= result.weekEnd; d.setUTCDate(d.getUTCDate() + 1)) {
      const value = d.toISOString().slice(0, 10), option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option);
    }
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  });
  const setOptions = (select, values, label) => {
    const previous = select.value; select.replaceChildren();
    const all = document.createElement('option'); all.value = ''; all.textContent = `全部${label}`; select.append(all);
    values.forEach(([value, text]) => { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); });
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  };
  setOptions(muscle, Object.entries(MUSCLE_NAMES), '肌群');
  setOptions(type, [...new Set(sessions.map(session => session.type))].map(value => [value, ({ strength: '力量训练', walk: '步行', run: '跑步', cycling: '骑行' })[value] || '训练']), '类型');
  setOptions(source, [['user_confirmed', '用户确认'], ['estimated', '估算'], ['apple_health', 'Apple Health']], '来源');
  const filters = activeFilters = { dateFrom: from.value, dateTo: to.value, muscle: muscle.value, type: type.value, source: source.value };
  const coverage = getWeeklyCoverage(sessions, `${date}T12:00:00+04:00`, filters);
  const fullCoverage = getWeeklyCoverage(sessions, `${date}T12:00:00+04:00`);
  root.replaceChildren();
  Object.entries(coverage.muscles).filter(([id]) => !filters.muscle || id === filters.muscle).forEach(([id, item]) => {
    const row = document.createElement('div'); row.className = 'coverage-row'; row.dataset.muscle = id;
    const name = document.createElement('strong'); name.textContent = MUSCLE_NAMES[id];
    const sets = document.createElement('span'); sets.textContent = item.frequency ? `${fmt(item.sets)} / ${fmt(item.rawSets)} 组（有效/原始）` : '本周无记录';
    const frequency = document.createElement('span'); frequency.textContent = `${item.frequency} 次`;
    const last = document.createElement('span'); last.textContent = item.lastDate ? dateLabel(item.lastDate) : '本周无记录';
    row.append(name, sets, frequency, last); root.append(row);
  });
  const balance = document.querySelector('#coverage-balance'); balance.replaceChildren();
  Object.entries(fullCoverage.balance).forEach(([key, value]) => {
    const row = document.createElement('div'); row.className = 'balance-row';
    const name = document.createElement('span'); name.textContent = ({ chest: '胸', back: '背', shoulders: '肩', legs: '腿', core: '核心' })[key];
    const track = document.createElement('span'); track.className = 'balance-track';
    const fill = document.createElement('i'); fill.style.width = `${Math.min(100, value.share * 100)}%`; track.append(fill);
    const label = document.createElement('small'); label.textContent = `${fmt(value.effectiveSets)} 组 · ${value.status}`;
    row.append(name, track, label); balance.append(row);
  });
  if (filters.muscle) { const note = document.createElement('p'); note.className = 'filter-note'; note.textContent = `当前肌群筛选：${MUSCLE_NAMES[filters.muscle]}；均衡分布仍按全部肌群计算。`; balance.before(note); }
  renderSessionList(sessions, legacyWorkouts, filters);
}

function renderTrends(dayLogs, sessions, legacyWorkouts) {
  const root = document.querySelector('#training-trends'); root.replaceChildren();
  const ordered = dayLogs.slice(-14);
  const measures = [
    ['训练时长', '分钟', day => {
      const values = sessions.filter(session => session.date === day.date).map(duration).filter(Number.isFinite);
      return values.length ? values.reduce((a, b) => a + b, 0) : null;
    }],
    ['活动热量', 'kcal', day => {
      const values = legacyWorkouts.filter(workout => workout.local_date === day.date).map(workout => workout.activity_kcal).filter(Number.isFinite);
      return values.length ? values.reduce((a, b) => a + b, 0) : null;
    }]
  ];
  measures.forEach(([title, unit, read], index) => {
    const series = buildSeries(ordered, read), average = meanSeries(ordered, read);
    const card = document.createElement('article'); card.className = 'trend-chart-card';
    const heading = document.createElement('h3'); heading.textContent = title;
    const summary = document.createElement('p'); summary.className = 'trend-mean'; summary.textContent = average.mean == null ? `均值未知 · ${average.label}` : `均值 ${fmt(average.mean)} ${unit} · ${average.label}`;
    const graph = document.createElement('div'); graph.className = 'trend-graph';
    const chart = lineChart(series.map(item => item.y), ordered.map(item => item.date), `${title}趋势（空缺表示未记录）`, unit, `training-series-${index}`, index ? '#695384' : '#155a52', [], graph.clientWidth || 360);
    chart.querySelectorAll('[data-chart-hit="true"]').forEach(hit => { hit.setAttribute('fill', 'transparent'); });
    graph.append(chart); card.append(heading, summary, graph); root.append(card);
  });
}

function renderSessionList(sessions, legacyWorkouts, filters = {}) {
  const root = document.querySelector('#workout-list'); root.replaceChildren();
  [...sessions].filter(session => (!filters.dateFrom || session.date >= filters.dateFrom) && (!filters.dateTo || session.date <= filters.dateTo) && (!filters.type || session.type === filters.type) && (!filters.source || session.source === filters.source) && (!filters.muscle || session.exercises?.some(ex => { const map = EXERCISE_MAP[ex.exerciseId]; return map && [...map.primary, ...map.secondary].includes(filters.muscle); }))).sort((a, b) => b.date.localeCompare(a.date)).forEach(session => {
    const legacy = legacyWorkouts.find(item => item.local_date === session.date);
    const card = document.createElement('article'); card.className = 'workout-row'; card.dataset.session = session.id;
    const date = document.createElement('time'); date.dateTime = session.date; date.textContent = session.date;
    const title = document.createElement('strong'); title.textContent = ({ strength: '力量训练', walk: '步行', run: '跑步', cycling: '骑行' })[session.type] || '训练';
    const metrics = document.createElement('span'); metrics.textContent = `${duration(session) ?? '未知'} 分钟 · ${legacy?.activity_kcal == null ? '热量未知' : `${legacy.activity_kcal} kcal`}`;
    const source = document.createElement('em'); source.className = 'tag'; source.textContent = sources[session.source] || '未知来源';
    const exerciseSummary = document.createElement('small');
    exerciseSummary.textContent = session.exercises?.length ? session.exercises.map(ex => `${EXERCISE_MAP[ex.exerciseId]?.name || '其他训练动作'} ${ex.sets.length} 组`).join('、') : '无动作明细';
    card.append(date, title, metrics, source, exerciseSummary); root.append(card);
  });
}

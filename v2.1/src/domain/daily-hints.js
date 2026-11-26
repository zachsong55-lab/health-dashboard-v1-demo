import { MUSCLE_NAMES } from './muscle-map.js';

export function isWeekDataComplete(dayLogs = [], weekStart, weekEnd) {
  if (!Array.isArray(dayLogs) || !weekStart || !weekEnd) return false;
  const expected = [];
  for (let date = new Date(`${weekStart}T00:00:00Z`), end = new Date(`${weekEnd}T00:00:00Z`);
    date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    expected.push(date.toISOString().slice(0, 10));
  }
  if (!expected.length) return false;
  const logs = new Map(dayLogs.map(log => [log.date || log.local_date, log]));
  return expected.every(date => {
    const log = logs.get(date);
    return log && (log.confirmedWorkout || log.confirmedRest || log.estimatedSessionIds?.length
      || log.syncedSessionIds?.length || log.appleHealthPendingIds?.length || log.hasReliableActivityEvidence);
  });
}

export function buildDailyHints(context = {}) {
  const weekComplete = Array.isArray(context.dayLogs)
    ? isWeekDataComplete(context.dayLogs, context.weekStart, context.weekEnd)
    : context.weekDataComplete === true;
  const recovery = Object.entries(context.recovery || {}).map(([id, item]) => ({
    id: `recovery-${id}`, level: item.status === 'unknown' ? 'note' : 'info',
    text: item.status === 'unknown'
      ? `${MUSCLE_NAMES[item.muscle || item.muscleId || id] || '肌群'}恢复状态未知，训练资料不足`
      : `${MUSCLE_NAMES[item.muscle || item.muscleId || id] || '肌群'}处于恢复观察期`,
    basis: `训练日期：${item.lastDate || '未知'}；${(item.reasons || []).join('；') || '资料不足'}`
  })).filter((hint, index, all) => all.findIndex(other => other.id === hint.id) === index);
  const coverage = context.coverage?.muscles || {};
  const coverageId = Object.keys(MUSCLE_NAMES).find(id => coverage[id]?.sets === 0);
  const trainingHint = coverageId
    ? { id: `coverage-${coverageId}`, level: 'note',
      text: weekComplete ? `本周${MUSCLE_NAMES[coverageId]}暂无训练记录` : `本周${MUSCLE_NAMES[coverageId]}记录不完整`,
      basis: `本周日期范围：${context.weekStart || '未知'} 至 ${context.weekEnd || context.today || '未知'}` }
    : recovery[0];
  const proteinHint = typeof context.protein === 'number' && typeof context.proteinTarget === 'number'
    ? { id: 'protein', level: 'info', text: `今日蛋白质记录为 ${context.protein} 克，目标 ${context.proteinTarget} 克`, basis: `记录日期：${context.today || '未知'}` }
    : { id: 'protein', level: 'note', text: '今日蛋白质记录不完整，暂无法判断', basis: `记录日期：${context.today || '未知'}` };
  const window = context.nutritionWindow;
  const windowHint = window?.hours != null
    ? { id: 'eating-window', level: 'info', text: `今日进食窗口记录为 ${Math.round(window.hours * 10) / 10} 小时`, basis: `记录日期：${context.today || '未知'}` }
    : { id: 'eating-window', level: 'note', text: '进食时间记录不完整，暂无法判断', basis: `记录日期：${context.today || '未知'}` };
  const ahHint = context.pendingCount > 0
    ? { id: 'apple-health', level: 'note', text: `健康同步有 ${context.pendingCount} 条记录待处理`, basis: `记录日期：${context.today || '未知'}` }
    : { id: 'apple-health', level: 'note', text: '健康同步资料不足，暂无法判断', basis: `记录日期：${context.today || '未知'}` };
  const hints = [];
  if (trainingHint) hints.push(trainingHint);
  hints.push(proteinHint, windowHint, ahHint);
  return hints.slice(0, Math.min(4, context.limit ?? 4));
}

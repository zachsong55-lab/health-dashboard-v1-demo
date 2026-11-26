const clone = value => structuredClone(value);
const minutes = value => {
  if (typeof value !== 'string' || !/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
};
const workoutId = item => item.originalWorkoutId || item.original_workout_id || item.id || null;
const recordId = record => record.originalWorkoutId || record.original_workout_id || null;

export function matchWorkout(candidate, records, options = {}) {
  const id = workoutId(candidate);
  const exact = id ? records.filter(record => recordId(record) === id) : [];
  if (exact.length) {
    return { status: exact.length === 1 ? 'matched' : 'conflict', matches: exact, method: 'originalWorkoutId' };
  }
  const date = candidate.date || candidate.local_date;
  const start = candidate.start || candidate.start_time;
  const end = candidate.end || candidate.end_time;
  const candidateStart = minutes(start);
  const candidateEnd = minutes(end);
  const threshold = options.overlapThreshold ?? 0.5;
  const matches = records.filter(record => {
    if ((record.date || record.local_date) !== date) return false;
    const boundId = recordId(record);
    if (boundId && boundId !== id) return false;
    const a = minutes(record.start || record.start_time);
    const b = minutes(record.end || record.end_time);
    if ([a, b, candidateStart, candidateEnd].some(value => value === null)) return false;
    const overlap = Math.max(0, Math.min(b, candidateEnd) - Math.max(a, candidateStart));
    const denominator = Math.min(b - a, candidateEnd - candidateStart);
    return denominator > 0 && overlap / denominator >= threshold;
  });
  return { status: matches.length === 1 ? 'matched' : matches.length ? 'conflict' : 'pending', matches, method: 'date-time-overlap' };
}

const fields = [
  { canonical: 'duration', aliases: ['duration', 'durationMin', 'duration_min'] },
  { canonical: 'active_kcal', aliases: ['activity_kcal', 'active_kcal', 'activeKcal'] },
  { canonical: 'total_kcal', aliases: ['total_kcal', 'totalKcal'] },
  { canonical: 'avg_hr', aliases: ['avg_hr', 'avgHr', 'averageHeartRate'] }
];
const confirmed = (record, aliases) => (record.user_confirmed_fields || []).some(field =>
  aliases.some(alias => field === alias || field === `measurements.${alias}`));

export function applyBackfill(records, incoming, { now = new Date().toISOString(), overlapThreshold = 0.5 } = {}) {
  const next = clone(records);
  const history = [];
  const conflicts = [];
  const pending = [];
  const claimed = new Set();
  for (const item of incoming) {
    const match = matchWorkout(item, next, { overlapThreshold });
    if (match.status === 'conflict') {
      conflicts.push({ incoming: item, matches: match.matches.map(record => record.id) });
      continue;
    }
    if (match.status === 'pending') { pending.push(item); continue; }
    const old = match.matches[0];
    if (claimed.has(old.id)) {
      conflicts.push({ incoming: item, matches: [old.id], reason: '同一记录已被本批次其他训练占用' });
      continue;
    }
    claimed.add(old.id);
    const index = next.findIndex(record => record.id === old.id);
    const after = clone(old);
    const changes = [];
    for (const field of fields) {
      const alias = field.aliases.find(key => item[key] != null);
      if (!alias || confirmed(old, field.aliases)) continue;
      const value = item[alias];
      const existingAlias = field.aliases.find(key => after[key] != null) || field.canonical;
      if (after[existingAlias] === value) continue;
      changes.push({ field: field.canonical, before: after[existingAlias] ?? null, after: value, source: 'apple_health' });
      for (const key of field.aliases) delete after[key];
      after[field.canonical] = value;
    }
    if (workoutId(item) && !recordId(old)) after.originalWorkoutId = workoutId(item);
    if (changes.length) {
      after.original_estimate = old.original_estimate ?? clone(old);
      after.history = [...(old.history || []), ...changes.map(change => ({ ...change, at: now }))];
      after.measurementSource = 'apple_health';
      next[index] = after;
      history.push({ recordId: old.id, at: now, changes });
    } else if (after.originalWorkoutId !== old.originalWorkoutId) {
      next[index] = after;
    }
  }
  return { records: next, history, conflicts, pending };
}

export function dailyEnergy({ dailyTotalKcal = null } = {}) {
  return { value: dailyTotalKcal, source: dailyTotalKcal == null ? 'unknown' : 'daily_total',
    deduplicated: true, rule: dailyTotalKcal == null
      ? '全天总消耗缺失；训练或活动热量不能代替全天消耗。'
      : '全天总消耗已包含训练消耗，不重复相加。' };
}

export const matchHealthWorkout = matchWorkout;
export const planHealthBackfill = (sessions, batches, options = {}) =>
  batches.map(batch => ({ ...batch, ...matchWorkout(batch, sessions, options) }));

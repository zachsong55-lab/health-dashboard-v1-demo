export const DAY_STATUSES = [
  'confirmed_workout', 'confirmed_rest', 'unrecorded', 'ah_pending', 'estimated', 'synced'
];

export function getDayStatus(input = {}) {
  const pending = input.appleHealthPendingIds || input.pendingIds || [];
  const status = input.confirmedWorkout || input.confirmed_workout
    ? 'confirmed_workout'
    : input.confirmedRest || input.confirmed_rest
      ? 'confirmed_rest'
      : pending.length
        ? 'ah_pending'
        : (input.estimatedSessionIds || []).length || input.estimated
          ? 'estimated'
          : (input.syncedSessionIds || []).length || input.synced
            ? 'synced'
            : 'unrecorded';
  return { date: input.date ?? null, status, pendingCount: pending.length };
}

export function buildSeries(days, valueOf = day => day.value) {
  return days.map(day => ({ x: day.date, y: valueOf(day) ?? null }));
}

export function meanSeries(days, valueOf = day => day.value) {
  const values = days
    .map(day => ({ x: day.date, y: valueOf(day) }))
    .filter(point => typeof point.y === 'number' && Number.isFinite(point.y));
  return {
    x: values.map(point => point.x),
    y: values.map(point => point.y),
    mean: values.length ? values.reduce((sum, point) => sum + point.y, 0) / values.length : null,
    days: values.length,
    totalDays: days.length,
    label: `${values.length}/${days.length} 天`
  };
}

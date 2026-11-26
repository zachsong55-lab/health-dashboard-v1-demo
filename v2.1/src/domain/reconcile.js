const norm = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const clone = value => structuredClone(value);
const fields = {
  workout: ['workout_type', 'duration_min', 'activity_kcal', 'total_workout_kcal', 'session_state', 'record_status'],
  burn: ['value', 'unit', 'metric'],
  consumption: ['value', 'unit', 'metric']
};

export function recordKey(record) {
  if (record.original_record_id) return `${record.record_type}|original|${norm(record.original_record_id)}`;
  if (record.record_type === 'workout') {
    if (!record.local_date || !record.workout_type || !record.start_time) return null;
    return `workout|${norm(record.local_date)}|${norm(record.workout_type)}|${norm(record.start_time)}`;
  }
  if (['burn', 'consumption'].includes(record.record_type)) {
    if (!record.local_date || !record.metric) return null;
    return `${record.record_type}|${norm(record.local_date)}|${norm(record.metric)}`;
  }
  return null;
}

const meaningful = value => value !== null && value !== undefined;
export function reconcileAppleHealth(records, incoming, { now = new Date().toISOString(), syncDate = now.slice(0, 10) } = {}) {
  const next = clone(records);
  const audit = [];
  const seenIncoming = new Map();
  const event = (item, operation, details, prior = null, record = item) => audit.push({ event_id: `audit-${audit.length + 1}`, local_date: item.local_date ?? null, record_id: record.id ?? prior?.id ?? null, operation, outcome: operation === 'CONFLICT' ? 'PENDING' : 'SUCCESS', source: 'apple_health', synced_at: now, sync_state: operation === 'CONFLICT' ? 'conflict_pending' : operation === 'UPDATE' ? 'synced' : 'duplicate', details, current_value: prior, incoming_value: item });
  for (const item of incoming) {
    const key = recordKey(item);
    if (!key) { event(item, 'CONFLICT', '缺少类型化匹配所需字段'); continue; }
    const priorIncoming = seenIncoming.get(key);
    if (priorIncoming) {
      const compareFields = fields[item.record_type] || ['value', 'unit', 'metric'];
      const same = compareFields.every(field => !meaningful(item[field]) || !meaningful(priorIncoming[field]) || item[field] === priorIncoming[field]);
      event(item, same ? 'SKIP_DUPLICATE' : 'CONFLICT', same ? '批次内容相同，跳过重复记录' : '批次内同键内容不同，等待核对');
      continue;
    }
    seenIncoming.set(key, clone(item));
    const matches = next.map((record, index) => ({ record, index })).filter(({ record }) => recordKey(record) === key);
    if (matches.length !== 1) { event(item, 'CONFLICT', matches.length ? '匹配不唯一，等待人工核对' : '找不到原记录，不自动新增'); continue; }
    const { record: old, index } = matches[0];
    const dataFields = fields[item.record_type] || ['value', 'unit', 'metric'];
    const differences = [];
    for (const field of dataFields) {
      if (!meaningful(item[field]) || !meaningful(old[field])) continue;
      if (item[field] !== old[field]) differences.push({ field, current: old[field], incoming: item[field] });
    }
    if (old.data_source === 'manual' && differences.length) { event(item, 'CONFLICT', `手动记录与实测冲突：${differences.map(d => `${d.field} ${d.current} / ${d.incoming}`).join('；')}`, old, old); continue; }
    if (old.data_source === 'apple_health' && !differences.length && dataFields.every(field => !meaningful(item[field]) || item[field] === old[field])) { event(item, 'SKIP_DUPLICATE', '内容相同，跳过重复记录', old, old); continue; }
    if (old.data_source !== 'estimated' && old.data_source !== 'apple_health') { event(item, 'CONFLICT', '来源无法安全覆盖，等待核对', old, old); continue; }
    const updated = { ...old };
    for (const field of [...new Set([...dataFields, 'source_details'])]) if (meaningful(item[field])) updated[field] = clone(item[field]);
    updated.data_source = 'apple_health';
    updated.verified_at = now;
    updated.estimated_at = null;
    updated.confidence = null;
    updated.updated_at = now;
    updated.id = old.id;
    updated.original_record_id = old.original_record_id ?? item.original_record_id ?? null;
    updated.match_key = old.match_key ?? item.match_key ?? key;
    updated.sync_state = old.local_date < syncDate ? 'delayed_synced' : old.data_source === 'estimated' ? 'over_estimate' : 'synced';
    updated.record_status = old.record_status === 'CONFIRMED' ? 'CONFIRMED' : 'CORRECTED';
    next[index] = updated;
    event(item, 'UPDATE', updated.sync_state === 'delayed_synced' ? '延迟同步已补录' : old.data_source === 'estimated' ? '已覆盖估算' : 'Apple Health 记录已修正', old, updated);
  }
  return { records: next, audit };
}

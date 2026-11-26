const rank = { confirmed: 5, label: 4, database: 3, photo: 2, unknown: 1 };
const valid = item => typeof item?.value === 'number' && Number.isFinite(item.value);

export function mergeNutrients(existing = {}, incoming = {}) {
  const nutrients = structuredClone(existing);
  const audit = [];
  for (const [key, candidate] of Object.entries(incoming)) {
    const old = nutrients[key];
    if (!candidate || candidate.value == null || !valid(candidate)) {
      audit.push({ key, operation: 'SKIP', reason: '未知值不能覆盖已知值' });
      continue;
    }
    if (old?.unit && candidate.unit && old.unit !== candidate.unit) {
      audit.push({ key, operation: 'CONFLICT', reason: '单位不一致' });
      continue;
    }
    if (valid(old) && (rank[candidate.source] ?? 1) < (rank[old.source] ?? 1)) {
      audit.push({ key, operation: 'SKIP', reason: '来源优先级较低' });
      continue;
    }
    nutrients[key] = structuredClone(candidate);
    audit.push({ key, operation: 'UPDATE' });
  }
  return { nutrients, audit };
}

const protectedFields = new Set(['id', 'match_key', 'original_record_id']);
const entryFields = ['local_date', 'local_time', 'time_basis', 'meal_label', 'foods_and_amounts', 'calories_min', 'calories_max', 'protein_min_g', 'protein_max_g', 'consumption', 'record_status', 'data_source', 'estimated_at', 'verified_at', 'confidence'];

function mergeItem(old, update) {
  const result = structuredClone(old);
  for (const [field, value] of Object.entries(update)) {
    if (protectedFields.has(field) || value == null) continue;
    if (field === 'nutrients') result.nutrients = mergeNutrients(old.nutrients, value).nutrients;
    else result[field] = structuredClone(value);
  }
  return result;
}

export function mergeFoodEntry(existing, incoming) {
  if (!existing) return structuredClone(incoming);
  const result = { ...structuredClone(existing) };
  const sourceRank = { unknown: 0, estimated: 1, manual: 3, apple_health: 4 };
  const mayReplace = (sourceRank[incoming.data_source] ?? 0) >= (sourceRank[existing.data_source] ?? (existing.record_status === 'CONFIRMED' ? 3 : 0));
  const protectedValues = ['calories_min','calories_max','protein_min_g','protein_max_g','data_source','record_status'];
  for (const field of entryFields) if (incoming[field] != null && (mayReplace || !protectedValues.includes(field))) result[field] = structuredClone(incoming[field]);
  if (existing.record_status === 'CONFIRMED' && incoming.record_status === 'ESTIMATED') result.record_status = 'CONFIRMED';
  const oldItems = structuredClone(existing.foodItems || []);
  const newItems = incoming.foodItems || [];
  const appended = [];
  const audit = [];
  for (const item of newItems) {
    const key = item.match_key || item.original_record_id;
    if (!key) { audit.push({ operation: 'CONFLICT', item_id: item.id, reason: '食物缺少稳定匹配键' }); continue; }
    const matches = oldItems.map((old, i) => ({ old, i })).filter(({ old }) => (old.match_key || old.original_record_id) === key);
    if (matches.length > 1) { audit.push({ operation: 'CONFLICT', item_id: item.id, reason: '食物匹配不唯一' }); continue; }
    if (!matches.length) {
      if (!appended.some(x => (x.match_key || x.original_record_id) === key)) appended.push(structuredClone(item));
      audit.push({ operation: 'CREATE', item_id: item.id });
      continue;
    }
    const { old, i } = matches[0];
    oldItems[i] = mergeItem(old, item);
    audit.push({ operation: 'UPDATE', item_id: old.id });
  }
  result.foodItems = [...oldItems.map(item => structuredClone(item)), ...appended];
  result.mergeAudit = audit;
  return result;
}

export function upsertFoodEntries(entries, incoming) {
  const result = structuredClone(entries);
  const audit = [];
  for (const item of incoming) {
    const key = item.match_key || item.original_record_id;
    if (!key) { audit.push({ operation: 'CONFLICT', id: item.id, reason: '记录缺少稳定匹配键' }); continue; }
    const matches = result.map((old, i) => ({ old, i })).filter(({ old }) => (old.match_key || old.original_record_id) === key);
    if (matches.length > 1) { audit.push({ operation: 'CONFLICT', id: item.id, reason: '记录匹配不唯一' }); continue; }
    if (!matches.length) { result.push(mergeFoodEntry(null, item)); audit.push({ operation: 'CREATE', id: item.id }); continue; }
    const { old, i } = matches[0];
    result[i] = mergeFoodEntry(old, item);
    audit.push({ operation: 'UPDATE', id: old.id });
  }
  return { entries: result, audit };
}

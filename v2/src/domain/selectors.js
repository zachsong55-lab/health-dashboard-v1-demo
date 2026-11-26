export function summarizeNutrients(items, key) {
  const entries = items.map(item => item.nutrients?.[key]);
  const units = [...new Set(entries.filter(Boolean).map(entry => entry.unit).filter(Boolean))];
  const valid = entries.filter(entry => typeof entry?.value === 'number' && Number.isFinite(entry.value));
  const unitMismatch = units.length > 1;
  return { value: valid.length && !unitMismatch ? valid.reduce((sum, entry) => sum + entry.value, 0) : null, known: valid.length, total: items.length, unit: units[0] || '', partial: valid.length < items.length, unitMismatch };
}

export function summarizeFoodEntries(entries) {
  const items = entries.flatMap(entry => entry.foodItems || []);
  const get = key => summarizeNutrients(items, key);
  const meals = entries.map(entry => ({ label: entry.meal_label, local_time: entry.local_time, kcal: summarizeNutrients(entry.foodItems || [], 'kcal').value, items: entry.foodItems || [] }));
  const known = key => get(key).value;
  const range = field => { const values = entries.map(entry => entry[field]).filter(value => typeof value === 'number' && Number.isFinite(value)); return values.length ? { min: values.reduce((sum, value) => sum + value, 0), max: entries.map(entry => entry[field]).filter(value => typeof value === 'number' && Number.isFinite(value)).reduce((sum, value) => sum + value, 0) } : null; };
  const caloriesRange = range('calories_min') && range('calories_max') ? { min: range('calories_min').min, max: range('calories_max').max } : null;
  const proteinRange = range('protein_min_g') && range('protein_max_g') ? { min: range('protein_min_g').min, max: range('protein_max_g').max } : null;
  const first = [...entries].map(x => x.local_time).filter(Boolean).sort()[0] ?? null;
  const last = [...entries].map(x => x.local_time).filter(Boolean).sort().at(-1) ?? null;
  return { items, meals, kcal: caloriesRange ? (caloriesRange.min + caloriesRange.max) / 2 : known('kcal'), protein: proteinRange ? (proteinRange.min + proteinRange.max) / 2 : known('protein'), caloriesRange, proteinRange, first, last, durationMinutes: first && last ? timeMinutes(last) - timeMinutes(first) : null, nutrients: Object.fromEntries([...new Set(items.flatMap(x => Object.keys(x.nutrients || {})))].map(key => [key, get(key)])) };
}

export function timeMinutes(time) { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; }
export function formatDuration(minutes) { if (!Number.isFinite(minutes)) return '未知'; return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`; }
export function latestWeight(records, date) { return [...records].filter(x => x.local_date <= date && Number.isFinite(x.value)).sort((a,b) => b.local_date.localeCompare(a.local_date))[0] || null; }
export function rollingDays(days, date, count = 7) { const index = days.findIndex(day => day.date === date); return days.slice(Math.max(0, index - count + 1), index + 1); }

const time = value => {
  if (typeof value !== 'string' || !/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
};

export function analyzeNutritionWindow(entries = []) {
  const timed = entries.map(entry => ({ entry, minute: time(entry.local_time ?? entry.time) }))
    .filter(item => item.minute !== null)
    .sort((a, b) => a.minute - b.minute);
  const first = timed[0]?.entry.local_time ?? timed[0]?.entry.time ?? null;
  const last = timed.at(-1)?.entry.local_time ?? timed.at(-1)?.entry.time ?? null;
  if (timed.length < 2) {
    return { status: 'unknown', minutes: null, hours: null, first, last,
      explanation: '进食时间记录不足，无法判定窗口', meals: groupMeals(entries) };
  }
  const minutes = timed.at(-1).minute - timed[0].minute;
  return { status: minutes <= 480 ? 'within_8h' : 'over_8h', minutes, hours: minutes / 60,
    first, last, explanation: minutes <= 480 ? '记录窗口符合 8 小时内' : '记录窗口超过 8 小时',
    meals: groupMeals(entries) };
}

export function groupMeals(entries = []) {
  const groups = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const entry of entries) {
    const label = entry.meal_label || entry.meal || '';
    const key = /早|breakfast/i.test(label) ? 'breakfast'
      : /午|lunch/i.test(label) ? 'lunch'
        : /晚|dinner/i.test(label) ? 'dinner' : 'snack';
    groups[key].push(entry);
  }
  return groups;
}

export function mealMacros(entries = []) {
  const result = {};
  for (const [meal, items] of Object.entries(groupMeals(entries))) {
    const macros = {};
    for (const key of ['protein', 'carbs', 'fat']) {
      const foods = items.flatMap(item => item.foodItems || []);
      const values = foods.map(food => food.nutrients?.[key]?.value);
      macros[key] = values.length && values.every(Number.isFinite)
        ? values.reduce((sum, value) => sum + value, 0) : null;
    }
    result[meal] = macros;
  }
  return result;
}

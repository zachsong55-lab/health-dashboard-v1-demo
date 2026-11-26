import { analyzeNutritionWindow, groupMeals } from '../domain/nutrition-window.js';
import { summarizeFoodEntries } from '../domain/selectors.js';

const labels = { confirmed: '用户确认', label: '包装标签', database: '营养数据库估算', photo: '图片估算', unknown: '未知' };
const fmt = value => value == null ? '未知' : `${value}`;
const core = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];
export function renderFoodPage({ day, snacks = [] }) {
  const host = document.querySelector('#food-details');
  if (!host || !day) return;
  const entries = day.foodEntries || [];
  const groups = groupMeals(entries);
  const snackEntries = snacks.filter(s => s.local_date === day.date).map(s => ({ meal_label: '加餐', local_time: s.local_time, foodItems: s.foodItems || [] }));
  const window = analyzeNutritionWindow([ ...entries, ...snackEntries ]);
  const root = document.createElement('div'); root.className = 'food-page-content';
  const summary = document.createElement('p');
  const withSnacks = [ ...entries, ...snackEntries ];
  const kcal = summarizeFoodEntries(entries).kcal;
  const snackKcal = summarizeFoodEntries(withSnacks).kcal;
  summary.className = 'food-total'; summary.textContent = `含加餐合计：${snackKcal == null ? '未知' : `${Math.round(snackKcal)} kcal`}；V2 三餐口径：${kcal == null ? '未知' : `${Math.round(kcal)} kcal`}`;
  const eating = document.createElement('p'); eating.dataset.windowStatus = window.status;
  eating.textContent = `16:8 记录窗口：${window.explanation}${window.hours == null ? '' : `（约 ${Math.round(window.hours)} 小时）`}`;
  root.append(summary, eating);
  const timeline = document.createElement('ol'); timeline.className = 'food-time-axis';
  entries.slice().sort((a,b) => (a.local_time || '').localeCompare(b.local_time || '')).forEach(entry => {
    const li = document.createElement('li'); li.textContent = `${entry.local_time || '时间未知'} · ${entry.meal_label}`; timeline.append(li);
  });
  root.append(timeline);
  for (const [key, title] of [['breakfast','早餐'],['lunch','午餐'],['dinner','晚餐'],['snack','加餐']]) {
    const card = document.createElement('section'); card.className = 'food-meal-card';
    const h = document.createElement('h3'); h.textContent = title; card.append(h);
    const items = key === 'snack' ? snacks.filter(s => s.local_date === day.date).flatMap(s => s.foodItems || []) : (groups[key] || []).flatMap(e => e.foodItems || []);
    if (items.length) {
      const macroKeys = ['protein', 'carbs', 'fat'];
      const totals = macroKeys.map(k => {
        const values = items.map(item => item.nutrients?.[k]?.value);
        return values.some(v => v == null) ? null : values.reduce((a,b) => a + b, 0);
      });
      const macro = document.createElement('p'); macro.className = 'meal-macro-summary';
      macro.textContent = totals.some(v => v == null) ? '宏量营养素分布：数据未知' : `宏量分布：蛋白质 ${totals[0]}g · 碳水 ${totals[1]}g · 脂肪 ${totals[2]}g`;
      card.append(macro);
    }
    if (!items.length) { const empty = document.createElement('p'); empty.textContent = key === 'snack' ? '无加餐记录' : '无记录'; card.append(empty); }
    items.forEach(item => {
      const row = document.createElement('article'); row.className = 'food-row';
      const name = document.createElement('strong'); name.textContent = item.name || '食物'; row.append(name);
      const metrics = document.createElement('div'); metrics.className = 'food-main';
      const names = { kcal: '热量', protein: '蛋白质', carbs: '碳水化合物', fat: '脂肪', fiber: '膳食纤维' };
      core.forEach(k => { const n = item.nutrients?.[k]; const span = document.createElement('span'); span.dataset.sourceTag = n?.source || 'unknown'; span.textContent = `${names[k]}：${fmt(n?.value)}${k === 'kcal' ? ' kcal' : k === 'fiber' || k === 'protein' || k === 'carbs' || k === 'fat' ? ' g' : ''} · ${labels[n?.source] || '未知'}`; metrics.append(span); });
      const detail = document.createElement('details'); detail.dataset.expand = 'food'; const summaryNode = document.createElement('summary'); summaryNode.textContent = '展开其他营养素';
      const extra = document.createElement('div'); extra.className = 'food-extra';
      Object.entries(item.nutrients || {}).filter(([k]) => !core.includes(k)).forEach(([k,n]) => { const span = document.createElement('span'); span.dataset.sourceTag = n?.source || 'unknown'; span.textContent = `${({ sugar: '糖', sat_fat: '饱和脂肪', sodium: '钠', potassium: '钾', calcium: '钙', iron: '铁', magnesium: '镁', zinc: '锌' })[k] || '其他营养素'}：${fmt(n?.value)} · ${labels[n?.source] || '未知'}`; extra.append(span); });
      detail.append(summaryNode, extra); row.append(metrics, detail); card.append(row);
    });
    if (key === 'snack' && items.length) { const note = document.createElement('p'); note.className = 'demo-note'; note.textContent = '不计入 V2 总摄入口径（演示）'; card.append(note); }
    root.append(card);
  }
  host.replaceChildren(root);
}

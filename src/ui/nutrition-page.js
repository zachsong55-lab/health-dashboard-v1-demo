export function renderNutritionPage({ day }) {
  if (!day) return;
  const entries = day.foodEntries || [];
  const counts = new Map(); let unknown = 0;
  entries.flatMap(entry => entry.foodItems || []).forEach(item => Object.values(item.nutrients || {}).forEach(n => {
    const source = n?.source || 'unknown'; counts.set(source, (counts.get(source) || 0) + 1); if (n?.value == null || source === 'unknown') unknown++;
  }));
  let panel = document.querySelector('#nutrition-source-summary');
  if (!panel) { panel = document.createElement('article'); panel.id = 'nutrition-source-summary'; panel.className = 'panel'; document.querySelector('#nutrients')?.append(panel); }
  const title = document.createElement('h3'); title.textContent = '数据来源分布';
  const list = document.createElement('ul');
  const labels = { confirmed:'用户确认', label:'包装标签', database:'营养数据库估算', photo:'图片估算', unknown:'未知' };
  counts.forEach((count, source) => { const li = document.createElement('li'); li.textContent = `${labels[source] || source}：${count} 条`; list.append(li); });
  const unknownLine = document.createElement('p'); unknownLine.dataset.unknownCount = ''; unknownLine.textContent = `未知营养素值：${unknown} 项`;
  panel.replaceChildren(title, list, unknownLine);
}

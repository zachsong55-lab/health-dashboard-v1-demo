import { planHealthBackfill, applyBackfill, dailyEnergy } from '../domain/apple-health-backfill.js';

const statusText = { pending: '待同步', backfilled: '已补录', corrected: '已校正', conflict: '冲突待处理', synced: '已同步' };
const value = x => x == null ? '未知' : String(x);
const fieldName = field => ({ duration: '训练时长', durationMin: '训练时长', duration_min: '训练时长', active_kcal: '活动热量', activity_kcal: '活动热量', total_kcal: '全天总消耗', avg_hr: '平均心率' })[field] || '测量数据';
export function renderAppleHealthPage({ sessions = [], incoming = [], batches = [], history = [], selectedDate }) {
  const root = document.querySelector('#sync'); if (!root) return;
  const planned = planHealthBackfill(sessions, incoming);
  const applied = applyBackfill(sessions, incoming, { now: '2026-11-27T09:00:00+04:00' });
  const canonical = planned?.batches?.map(batch => batch.state) || batches.map(batch => batch.state);
  const counts = [['pending','待同步'],['backfilled','已补录'],['corrected','已校正'],['conflict','冲突待处理'],['synced','已同步']];
  const cards = document.createElement('div'); cards.className = 'ah-cards';
  counts.forEach(([key,label]) => {
    const count = canonical.filter(x => x === key).length;
    const card = document.createElement('article'); card.className = `ah-count ah-${key}`; card.dataset.ahCount = key;
    card.textContent = `${key === 'conflict' ? '⚠' : key === 'pending' ? '◷' : key === 'corrected' ? '↻' : key === 'backfilled' ? '＋' : '✓'} ${label} ${count}`; cards.append(card);
  });
  const historyByBatch = new Map(history.map(item => [item.batchId, item]));
  const list = document.createElement('div'); list.className = 'ah-timeline';
  const sorted = [...batches].sort((a,b) => Number(b.state === 'conflict') - Number(a.state === 'conflict') || b.date.localeCompare(a.date));
  sorted.forEach(batch => {
    const row = document.createElement('article'); row.className = `ah-row ah-${batch.state}`; row.dataset.ahStatus = batch.state;
    const heading = document.createElement('h3'); heading.textContent = `${batch.date} · ${statusText[batch.state] || batch.state}`;
    const source = document.createElement('p'); source.textContent = '来源：Apple Health'; row.append(heading, source);
    if (batch.state === 'conflict') {
      const candidates = document.createElement('p'); candidates.textContent = `候选双方：${(batch.candidateSessionIds || []).map((id, index) => { const session = sessions.find(item => item.id === id); return `候选记录 ${index + 1}${session?.date ? `（${session.date}）` : ''}`; }).join(' / ') || '未确定'}。未自动写入，需人工确认。`; row.append(candidates);
    }
    if (batch.before || batch.after) {
      const entries = Object.keys(batch.after || {}).map(key => `${fieldName(key)}：${value(batch.before?.[key])} → ${value(batch.after[key])}`);
      const change = document.createElement('p'); change.textContent = `修改前 → 修改后：${entries.join('；') || '暂无字段变化'}`; row.append(change);
    }
    const locked = document.createElement('p'); locked.textContent = '用户确认，已锁定（动作、重量、组数、次数）'; row.append(locked);
    const prior = historyByBatch.get(batch.id) || batch.history?.[0];
    if (prior) { const trail = document.createElement('p'); trail.textContent = `处理历史：${prior.at} · ${fieldName(prior.field)} ${value(prior.before)} → ${value(prior.after)} · ${prior.source === 'apple_health' ? 'Apple Health' : '用户确认'}`; row.append(trail); }
    list.append(row);
  });
  const planLine = document.createElement('p'); planLine.dataset.backfillResult = 'plan';
  planLine.textContent = `匹配计划：${planned.filter(item => item.status === 'matched').length} 项可匹配，${planned.filter(item => item.status === 'conflict').length} 项冲突，${planned.filter(item => item.status === 'pending').length} 项待补充信息。`;
  list.prepend(planLine);
  const appliedLine = document.createElement('p'); appliedLine.dataset.backfillResult = 'apply';
  appliedLine.textContent = `模拟应用：${applied.history.length} 项字段更新，${applied.conflicts.length} 项冲突，${applied.pending.length} 项待同步；正式记录未写入。`;
  list.append(appliedLine);
  const daily = dailyEnergy({ dailyTotalKcal: batches.find(batch => batch.dailyTotalKcal != null)?.dailyTotalKcal ?? null });
  const note = document.createElement('p'); note.className = 'ah-energy-note'; note.textContent = `热量口径：全天消耗 ${daily.value == null ? '未知' : `${daily.value} kcal`}；全天消耗、训练总热量与活动热量不重复相加。`;
  let disclaimer = root.querySelector('.ah-demo-note');
  if (!disclaimer) { disclaimer = document.createElement('p'); disclaimer.className = 'ah-demo-note'; }
  disclaimer.textContent = '演示数据：本页只演示补录规则，未连接 Apple Health 或 Airtable，不写入正式记录';
  const syncDates = batches.map(batch => batch.syncedAt || batch.synced_at || batch.history?.map(item => item.at).filter(Boolean).sort().at(-1)).filter(Boolean).sort();
  const sync = root.querySelector('#last-sync'); if (sync) sync.textContent = syncDates.length ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(syncDates.at(-1))) : '尚无同步时间';
  const old = root.querySelector('#ah-statuses'); if (old) old.replaceChildren(cards);
  const sourceRecords = root.querySelector('#ah-batches'); if (sourceRecords) sourceRecords.replaceChildren(list);
  const audit = root.querySelector('#ah-energy'); if (audit) audit.replaceChildren(note);
  root.append(disclaimer);
}

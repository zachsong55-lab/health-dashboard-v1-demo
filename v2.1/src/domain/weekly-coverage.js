import { EXERCISE_MAP } from './muscle-map.js';

const names = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core', 'glutes', 'quads', 'hamstrings', 'calves'];
const dubaiDate = date => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(date));

function monday(date) {
  const value = new Date(`${date}T12:00:00+04:00`);
  const shift = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - shift);
  return dubaiDate(value);
}

export function getWeeklyCoverage(sessions = [], selectedDate = new Date().toISOString(), filters = {}) {
  const date = String(selectedDate).slice(0, 10);
  const weekStart = monday(date);
  const weekEnd = new Date(new Date(`${weekStart}T12:00:00+04:00`).getTime() + 6 * 864e5).toISOString().slice(0, 10);
  const rows = sessions.filter(session => {
    const day = session.date || session.local_date;
    return day >= weekStart && day <= weekEnd
      && (!filters.dateFrom || day >= filters.dateFrom)
      && (!filters.dateTo || day <= filters.dateTo)
      && (!filters.type || session.type === filters.type)
      && (!filters.source || session.source === filters.source);
  });
  const muscles = Object.fromEntries(names.map(muscle => [muscle, {
    muscle, sets: 0, rawSets: 0, frequency: 0, lastDate: null, dates: []
  }]));
  for (const session of rows) {
    for (const exercise of session.exercises || []) {
      const mapping = EXERCISE_MAP[exercise.exerciseId];
      if (!mapping) continue;
      for (const [muscleList, weight] of [[mapping.primary, 1], [mapping.secondary, 0.5]]) {
        for (const muscle of muscleList) {
          if (filters.muscle && filters.muscle !== muscle) continue;
          const count = (exercise.sets || []).length;
          muscles[muscle].sets += count * weight;
          muscles[muscle].rawSets += count;
          muscles[muscle].dates.push(session.date || session.local_date);
        }
      }
    }
  }
  for (const muscle of Object.values(muscles)) {
    muscle.dates = [...new Set(muscle.dates)];
    muscle.frequency = muscle.dates.length;
    muscle.lastDate = muscle.dates.sort().at(-1) || null;
  }
  const categories = {
    chest: ['chest'], back: ['back'], shoulders: ['shoulders'],
    legs: ['glutes', 'quads', 'hamstrings', 'calves'], core: ['core']
  };
  const total = Object.values(muscles).reduce((sum, muscle) => sum + muscle.sets, 0);
  const balance = Object.fromEntries(Object.entries(categories).map(([key, members]) => {
    const count = members.reduce((sum, member) => sum + muscles[member].sets, 0);
    const share = total ? count / total : 0;
    return [key, {
      effectiveSets: count, share,
      status: count === 0 ? '本周无记录' : share < 0.1 ? '占比较低' : share <= 0.35 ? '有覆盖' : '占比较高'
    }];
  }));
  return { weekStart, weekEnd, muscles, balance, sessions: rows };
}

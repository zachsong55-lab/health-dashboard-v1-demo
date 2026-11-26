// 动作映射集中维护；辅助肌群按较低权重折算。
export const SECONDARY_WEIGHT = 0.5;
export const MUSCLE_NAMES = {
  chest: '胸', back: '背', shoulders: '肩', biceps: '肱二头肌', triceps: '肱三头肌',
  core: '核心', glutes: '臀', quads: '股四头肌', hamstrings: '腘绳肌', calves: '小腿'
};
export const EXERCISE_MAP = {
  bench_press: { name: '卧推', primary: ['chest'], secondary: ['shoulders', 'triceps'] },
  pull_up: { name: '引体向上', primary: ['back'], secondary: ['biceps'] },
  squat: { name: '深蹲', primary: ['quads', 'glutes'], secondary: ['core'] },
  lateral_raise: { name: '侧平举', primary: ['shoulders'], secondary: [] },
  row: { name: '划船', primary: ['back'], secondary: ['biceps', 'shoulders'] },
  deadlift: { name: '硬拉', primary: ['hamstrings', 'glutes', 'back'], secondary: ['core'] },
  overhead_press: { name: '推举', primary: ['shoulders'], secondary: ['triceps', 'core'] },
  push_up: { name: '俯卧撑', primary: ['chest'], secondary: ['shoulders', 'triceps'] },
  lat_pulldown: { name: '高位下拉', primary: ['back'], secondary: ['biceps'] },
  lunge: { name: '弓步蹲', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'core'] },
  leg_press: { name: '腿举', primary: ['quads'], secondary: ['glutes'] },
  leg_curl: { name: '腿弯举', primary: ['hamstrings'], secondary: [] },
  calf_raise: { name: '提踵', primary: ['calves'], secondary: [] },
  plank: { name: '平板支撑', primary: ['core'], secondary: ['shoulders'] },
  biceps_curl: { name: '弯举', primary: ['biceps'], secondary: [] },
  triceps_pushdown: { name: '绳索下压', primary: ['triceps'], secondary: [] }
};
export const getExerciseMapping = id => EXERCISE_MAP[id] ? structuredClone(EXERCISE_MAP[id]) : null;

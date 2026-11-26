export const nutrientMeta = [
  ['kcal','热量','kcal'],['protein','蛋白质','g'],['carbs','碳水','g'],['fat','总脂肪','g'],['fiber','膳食纤维','g'],['sugar','糖','g'],['sat_fat','饱和脂肪','g'],['sodium','钠','mg'],['calcium','钙','mg'],['iron','铁','mg'],['potassium','钾','mg'],['magnesium','镁','mg'],['zinc','锌','mg'],['vitamin_a','维生素 A','µg RAE'],['b1','维生素 B1','mg'],['b2','维生素 B2','mg'],['b6','维生素 B6','mg'],['b12','维生素 B12','µg'],['folate','叶酸','µg'],['vitamin_c','维生素 C','mg'],['vitamin_d','维生素 D','µg'],['vitamin_e','维生素 E','mg'],['cholesterol','胆固醇','mg'],['mono_fat','单不饱和脂肪','g'],['poly_fat','多不饱和脂肪','g']
].map(([key,label,unit]) => ({key,label,unit}));
export const goals = { kcal:2100, protein:140, carbs:240, fat:70, fiber:28, sugar:50, sat_fat:20, sodium:2300, calcium:1000, iron:18, potassium:3500, magnesium:400, zinc:11, vitamin_a:900, b1:1.2, b2:1.3, b6:1.3, b12:2.4, folate:400, vitamin_c:90, vitamin_d:15, vitamin_e:15, cholesterol:300, mono_fat:25, poly_fat:20 };
const units = Object.fromEntries(nutrientMeta.map(x => [x.key, x.unit]));
const makeNutrients = (values, source = 'database', unknown = []) => Object.fromEntries(nutrientMeta.map(({key}) => [key, { value: unknown.includes(key) ? null : (values[key] ?? null), unit: units[key], source: unknown.includes(key) || values[key] == null ? 'unknown' : source }]));
const foods = [
  ['燕麦酸奶碗','1 碗',{kcal:420,protein:24,carbs:56,fat:12,fiber:8,sat_fat:3,sodium:180,calcium:210,iron:2.4,potassium:390,magnesium:75,zinc:2,vitamin_a:110,b1:.3,b2:.4,b6:.2,b12:.8,folate:55,vitamin_c:3,vitamin_d:1,vitamin_e:2,cholesterol:12,mono_fat:4,poly_fat:2},['sugar','iron']],
  ['烤三文鱼与米饭','1 份',{kcal:690,protein:42,carbs:62,fat:26,fiber:2,sugar:4,sat_fat:5,sodium:440,calcium:45,iron:2.1,potassium:780,magnesium:72,zinc:1.3,vitamin_a:45,b1:.3,b2:.4,b6:.8,b12:5,folate:28,vitamin_c:4,vitamin_d:12,vitamin_e:3,cholesterol:72,mono_fat:10,poly_fat:7},['sodium','calcium']],
  ['鸡蛋全麦吐司','2 片',{kcal:360,protein:20,carbs:38,fat:14,fiber:5,sugar:5,sat_fat:4,sodium:350,calcium:90,iron:2,potassium:260,magnesium:46,zinc:1.7,vitamin_a:160,b1:.25,b2:.5,b6:.2,b12:1.1,folate:62,vitamin_c:0,vitamin_d:2,vitamin_e:1.3,cholesterol:210,mono_fat:5,poly_fat:2}],
  ['豆腐蔬菜碗','1 碗',{kcal:520,protein:32,carbs:54,fat:19,fiber:10,sugar:8,sat_fat:3,sodium:510,calcium:320,iron:4,potassium:800,magnesium:110,zinc:3,vitamin_a:320,b1:.4,b2:.5,b6:.5,b12:null,folate:130,vitamin_c:55,vitamin_d:null,vitamin_e:4,cholesterol:0,mono_fat:6,poly_fat:7}],
  ['扁豆汤与沙拉','1 份',{kcal:480,protein:25,carbs:67,fat:12,fiber:14,sugar:7,sat_fat:2,sodium:620,calcium:110,iron:6,potassium:940,magnesium:95,zinc:2.5,vitamin_a:250,b1:.5,b2:.3,b6:.4,b12:0,folate:210,vitamin_c:38,vitamin_d:0,vitamin_e:2,cholesterol:0,mono_fat:4,poly_fat:4}]
];
const mealsByDay = [
  [['08:10',0],['13:05',1],['19:40',3]], [['09:00',2],['13:10',1],['20:15',4]], [['07:50',0],['12:45',3],['19:10',1]], [['08:35',2],['13:20',4],['20:00',3]], [['09:10',0],['13:00',1],['20:30',4]], [['08:00',2],['12:50',3],['19:25',1]], [['08:20',0],['13:15',3],['20:10',1]]
];
export const days = ['2026-11-20','2026-11-21','2026-11-22','2026-11-23','2026-11-24','2026-11-25','2026-11-26'].map((date, dayIndex) => ({ date, burn:[2310,2240,2460,2380,2290,2510,2390][dayIndex], weight:[69.4,69.2,69.3,null,69.1,69,68.9][dayIndex], foodEntries:mealsByDay[dayIndex].map(([local_time, foodIndex], mealIndex) => {
  const [name, amount, base] = foods[foodIndex];
  const factor = [1, .91, 1.08, .95, 1.03, .98, 1][dayIndex] * [1, .92, 1.04][mealIndex];
  const values = Object.fromEntries(Object.entries(base).map(([key,value]) => [key, typeof value === 'number' ? Math.round(value * factor * 10) / 10 : value]));
  const missing = Object.keys(values).filter(key => values[key] == null);
  return { id:`food-${dayIndex}-${mealIndex}`, match_key:`${date}|${local_time}|${name}`, local_date:date, local_time, time_basis:'Asia/Dubai', meal_label:['早餐','午餐','晚餐'][mealIndex], foods_and_amounts:`${name}，${amount}`, calories_min:values.kcal-25, calories_max:values.kcal+25, protein_min_g:values.protein-2, protein_max_g:values.protein+2, consumption:'ATE', record_status:'ESTIMATED', data_source:'estimated', foodItems:[{id:`item-${dayIndex}-${mealIndex}`,match_key:`${date}|${local_time}|${name}`,name,amount,nutrients:makeNutrients(values,mealIndex===0?'label':'database',missing)}] };
}) }));
export const foodEntries = days.flatMap(day => day.foodEntries);
export const workouts = [
  {id:'w20',record_type:'workout',local_date:'2026-11-20',start_time:'18:00',workout_type:'力量训练',duration_min:48,activity_kcal:260,record_status:'COMPLETED',data_source:'estimated',estimated_at:'2026-11-20T18:30:00+04:00',confidence:.72},
  {id:'w22',record_type:'workout',local_date:'2026-11-22',start_time:'08:00',workout_type:'快走',duration_min:36,activity_kcal:190,record_status:'COMPLETED',data_source:'apple_health',verified_at:'2026-11-23T08:00:00+04:00'},
  {id:'w23',record_type:'workout',local_date:'2026-11-23',start_time:'18:00',workout_type:'力量训练',duration_min:52,activity_kcal:310,record_status:'COMPLETED',data_source:'estimated'},
  {id:'w25',record_type:'workout',local_date:'2026-11-25',start_time:'17:00',workout_type:'骑行',duration_min:42,activity_kcal:330,record_status:'COMPLETED',data_source:'estimated'},
  {id:'w26',record_type:'workout',local_date:'2026-11-26',start_time:'18:00',workout_type:'力量训练',duration_min:55,activity_kcal:340,record_status:'COMPLETED',data_source:'apple_health',verified_at:'2026-11-26T19:10:00+04:00'}
];
export const syncRecords = [
  {id:'burn20',record_type:'burn',metric:'total_daily_burn',local_date:'2026-11-20',value:2310,unit:'kcal',data_source:'estimated'},
  {id:'burn23',record_type:'burn',metric:'total_daily_burn',local_date:'2026-11-23',value:2300,unit:'kcal',data_source:'estimated'},
  {id:'burn26',record_type:'burn',metric:'total_daily_burn',local_date:'2026-11-26',value:2360,unit:'kcal',data_source:'estimated'},
  {id:'manual25',record_type:'burn',metric:'total_daily_burn',local_date:'2026-11-25',value:2290,unit:'kcal',data_source:'manual'}
];
export const incomingHealth = [20,23,26,25].map((day, i) => ({id:`ah${day}`,record_type:'burn',metric:'total_daily_burn',local_date:`2026-11-${day}`,value:[2310,2380,2390,2410][i],unit:'kcal'}));
export const incomingWorkouts = [
  {id:'ah-w23',record_type:'workout',local_date:'2026-11-23',start_time:'18:00',workout_type:'力量训练',duration_min:52,activity_kcal:310,session_state:'COMPLETED'}
];
export const bodyLog = days.filter(day => day.weight != null).map(day => ({local_date:day.date,value:day.weight,unit:'kg',metric:'体重'}));

// 以下均为 V2.1 虚构演示数据，沿用 Asia/Dubai 本地日期。
export const exerciseCatalog = [
  'bench_press', 'pull_up', 'squat', 'lateral_raise', 'row', 'deadlift', 'overhead_press', 'push_up',
  'lat_pulldown', 'lunge', 'leg_press', 'leg_curl', 'calf_raise', 'plank', 'biceps_curl', 'triceps_pushdown'
];
export const trainingSessions = [
  { id: 'demo-session-13', date: '2026-11-13', start: '18:00', end: '18:50', type: 'strength', source: 'user_confirmed', status: 'confirmed', exercises: [{ exerciseId: 'bench_press', sets: [{ reps: 8, weightKg: 45, rpe: 7 }, { reps: 8, weightKg: 45, rpe: 8 }, { reps: 8, weightKg: 45, rpe: 8 }] }] },
  { id: 'demo-session-15', date: '2026-11-15', start: '17:30', end: '18:20', type: 'strength', source: 'user_confirmed', status: 'confirmed', exercises: [{ exerciseId: 'squat', sets: [{ reps: 8, weightKg: 60, rpe: 8 }, { reps: 8, weightKg: 60, rpe: 8 }, { reps: 8, weightKg: 60, rpe: 8 }] }] },
  { id: 'demo-session-17', date: '2026-11-17', start: '18:10', end: '18:55', type: 'strength', source: 'estimated', status: 'estimated', exercises: [{ exerciseId: 'row', sets: [{ reps: 10, weightKg: 35 }, { reps: 10, weightKg: 35 }, { reps: 10, weightKg: 35 }] }] },
  { id: 'demo-session-18a', date: '2026-11-18', start: '17:00', end: '17:45', type: 'strength', source: 'unknown', status: 'unknown', exercises: [] },
  { id: 'demo-session-18b', date: '2026-11-18', start: '17:30', end: '18:00', type: 'strength', source: 'unknown', status: 'unknown', exercises: [] },
  { id: 'demo-session-20', date: '2026-11-20', start: '18:00', end: '18:48', durationMin: 48, activityKcal: 260, type: 'strength', source: 'estimated', status: 'estimated', exercises: [{ exerciseId: 'deadlift', sets: [{ reps: 6, weightKg: 80 }, { reps: 6, weightKg: 80 }] }] },
  { id: 'demo-session-22', date: '2026-11-22', start: '08:00', end: '08:36', durationMin: 36, activityKcal: 190, type: 'walk', source: 'apple_health', status: 'synced', exercises: [] },
  { id: 'demo-session-23', date: '2026-11-23', start: '18:00', end: '18:52', durationMin: 52, activityKcal: 310, type: 'strength', source: 'apple_health', status: 'synced', originalWorkoutId: 'ah-w23', exercises: [{ exerciseId: 'lateral_raise', sets: [{ reps: 12, weightKg: 6 }, { reps: 12, weightKg: 6 }] }] },
  { id: 'demo-session-25', date: '2026-11-25', start: '17:00', end: '17:42', type: '骑行', durationMin: 42, activityKcal: 330, source: 'user_confirmed', status: 'confirmed', exercises: [] },
  { id: 'demo-session-26', date: '2026-11-26', start: '18:10', end: '19:05', durationMin: 55, activityKcal: 340, type: 'strength', source: 'user_confirmed', status: 'confirmed', originalWorkoutId: 'ah-w26', user_confirmed_fields: ['exercises'], exercises: [{ exerciseId: 'pull_up', sets: [{ reps: 8 }, { reps: 7 }, { reps: 6 }] }, { exerciseId: 'bench_press', sets: [{ reps: 8, weightKg: 50, rpe: 8 }, { reps: 8, weightKg: 50, rpe: 8 }] }] }
];
export const dayLogs = Array.from({ length: 14 }, (_, index) => {
  const date = `2026-11-${String(index + 13).padStart(2, '0')}`;
  const session = trainingSessions.find(item => item.date === date);
  return {
    date,
    confirmedWorkout: !!session && session.status === 'confirmed',
    confirmedRest: [1, 6, 11].includes(index),
    estimatedSessionIds: session?.status === 'estimated' ? [session.id] : [],
    appleHealthPendingIds: date === '2026-11-18' ? ['demo-batch-pending'] : [],
    syncedSessionIds: session?.status === 'synced' ? [session.id] : [],
    hasReliableActivityEvidence: !!session
  };
});
export const snacks = [{
  id: 'demo-snack-1', local_date: '2026-11-26', local_time: '16:20', meal_label: '加餐',
  foodItems: [{
    id: 'demo-snack-food', name: '香蕉', nutrients: {
      kcal: { value: 105, unit: 'kcal', source: 'database' },
      protein: { value: 1.3, unit: 'g', source: 'database' },
      carbs: { value: 27, unit: 'g', source: 'confirmed' },
      fat: { value: null, unit: 'g', source: 'unknown' }
    }
  }]
}, {
  id: 'demo-snack-photo', local_date: '2026-11-25', local_time: '15:10', meal_label: '加餐',
  foodItems: [{ id: 'demo-photo-food', name: '坚果', nutrients: {
    kcal: { value: 160, unit: 'kcal', source: 'photo' }, protein: { value: 5, unit: 'g', source: 'photo' },
    carbs: { value: 6, unit: 'g', source: 'photo' }, fat: { value: 14, unit: 'g', source: 'photo' }
  } }]
}];
export const ahBackfillBatches = [
  { id: 'demo-batch-corrected', date: '2026-11-23', state: 'corrected', source: 'apple_health', originalWorkoutId: 'ah-w23', candidateSessionIds: ['demo-session-23'], before: { duration: 50, active_kcal: 275 }, after: { duration: 52, active_kcal: 310 }, history: [{ at: '2026-11-24T09:00:00+04:00', field: 'active_kcal', before: 275, after: 310, source: 'apple_health' }] },
  { id: 'demo-batch-backfilled', date: '2026-11-20', state: 'backfilled', source: 'apple_health', originalWorkoutId: 'demo-ah-20', candidateSessionIds: ['demo-session-20'], before: { duration: 48 }, after: { duration: 50 } },
  { id: 'demo-batch-conflict', date: '2026-11-18', state: 'conflict', source: 'apple_health', candidateSessionIds: ['demo-session-18a', 'demo-session-18b'] },
  { id: 'demo-batch-pending', date: '2026-11-18', state: 'pending', source: 'apple_health', candidateSessionIds: [] }
];
export const ahHistory = ahBackfillBatches.flatMap(batch =>
  (batch.history || []).map(item => ({ ...item, batchId: batch.id, date: batch.date }))
);

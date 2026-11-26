import { EXERCISE_MAP, MUSCLE_NAMES, SECONDARY_WEIGHT } from './muscle-map.js';

export const RULES = Object.freeze({
  baseWindowHours: {
    chest: 72, back: 72, shoulders: 48, biceps: 36, triceps: 36,
    core: 48, glutes: 72, quads: 72, hamstrings: 48, calves: 36
  },
  setBands: [
    { below: 4, factor: 0.85 }, { below: 7, factor: 1 },
    { below: 10, factor: 1.2 }, { below: Infinity, factor: 1.4 }
  ],
  maxSessionWindowHours: 120,
  maxCombinedWindowHours: 168,
  recentBelowHours: 12,
  recoveringThrough: 0.75,
  lookbackDays: 7,
  secondaryWeight: SECONDARY_WEIGHT,
  rpeCoverageForConfidence: 0.8,
  rpeHighThreshold: 9,
  rpeHighFactor: 1.15,
  rpeLowThreshold: 6,
  rpeLowFactor: 0.9,
  rpeMissingFactor: 1,
  missingRpeConfidencePenalty: 1
});

const sessionTime = session => session.startAt
  || (session.start ? `${session.date}T${session.start}:00+04:00` : null);
const sourceOf = session => session.source || session.data_source || 'unknown';
const statusOf = session => session.status || session.session_state || '';
const isEstimated = session => sourceOf(session) === 'estimated'
  || statusOf(session) === 'estimated' || session.estimated === true;
const explicitBodyweight = set => set.bodyweight === true || set.isBodyweight === true
  || set.weightType === 'bodyweight' || set.loadType === 'bodyweight';
const hasCompleteSet = set => Number.isFinite(set.reps)
  && (Number.isFinite(set.weightKg) || explicitBodyweight(set));
const empty = id => ({
  muscle: id, muscleId: id, status: 'unknown', lastDate: null, hoursSince: null,
  exercises: [], sets: 0, effectiveSets: 0, volumeKg: null, windowHours: null,
  reasons: ['近期未发现可用训练记录'], confidence: 'low', source: []
});
const confidenceRank = { low: 0, medium: 1, high: 2 };
const lowerConfidence = level => Object.keys(confidenceRank)
  .find(key => confidenceRank[key] === Math.max(0, confidenceRank[level] - 1));

export function estimateMuscleRecovery(sessions = [], now = new Date(), options = {}) {
  const nowMs = new Date(now).getTime();
  const maxAgeMs = (options.lookbackDays ?? RULES.lookbackDays) * 24 * 36e5;
  const groups = Object.fromEntries(Object.keys(MUSCLE_NAMES).map(id => [id, new Map()]));
  const unknownSessions = [];

  for (const session of sessions) {
    const start = sessionTime(session);
    const timestamp = start ? new Date(start).getTime() : NaN;
    if (Number.isFinite(timestamp) && timestamp > nowMs) continue;
    if (!start || !Number.isFinite(timestamp)) unknownSessions.push(session);
    const sessionKey = session.id || `${session.date || 'no-date'}|${start || 'no-start'}`;
    for (const exercise of session.exercises || []) {
      const mapping = EXERCISE_MAP[exercise.exerciseId];
      if (!mapping) {
        unknownSessions.push({ session, exercise });
        continue;
      }
      const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
      for (const [muscle, weight] of [
        ...mapping.primary.map(id => [id, 1]),
        ...mapping.secondary.map(id => [id, SECONDARY_WEIGHT])
      ]) {
        const key = `${sessionKey}|${muscle}`;
        const group = groups[muscle].get(key) || {
          session, timestamp, exercises: [], rawSets: [], effectiveSets: 0,
          rpes: [], sources: new Set([sourceOf(session)]), invalidStart: !start || !Number.isFinite(timestamp),
          estimated: isEstimated(session)
        };
        group.exercises.push(exercise.name || mapping.name || exercise.exerciseId);
        group.rawSets.push(...sets);
        group.effectiveSets += sets.length * weight;
        group.rpes.push(...sets.map(set => set.rpe).filter(Number.isFinite));
        group.sources.add(sourceOf(session));
        group.estimated ||= isEstimated(session);
        groups[muscle].set(key, group);
      }
    }
  }

  return Object.keys(MUSCLE_NAMES).map(muscle => {
    const sessionsForMuscle = [...groups[muscle].values()]
      .sort((a, b) => (a.timestamp || -Infinity) - (b.timestamp || -Infinity));
    if (!sessionsForMuscle.length) {
      const result = empty(muscle);
      if (unknownSessions.length) {
        result.reasons = ['存在未识别动作，肌群归属不完整'];
        result.confidence = 'medium';
      }
      return result;
    }
    const latest = sessionsForMuscle.at(-1);
    const latestAge = Number.isFinite(latest.timestamp) ? nowMs - latest.timestamp : null;
    const sets = latest.rawSets.length;
    const completeSets = latest.rawSets.length > 0 && latest.rawSets.every(hasCompleteSet);
    const trustedSource = ['user_confirmed', 'synced'].includes(sourceOf(latest.session))
      || statusOf(latest.session) === 'synced';
    const inLookback = latestAge !== null && latestAge <= maxAgeMs;
    const hoursSince = latestAge === null ? null : latestAge / 36e5;
    const rpe = latest.rpes.length ? latest.rpes.reduce((sum, value) => sum + value, 0) / latest.rpes.length : null;
    const rpeCoverage = sets ? latest.rpes.length / sets : 0;
    const intensityFactor = rpe == null ? RULES.rpeMissingFactor
      : rpe >= RULES.rpeHighThreshold ? RULES.rpeHighFactor
        : rpe <= RULES.rpeLowThreshold ? RULES.rpeLowFactor : 1;
    const setBand = RULES.setBands.find(band => latest.effectiveSets < band.below) || RULES.setBands.at(-1);
    const ownWindow = Math.min(RULES.maxSessionWindowHours,
      RULES.baseWindowHours[muscle] * setBand.factor * intensityFactor);
    const recent = sessionsForMuscle.filter(item => Number.isFinite(item.timestamp)
      && nowMs - item.timestamp <= maxAgeMs);
    let windowHours = ownWindow;
    for (let index = recent.length - 2; index >= 0; index--) {
      const prior = recent[index];
      const gap = (latest.timestamp - prior.timestamp) / 36e5;
      const priorBand = RULES.setBands.find(band => prior.effectiveSets < band.below) || RULES.setBands.at(-1);
      const priorWindow = Math.min(RULES.maxSessionWindowHours,
        RULES.baseWindowHours[muscle] * priorBand.factor);
      windowHours += priorWindow * Math.max(0, 1 - gap / priorWindow) * 0.35;
    }
    windowHours = Math.min(RULES.maxCombinedWindowHours, windowHours);

    const reasons = [];
    let confidence = 'high';
    let status = 'unknown';
    if (latest.invalidStart) {
      reasons.push('训练缺少有效开始时间，无法可靠排序');
      confidence = 'low';
    }
    if (!completeSets) {
      reasons.push('组数、次数或重量/明确自重标记不完整');
      confidence = 'low';
    }
    if (!trustedSource) {
      reasons.push('记录来源未确认或未同步，不能据此判定窗口已通过');
      confidence = 'low';
    }
    if (latest.estimated) {
      reasons.push('估算来源可信度封顶为低');
      confidence = 'low';
    }
    if (!inLookback) {
      reasons.push(`训练超过 ${options.lookbackDays ?? RULES.lookbackDays} 天回看期，状态未知`);
      confidence = 'low';
    }
    if (unknownSessions.length) {
      reasons.push('存在未识别动作，肌群归属不完整');
      confidence = lowerConfidence(confidence);
    }
    if (rpeCoverage < RULES.rpeCoverageForConfidence) {
      reasons.push(`RPE 覆盖率 ${Math.round(rpeCoverage * 100)}%，按 1.0 缺失强度系数并降低一级可信度`);
      confidence = lowerConfidence(confidence);
    }
    if (rpe != null) reasons.push(`平均 RPE ${rpe.toFixed(1)}，强度系数 ${intensityFactor}`);
    if (latest.effectiveSets !== sets) reasons.push(`按有效组数 ${latest.effectiveSets}（辅助肌群系数 ${SECONDARY_WEIGHT}）计算窗口`);
    if (!latest.invalidStart && inLookback && completeSets && trustedSource && !latest.estimated) {
      if (hoursSince < RULES.recentBelowHours) status = 'recent';
      else if (hoursSince < windowHours * RULES.recoveringThrough) status = 'recovering';
      else if (hoursSince < windowHours) status = 'near';
      else status = 'window_passed';
    }
    if (!reasons.length) reasons.push(`按${MUSCLE_NAMES[muscle]}基础窗口 ${RULES.baseWindowHours[muscle]} 小时计算`);
    const volumeKnown = latest.rawSets.every(set => Number.isFinite(set.reps) && Number.isFinite(set.weightKg));
    return {
      muscle, muscleId: muscle, status, lastDate: latest.session.date || latest.session.startAt || null,
      hoursSince, exercises: [...new Set(latest.exercises)], sets,
      effectiveSets: latest.effectiveSets,
      volumeKg: volumeKnown ? latest.rawSets.reduce((total, set) => total + set.reps * set.weightKg, 0) : null,
      windowHours, reasons, confidence, source: [...new Set(sessionsForMuscle.flatMap(item => [...item.sources]))],
      reps: latest.rawSets.reduce((total, set) => total + (Number.isFinite(set.reps) ? set.reps : 0), 0),
      intensityFactor
    };
  });
}

export const getMuscleRecovery = estimateMuscleRecovery;

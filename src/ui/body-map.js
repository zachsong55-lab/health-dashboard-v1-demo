// Body artwork: Open-Muscle-Map (MIT), vendored in src/assets/body/ — see src/assets/body/ATTRIBUTION.md.
// This module only layers, colours and wires that geometry; recovery states come from the caller.
import { BODY_PATHS, VIEW_BOXES } from '../assets/body/body-paths.js';
import { MUSCLE_NAMES } from '../domain/muscle-map.js';

const NS = 'http://www.w3.org/2000/svg';
const stateNames = { recent: '近期训练', recovering: '恢复过程中', near: '接近恢复窗口', window_passed: '估计恢复窗口已结束', unknown: '恢复状态未知' };
const assetViews = { front: 'front', back: 'rear' };
const HIT_STROKE = 14; // extra tap margin, in viewBox units (half of it falls outside each muscle)

const svgNode = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
};
// Region transforms carry a scale, so stroke widths must be converted into each region's local units.
const scaleOf = transform => Number(/scale\(\s*([\d.]+)/.exec(transform)?.[1]) || 1;

function drawPaths(transform, paths, attrs) {
  const group = svgNode('g', { transform });
  paths.forEach(([d, pathTransform]) => {
    const path = svgNode('path', { d, ...attrs });
    if (pathTransform) path.setAttribute('transform', pathTransform);
    group.append(path);
  });
  return group;
}

export function createBodyMap(view, recovery, onSelect, selectedMuscle) {
  const asset = BODY_PATHS[assetViews[view]];
  const svg = svgNode('svg', { viewBox: VIEW_BOXES[assetViews[view]], role: 'group', 'aria-label': `${view === 'front' ? '正面' : '背面'}肌肉恢复图`, class: 'body-map-svg' });

  const hatchId = `unknown-hatch-${view}`;
  const defs = svgNode('defs');
  // Pattern units are region-local (about 3 per viewBox unit).
  const pattern = svgNode('pattern', { id: hatchId, width: 26, height: 26, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  pattern.append(svgNode('rect', { width: 26, height: 26, class: 'hatch-base' }), svgNode('line', { x1: 13, y1: 0, x2: 13, y2: 26, class: 'hatch-line' }));
  defs.append(pattern); svg.append(defs);

  const silhouette = svgNode('g', { class: 'body-silhouette', 'aria-hidden': 'true' });
  asset.silhouette.forEach(part => silhouette.append(drawPaths(part.transform, part.paths)));
  svg.append(silhouette);

  const neutral = region => {
    const node = drawPaths(region.transform, region.paths, { class: 'muscle-neutral' });
    node.setAttribute('aria-hidden', 'true');
    return node;
  };
  const neutralRegions = asset.regions.filter(region => region.group === null);
  neutralRegions.filter(region => region.kind !== 'tendon').forEach(region => svg.append(neutral(region)));

  const groups = new Map();
  asset.regions.filter(region => region.group !== null).forEach(region => {
    if (!groups.has(region.group)) groups.set(region.group, []);
    groups.get(region.group).push(region);
  });

  // All enlarged hit areas sit in one layer underneath every coloured fill, so a tap on a
  // visible muscle can never be taken by a neighbouring group's margin.
  const hitLayer = svgNode('g', { class: 'muscle-hit-layer', 'aria-hidden': 'true' });
  svg.append(hitLayer);

  groups.forEach((regions, muscle) => {
    const status = recovery.find(row => row.muscleId === muscle)?.status || 'unknown';
    const selected = muscle === selectedMuscle;
    const hits = svgNode('g', { class: 'muscle-hit-group', 'data-muscle-hit': muscle });
    const target = svgNode('g', { class: `muscle-target${selected ? ' is-selected' : ''}`, 'data-muscle': muscle, 'data-status': status, role: 'button', tabindex: 0, 'aria-label': `${MUSCLE_NAMES[muscle]}，${stateNames[status]}`, 'aria-pressed': String(selected) });
    regions.forEach(region => {
      hits.append(drawPaths(region.transform, region.paths, { class: 'muscle-hit-area', 'stroke-width': HIT_STROKE / scaleOf(region.transform) }));
      const fills = drawPaths(region.transform, region.paths, { class: `muscle-fill status-${status}` });
      if (status === 'unknown') fills.querySelectorAll('path').forEach(path => path.setAttribute('fill', `url(#${hatchId})`));
      target.append(fills);
    });
    hits.addEventListener('click', () => onSelect(muscle));
    target.addEventListener('click', () => onSelect(muscle));
    target.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(muscle); } });
    hitLayer.append(hits);
    svg.append(target);
  });

  // Tendons overlay the muscles they attach to; they never receive pointer events.
  neutralRegions.filter(region => region.kind === 'tendon').forEach(region => svg.append(neutral(region)));
  return svg;
}

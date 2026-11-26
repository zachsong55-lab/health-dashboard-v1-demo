const NS = 'http://www.w3.org/2000/svg';
const partNames = { chest: '胸', back: '背', shoulders: '肩', biceps: '肱二头肌', triceps: '肱三头肌', core: '核心', glutes: '臀', quads: '股四头肌', hamstrings: '腘绳肌', calves: '小腿' };
const stateNames = { recent: '近期训练', recovering: '恢复过程中', near: '接近恢复窗口', window_passed: '估计恢复窗口已结束', unknown: '恢复状态未知' };
const marks = { recent: '近', recovering: '恢', near: '近窗', window_passed: '估', unknown: '未知' };
const svgNode = (tag, attrs = {}) => { const node = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value)); return node; };
const paths = {
  front: {
    shoulders: ['M109 79 Q99 72 91 82 L98 105 Q110 108 121 100Z','M191 79 Q201 72 209 82 L202 105 Q190 108 179 100Z'],
    chest: ['M124 91 Q137 83 149 92 L148 119 Q134 122 123 112Z','M151 92 Q163 83 176 91 L177 112 Q166 122 152 119Z'],
    biceps: ['M96 108 Q103 103 111 108 L118 140 Q109 147 101 139Z','M204 108 Q197 103 189 108 L182 140 Q191 147 199 139Z'],
    core: ['M132 123 Q150 128 168 123 L165 164 Q150 170 135 164Z'],
    quads: ['M128 176 Q139 171 148 178 L146 229 Q137 235 126 229Z','M172 176 Q161 171 152 178 L154 229 Q163 235 174 229Z'],
    calves: ['M128 244 Q137 239 145 244 L142 283 Q135 289 127 284Z','M172 244 Q163 239 155 244 L158 283 Q165 289 173 284Z']
  },
  back: {
    shoulders: ['M109 79 Q99 72 91 82 L98 105 Q110 108 121 100Z','M191 79 Q201 72 209 82 L202 105 Q190 108 179 100Z'],
    back: ['M127 89 Q139 83 149 91 L148 144 Q139 151 130 142Z','M173 89 Q161 83 151 91 L152 144 Q161 151 170 142Z'],
    triceps: ['M96 108 Q103 103 111 108 L118 140 Q109 147 101 139Z','M204 108 Q197 103 189 108 L182 140 Q191 147 199 139Z'],
    glutes: ['M132 158 Q141 154 149 160 L148 178 Q139 183 131 176Z','M168 158 Q159 154 151 160 L152 178 Q161 183 169 176Z'],
    hamstrings: ['M128 184 Q138 179 148 185 L146 229 Q137 235 126 229Z','M172 184 Q162 179 152 185 L154 229 Q163 235 174 229Z'],
    calves: ['M128 244 Q137 239 145 244 L142 283 Q135 289 127 284Z','M172 244 Q163 239 155 244 L158 283 Q165 289 173 284Z']
  }
};

export function createBodyMap(view, recovery, onSelect) {
  const svg = svgNode('svg', { viewBox: '0 0 300 310', role: 'group', 'aria-label': `${view === 'front' ? '正面' : '背面'}肌肉恢复图`, class: 'body-map-svg' });
  const defs = svgNode('defs');
  const pattern = svgNode('pattern', { id: `unknown-hatch-${view}`, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  pattern.append(svgNode('rect', { width: 7, height: 7, fill: '#e4e9e7' }), svgNode('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#687872', 'stroke-width': 2 })); defs.append(pattern); svg.append(defs);
  const silhouette = [
    'M142 18 Q150 11 158 18 L164 29 162 39 156 45 156 53 Q169 56 180 62 L197 71 207 83 222 116 Q224 122 217 126 L212 127 198 101 192 98 197 126 190 145 183 159',
    'L181 225 187 270 Q189 280 184 284 L174 286 168 276 157 231 153 231 142 276 Q140 286 134 286 L124 284 Q120 280 123 270 L129 225 127 160',
    'L120 145 113 126 108 98 102 101 88 127 82 126 Q75 122 78 116 L93 83 103 71 120 62 Q131 56 144 53 L144 45 138 39 136 29Z'
  ].join(' ');
  svg.append(svgNode('path', { d: silhouette, class: 'body-silhouette' }));
  svg.append(svgNode('path', { d: 'M91 82 L77 113 69 143 70 158 76 161 81 153 84 141 99 112 M209 82 L223 113 231 143 230 158 224 161 219 153 216 141 201 112 M124 284 Q120 292 114 294 L105 296 Q102 299 108 301 L136 300 Q142 299 140 292 M176 284 Q180 292 186 294 L195 296 Q198 299 192 301 L164 300 Q158 299 160 292', class: 'body-silhouette' }));
  // Neck, shoulder/arm contour, pelvis, hands and feet remain visible behind the muscle regions.
  svg.append(svgNode('path', { d: 'M144 47 L144 59 M156 47 L156 59 M128 158 Q150 169 172 158 M129 225 L148 229 M152 229 L171 225 M124 284 Q132 290 140 285 M160 285 Q168 290 176 284', class: 'body-detail-line' }));
  Object.entries(paths[view]).forEach(([muscle, regions]) => {
    const status = recovery.find(row => row.muscleId === muscle)?.status || 'unknown';
    regions.forEach((d, index) => {
      const group = svgNode('g', { class: 'muscle-target', 'data-muscle': muscle, 'data-status': status, tabindex: 0, role: 'button', 'aria-label': `${partNames[muscle]}，${stateNames[status]}，${index ? '右侧' : '左侧'}` });
      group.append(svgNode('path', { d, class: `muscle-hit status-${status}`, 'data-side': index ? 'right' : 'left' }));
      group.append(svgNode('path', { d, class: 'muscle-hit-area', 'aria-hidden': 'true' }));
      const bounds = { shoulders: [104 + index * 92, 93], chest: [136 + index * 28, 104], biceps: [106 + index * 88, 125], triceps: [106 + index * 88, 125], core: [150, 146], back: [138 + index * 24, 118], glutes: [140 + index * 20, 169], quads: [137 + index * 26, 207], hamstrings: [137 + index * 26, 207], calves: [135 + index * 30, 266] }[muscle];
      const label = svgNode('text', { x: bounds[0], y: bounds[1], 'text-anchor': 'middle', class: `muscle-mark mark-${status}`, 'aria-hidden': 'true' }); label.textContent = marks[status]; group.append(label);
      group.addEventListener('click', () => onSelect(muscle));
      group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(muscle); } });
      svg.append(group);
    });
  });
  return svg;
}

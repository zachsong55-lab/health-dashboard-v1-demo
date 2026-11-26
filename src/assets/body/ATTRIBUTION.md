# Body muscle artwork attribution

- Asset: Open-Muscle-Map, male front + rear muscle map (`muscle-map/male-muscle-map.svg`)
- Source: https://github.com/PerspicaciousGuy/Open-Muscle-Map
- Commit: df85e6c6cfecb14f66fd0b39a8d409a417cc6407 (fetched 2026-11-27)
- License: MIT, Copyright (c) 2026 PerspicaciousGuy (full text in ./LICENSE)
- Security audit before vendoring: static SVG only; no `<script>`, `<foreignObject>`, `<image>`, event-handler attributes or external URLs (only the SVG namespace).
- Changes made here: extracted path geometry and transforms into `body-paths.js`; dropped the original gradients, titles, controller JS and colours; added this app's own muscle-group ids (`group`) and per-view crop boxes. Colours, silhouette tone, interaction and labels are this app's own.
- Upstream note: the artwork is a stylized fitness diagram ("schematic"), not a dissection-grade atlas. The dashboard's recovery states are rule-based estimates, not medical findings.

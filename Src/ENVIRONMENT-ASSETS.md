# Environment assets

All scenery meshes and textures in this pass are generated locally by `static/js/garden.js` and `static/js/materials.js`. No model, texture, screenshot or asset from a reference game was imported. Mockup images are review references only and are never rendered into the 3D scene.

| Asset family | Construction | Use |
| --- | --- | --- |
| Weathered masonry | Seeded bevelled boxes, three silhouette variants, procedural albedo/normal/roughness | Broken gates, walls, steps, pillars, rubble |
| Shallow shelves | Shared dodecahedra, overlapping submerged lobes | Connect architecture and board foundations |
| Vegetation | Shared leaf, stem and petal geometry, clustered by authored shores | Moss, ivy, reeds, underwater plants, lily patches |
| Flowering trees | Branches, irregular leaf masses and pink/purple blossoms | Garden silhouette |
| Winter kit | Fir boughs, snow pillows, extruded irregular snow caps, cones and polygon floes | Frost environment; no summer flowers |
| Water | Standard material plus depth/shore texture, animated multiscale modulation and bounded direct glint | All skins |

These are original procedural project assets; no third-party asset licence is needed for them. This document does not grant a new licence to the repository. Three.js retains its MIT licence in `static/vendor/THREE-LICENSE.txt`.

Environment presets are in `Bloxorz.environments`. Placement is deterministic, based on authored normalized level extents and a deterministic numeric hash; opening menus does not randomize placement. Static floor and scenery use instancing. Each rebuilt batch owns a geometry clone that is disposed on replacement. Shared source geometry/materials remain cached. Shore textures and water material are disposed on replacement; water uses one existing animation loop.

## Modular architecture refinement

The temple kit now includes a 16-sided lathed stone profile (plinth, tapered shaft with eight shallow flutes, neck and capital), sealed cut faces, bevelled wedge-shaped arch stones, broken wall panels and fallen cornice profiles. All modules are authored in the repository and share the existing stone textures. Snow caps follow the same module surfaces. The arch is deliberately interrupted but remains attached to its supporting pier. No downloaded model/texture or additional licence was introduced.

Shadow maps are reused while only water moves; block matrix, bridge state, board rebuild and theme rebuild invalidate the shadow map. Render resolution and DPR limits are unchanged.

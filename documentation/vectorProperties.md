# Altitude Mode

> `olcs_altitudeMode: 'abolute' | 'clampToGround' | 'relativeToGround' | 'clampToTerrain' | 'clampToTile' | 'relativeToTerrain' | 'relativeToTile'`
> some are new in v6, see the table below.

the altitude mode determines how the coordinates of a geometry are interpreted during rendering.
the following outlines the different altitude modes and how the layout of the geometry determines
their applicability.

| cesium height reference | vcmap 5.0 equivalent          | layout is XY                                                                                                                                                                                                                                                                            | layout is XYZ                                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NONE                    | absolute                      | if ground level is provided render absolute else warn and render clamp to ground                                                                                                                                                                                                        | if ground level is provided, render at said height, else rendered absolutely                                                                                                                                                                                          |
| CLAMP_TO_GROUND         | clampToGround                 | clamp to scene                                                                                                                                                                                                                                                                          | clamp to scene                                                                                                                                                                                                                                                        |
| CLAMP_TO_TERRAIN        | clampToTerrain (new in v6)    | clamp to terrain                                                                                                                                                                                                                                                                        | clamp to terrain                                                                                                                                                                                                                                                      |
| CLAMP_TO_3D_TILE        | clampToTile (new in v6)       | clamp to tiles                                                                                                                                                                                                                                                                          | clampt to tiles                                                                                                                                                                                                                                                       |
| RELATIVE_TO_GROUND      | relativeToGround              | if providing an offset & ground level, render at offset + gound level. if only offset is provided, relative to ground using an origin and treat the offset as Z: `(groundLevel ?? heightOfOrigin) + heightAboveGround`. if no offset is provided, height above ground will be set to 0. | if ground level is provided, render each vertex at ground level + Z. else render each vertex at calculated ground + Z .calculte ground level based on provided property (min, max, median, center mass): `(groundLevel ?? heightOfOrigin) + (heightAboveGround ?? Z)` |
| RELATIVE_TO_TERRAIN     | relativeToTerrain (new in v6) | as above                                                                                                                                                                                                                                                                                | as above                                                                                                                                                                                                                                                              |
| RELATIVE_TO_3D_TILE     | relativeToTile (new in v6)    | as above                                                                                                                                                                                                                                                                                | as above                                                                                                                                                                                                                                                              |

# Ground Level

> `olcs_groundLevel: number`

ground level is a fixed number which acts as the _absolute_ height of the ground level.
if provided, a geometry which is not clamped, will be rendered at said height. this
has no effect for clamped geometries.

this property is mandatory to render 2D layout with an altitude mode `absolute`.

if provided with an altitude mode `relativeTo*`, the clamped origin will not be used
to adjust the height of the geometry to the current scene.

# Height Above Ground

> `olcs_heightAboveGround: number`

height above ground is a _relative_ height to the ground. if provided, a relative geometry will be
rendered at this height relative to the provided ground source (ground, terrain, 3d tile or `olcs_groundLevel`).
this only has an effect on geometries with a `relativeTo*` altitude mode.

if this property is not provided for 2d layouts, it will be treated as 0 in `relativeTo*` altitude modes.

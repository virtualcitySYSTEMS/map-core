# Clipping

The VC Map provides two different API's for clipping layers and/or the globe.
Both [Clipping Objects](#clipping-objects) and [Clipping Polygon Objects](#clipping-polygon-objects) are wrappers around Cesium's clipping API.
Please refer to the notes for limitations!

# Clipping Objects

Clipping Objects use Cesium [ClippingPlane](https://cesium.com/learn/cesiumjs/ref-doc/ClippingPlane.html)s to clip 3D models, tilesets or the globe.

The ClippingObject is a container for a Cesium [ClippingPlaneCollection](https://cesium.com/learn/cesiumjs/ref-doc/ClippingPlaneCollection.html).
The container holds information on the targeted Cesium objects, defined by:

- layerNames for [CesiumTilesetLayer](../src/layer/cesiumTilesetLayer.ts)
- entities for [DataSourceLayer](../src/layer/dataSourceLayer.ts)
- terrain flag to cut the globe

Adding a ClippingObject to the [ClippingObjectManager](../src/util/clipping/clippingObjectManager.ts) applies the
objects ClippingPlaneCollection to its targets. Once added, changes to the targets of the object are tracked.
To update the ClippingPlaneCollection or its definitions, you must trigger an update by setting the clippingPlaneCollection
property to the new definition.

The ClippingObjectManager takes care to only apply a single [ClippingObject](../src/util/clipping/clippingObject.ts) to a target, such as a Cesium3DTileset or an Entity.
ClippingObjects with the same target are overwritten in the order they were added to the manager.
Exclusive ClippingObjects take always precedence, even if a default ClippingObject is added after.

Notes on limitations:

1. Convex vs. Concave Shapes
   - **Limitation**: ClippingPlanes are inherently convex. They cannot directly define concave clipping volumes or shapes with internal recesses.
   - **Effect**: Attempting to create a concave clipping region with ClippingPlanes results in the clipping volume being treated as the convex hull of the defined planes. This can unintentionally include areas outside the intended concave region.
   - **Mitigation**:
     Simplify concave geometry to avoid relying on clipping to handle such cases.
2. Holes
   - **Limitation**: ClippingPlanes do not natively support regions with holes or excluded areas within a clipping volume.
   - **Effect**: Any geometry within the clipping plane boundaries is fully clipped, as ClippingPlanes cannot differentiate between an outer boundary and inner "cut-out" areas.
   - **Mitigation**:
     Simplify geometry with holes to avoid relying on clipping to handle such cases.
3. Number of Clipping Planes
   - **Limitation**: Cesium supports a limited number of ClippingPlanes per ClippingPlaneCollection. While there is no hardcoded limit, the typical practical limit is around 6–8 planes in a single collection.
   - **Effect**: Exceeding this number can lead to performance degradation due to increased GPU workload. Shader programs must account for each additional plane, which impacts rendering efficiency.
   - **Mitigation**:
     Use only as many planes as necessary.
     Combine planes logically if possible (e.g., use bounding volumes or simpler shapes for clipping instead of multiple planes).
4. Precision Issues
   - **Limitation**: As with ClippingPolygons, floating-point precision can affect ClippingPlanes. Precision issues are most evident when:
     Clipping planes are used far from the globe's center.
     Geometry being clipped is very small (e.g., smaller than 5–10 meters).
   - **Effect**: Planes may appear to misalign or incorrectly clip geometry. Small objects may be disproportionately affected, especially near poles or at high altitudes.
   - **Mitigation**:
     Keep geometry near the equator or flatten coordinates locally.
     Avoid applying clipping to extremely small objects.
5. Performance Degradation
   - **Limitation**: Each ClippingPlane adds a layer of complexity to the GPU shaders. Rendering performance starts to degrade as the number of planes increases, especially with more than 6–8 planes.
   - **Effect**: Frame rate drops and visual artifacts may appear, particularly on low-end GPUs or with large, complex geometry.
   - **Mitigation**:
     Limit the number of clipping planes in a collection.
6. Interaction with Complex Geometries
   - **Limitation**: ClippingPlanes work best with simple geometries. Complex or highly detailed geometries can introduce issues, such as unexpected clipping behavior or artifacts along the clipped edges.
   - **Effect**: Artifacts or incomplete clipping may appear, especially at the intersections of planes or for geometries with very dense vertex distributions.
   - **Mitigation**:
     Simplify the geometry where possible.
     Use fewer planes to reduce the likelihood of intersecting artifacts.
7. Global Rendering Constraints
   - **Limitation**: Cesium applies global rendering constraints for ClippingPlanes:
     Planes are infinite, so they clip all geometry in their path unless properly constrained (e.g., using bounding volumes).
     Rendering artifacts can occur if the planes are misaligned with geometry or applied globally without specific constraints.
   - **Effect**: Unintended clipping of nearby objects or misaligned edges may occur if planes are not carefully configured.
   - **Mitigation**:
     Use bounding volumes or apply planes selectively to specific geometries.

# Clipping Polygon Objects

Clipping Polygon Objects use Cesium [ClippingPolygon](https://cesium.com/learn/cesiumjs/ref-doc/ClippingPolygon.html)s to hide a geographic region in 3D tilesets or the globe.
ClippingPolygons support complex clipping shapes, including concave polygons, without the convexity limitations associated with ClippingPlanes.
Also, ClippingPolygons enable to define multiple clip regions instead of just one using ClippingPlanes.

Each ClippingPolygonObject describes a region to be clipped and holds information on the targeted Cesium objects, defined by:

- layerNames for [CesiumTilesetLayer](../src/layer/cesiumTilesetLayer.ts)
- terrain flag to cut the globe

> Note: Cesium Entities cannot be targeted by ClippingPolygonObjects. Use ClippingObjects with ClippingPlanes instead.

The [VcsApp](./vcsApp.md) has a clippingPolygons collection serializing and deserializing ClippingPolygonObject definitions.
The ClippingPolygonObjectCollection tracks the map collection and adds listener to:

- map state to apply ClippingPolygons on activation of a CesiumMap
- change of visualizations to apply or remove ClippingPolygons to/from added/removed Cesium3DTilests

The ClippingPolygonObjectCollection also takes care of changes to all managed ClippingPolygonObjects:

- change of state (activation or deactivation)
- change of coordinates will update ClippingPolygon
- change of terrain flag will apply or remove ClippingPolygon from globes
- change of layerNames will apply or remove ClippingPolygon to/from added/removed Cesium3dTilesets

If you want to clip a region from a tileset layer, you can simply configure a polygonal linear ring of coordinates and additional options in the VC Map configuration:

```json
{
  "clippingPolygons": [
    {
      "name": "MyClippingPolygon",
      "activeOnStartup": true,
      "terrain": true,
      "layerNames": ["layerA", "layerB"],
      "coordinates": [
        [13.376009, 52.50947],
        [13.376088, 52.50905],
        [13.376154, 52.50906],
        [13.376076, 52.50948],
        [13.376009, 52.50947]
      ]
    }
  ]
}
```

Notes on limitations:

1. Convex vs. Concave Shapes
   - **Limitation**: ClippingPolygons support both convex and concave shapes without imposing specific limitations on geometry. However, polygons with very high vertex counts or complex boundaries may still introduce minor performance overhead during clipping.
   - **Effect**: Concave polygons are processed accurately, but large or highly detailed polygons can increase computation times, especially when applied to large datasets or when using multiple clipping regions.
   - **Mitigation**:
     Avoid defining polygons with an unnecessarily high number of vertices.
     Simplify complex geometries to optimize rendering performance.
2. Holes
   - **Limitation**: Limitation: ClippingPolygons do not natively support polygons with holes, as the API does not allow for a hierarchy of positions to define both outer boundaries and interior exclusions.
   - **Effect**: Polygons with intended holes are treated as solid shapes, with the holes being ignored.
   - **Mitigation**:
     Only use the outer linear ring of polygons to define clipping regions.
3. Number of Clipping Polygons
   - **Limitation**: Cesium can handle a limited number of ClippingPolygons per scene. While there is no explicit hard limit, practical performance and rendering issues typically appear with more than 10–20 polygons, depending on their complexity and the GPU’s capabilities.
   - **Effect**: Exceeding this number can lead to frame rate drops, aggregation of smaller polygons, or even missing polygons. Each additional polygon adds computational complexity to the shaders.
   - **Mitigation**: Reduce the number of polygons by combining adjacent shapes or using simpler geometries.
4. Precision Issues
   - **Limitation**: Clipping relies on floating-point calculations, which lose accuracy for small polygons or polygons far from the globe’s center. Polygons smaller than 5–10 meters in diameter, or those located near the poles or high altitudes, are particularly vulnerable.
   - **Effect**: Small polygons might appear distorted, aggregated, or incorrectly clipped. Issues are more pronounced in areas with high curvature or numerical instability.
   - **Mitigation**: Ensure polygons are sufficiently large (e.g., 10–20 meters) and located closer to the equator or surface level.
5. Performance Degradation
   - **Limitation**:: Adding many polygons increases the computational load on the GPU. For complex polygons with many vertices, performance impacts may occur even with fewer polygons (e.g., 5–10 polygons).
   - **Effect**: Cesium may simplify or aggregate polygons to preserve performance. Frame rates could drop noticeably.
   - **Mitigation**: Simplify the polygons' geometry by reducing vertex counts and use smaller batches of polygons if possible.
6. Intersection and Overlapping Polygons
   - **Limitation**:: Cesium does not natively handle intersecting or overlapping ClippingPolygons well. Using more than 2–3 intersecting polygons in a single area can result in undefined behavior, such as aggregation or incorrect clipping.
   - **Effect**: Polygons may combine visually, fail to clip correctly, or cause rendering artifacts.
   - **Mitigation**: Preprocess intersecting polygons to merge them into a single non-overlapping polygon.
7. Global Rendering Constraints
   - **Limitation**: Cesium imposes global rendering constraints to maintain efficiency. For instance:
     Very small polygons or polygons with highly irregular shapes may be aggregated or ignored.
     Polygons located far from the globe’s center (0, 0, 0) may lose precision.
   - **Effect**: Smaller or distant polygons may be treated as less significant, leading to unexpected behavior or visual inaccuracies.
   - **Mitigation**: Work with normalized data where polygons are resized and positioned close to the center for rendering.

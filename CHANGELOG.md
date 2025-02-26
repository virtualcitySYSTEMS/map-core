### 6.1.0

#### Highlights

- Adds `VectorClusterGroup` concept to the `VcsApp`. For more details see [the documentation](documentation/vectorClusterGroup.md).
- Introduces `FlatGeobuf` support to the VC Map: A `FlatGeobufTileProvider` to load FlatGeobuf files in `VectorTile` layers and
  for smaller files a `FlatGeobufLayer` to load all features at once.
- Adds a rotation api that provides `startRotation` which returns a stop function. It rotates around a given or current viewpoint.
- Adds new `ClippingPolygonObject` and a `ClippingPolygonObjectCollection` to the `VcsApp`, which allows configured clipping regions. For more details see [the documentation](documentation/clipping.md).
- Add `Navigation` API to allow navigating through maps using keyboard or other controller.
- Adds a `renderScreenshot` function to the core that returns a canvas.
- Adds new string templating capabilities (moved here from @vcmap/ui). `renderTemplate` can handle string templates with `{{}}` placeholders and ol style expressions. see [the documentation](documentation/vcsTemplate.md).

#### Changes

- Adds a new `sourceVectorContextSync` to synchronize a vector source with a cesium `VectorContext`.
- `VectorContext` now implements the `hasFeature` interface, returning a boolean if the feature is currently managed by the context.
- Adds the `SourceObliqueSync` to sync a vector source with an oblique source.
- In mapCollection the `requestExclusiveMapControls` has been extended by an ID to identify the current map control holder. There is additionally an event `exclusiveMapControlsChanged` which is emitted when the exclusiveMapControls are changed.
- The `FeatureProviderInteraction` will now return a cluster feature, if more than one feature is provided at the position. Adds new symbol `isProvidedClusterFeature`, which is added to cluster features by FeatureProviders
- Adds a `resetExclusiveMapControls` in the mapCollection to reset the exclusiveMapControls.
- Adds new events `visualizationAdded` and `visualizationRemoved` to `VcsMap`, which allows tracking of layer implementations being added or removed.
- Update Dependencies
  - openlayers to 10.4.0
  - proj4 to 2.15.0
  - uuid 11.1.0
- Fixes a bug, where `allowPicking` would have no effect on `CesiumTilesetLayer`.
- Adds an API to the `FeatureAtPixelInteraction` to allow for features to be excluded from pickPosition.
- Adds the `outlineColor` option to `CesiumTilesetLayer` to allow for customizing the outline color of the tileset.

### 6.0.7

- Fix error on initializing an `Extent` without providing options
- Fix handling of projection prefixes

### 6.0.6

- OverrideCollection now catches destroy failures of items on `removeModule`.

### 6.0.5

- `CreateFeatureSession` & `EditGeometrySession` both expose a `snapTo` API with which you can control the current interractions snaps.
- Correctly use 3D distance for absolute features in cesium when determining the snap tolerance distance.
- Added the `cartesian3DDistanceSquared` helper.
- Fix VectorTileLayer serialization by adding `renderer`

### 6.0.3

- dont use structured clone on properties.

### 6.0.2

- revert part of 6.0.1 `VcsModule.name` property is not nullable anymore
- fix bug where `editFeaturesSession` returns reference to internal feature array

### 6.0.1

- Allow unsetting `VcsModule` properties by null

### 6.0.0

#### Breaking Changes

- Updated Openlayers to 10.2.1
- Updated Cesium to 1.121
- Removed the `defaultPointcloudStyle` from the API, just use `defaultDeclarativeStyle`
- Changed the FeatureLayer defaultStyle to a be an emtpy `DeclarativeStyleItem`
- `OverrideCollection` is now generic to the serialization type.
- `Category` is now generic to the serialization type.
- InteractionEvents position & pixelOrPosition may return 2D coordinates (if emitted from a 2D map). This may be breaking, if you rely on a Z coordinate.
- Feature converter refactoring. Most of these are _breaking_ if you rely on any feature converter APIs directly, make sure to follow up on the docs:
  - New VectorHeightInfo types. VectorHeightInfo now only exposes properties required
    for the specified height reference. Changed the way `create*Primitive` helpers work and renamed to `create*PrimitiveItem`. These are
    now more specific and return `ConvertedItem` instead of just the primitive.
  - Removed multiple no longer needed feature converter helpers: `getHeightAboveGround`, `getMinHeightOrGroundLevel` & `addPrimitivesToContext`
  - CesiumVectorContext changes.
    - The context is no longer passed to the feature converter.
    - The CesiumVectorContext has a new, clearer interface and now exposes async `addFeature` & `removeFeature`.
    - There is no more feature cache, since the new async API made this obsolete.
    - VectorContextHelpers `removeArrayFromCollection`, `removeFeatureFromMap` & `addPrimitiveToContext` have been removed.
  - VectorProperties changes:
    - VectorProperties has been extended to handle new cesium altitude modes. The new
      modes are: `relativeToTerrain`, `relativeTo3DTiles`, `clampToTerrain` & `clampTo3DTiles`.
    - `heightAboveGround` may now be `undefined` to handle new `relativeTo*` altitude modes.
    - Introduced a `renderAs(feature: Feature): 'geometry' | 'model' | 'primitive'` API for
      point features.
  - Changed the VectorGeometryFactory types drastically. You now also have access to
    the geometry factory APIs: `getArcGeometryFactory`, `getCircleGeometryFactory`, `getArcGeometryFactory`
    `getLineStringGeometryFactory` & `getPolygonGeometryFactory` respectively. All `*ToCesium` functions
    have been completely removed. If you relied on this API, just use convert directly.
  - Since points do not expose a geometry factory, a new `getPointPrimitives` API has been
    introduced, replacing what `pointToCesium` used to do.
  - Changed the way `convert` works. The new async API does not rely on sideeffects on VectorContext,
    but instead resolves to an array of `ConvertedItem`s.
  - Introduced `setupClampedPrimitive`, an API to clamp a primitive to the scene based on a
    height reference (used internally to create `relativeTo*` primitives).
  - Changed the way coordinates are transformed to be used with a specific height info.
    `getCartesian3AndWGS84FromCoordinates` has been removed, two new helpers have been introduced instead:
    `mercatorToWgs84TransformerForHeightInfo` & `mercatorToCartesianTransformerForHeightInfo` and
    specifically for points: `getWgs84CoordinatesForPoint`.
  - Fixed a bug, where relative geometries where rendered absolute.
- Changes to the editor:
  - removed helpers: `ensureFeatureAbsolute` & `clampFeature`.
  - vertices may have 2D coordinate layouts.
  - added a helper to handle mixed 2D & 3D vertices: `getCoordinatesAndLayoutFromVertices`.
  - it is now possible to rotate & scale points rendered as models or primitives using handlers.
  - snapping to orthogonal or parallels of the current geometry being edited is now possible.
  - snapping is now also possible to features within vector layers. by default, the editing layer is snapped to.
  - renamed previously unused symbol `vertexIndex` to `vertexIndexSymbol`. the symbol is now correctly set on vertices.
  - Editors will always pick the position of the scene, instead of shooting through objects.
  - Adds an `isVertex` helper for editor interactions.
  - New `SegmentLengthInteraction` added to the editor. Displays segment length of polygons, line strings, circles & bboxes.
- To better illustrate its use, `getFlatCoordinatesForGeometry` was renamed to `getFlatCoordinateReferences`.
- `VectorPropeties.getModelOptions` no longer returns an empty object, but undefined, if model options is not defined anywhere.
- Vector layer will maintain drawing order in 3D.
- Removed `excludedPickPositionEvents` from `FeatureAtPixelInteraction`.
- deprecates `placeGeometryOnTerrain` and `drapeGeometryOnTerrain`
- Renames `placeGeometryOnGround` to `drapeGeometryOnSurface`

#### Changes

- Added `contextOptions` to `CesiumMap` to allow configure the CesiumWidget WebGL Context, see:
- Added getter to `CesiumMap` for the `defaultShadowMap`
- Added `minRenderingLevel` and `maxRenderingLevel` to all `Rasterlayer` and `OpenstreetMapLayer`, this can be used to constrain the levels at which the data should be rendered
- Added `imageryLayerOptions` to `RasterLayer` and `OpenstreetMapLayer` to forward Cesium ImageryLayer Option to the cesium Instance
- Add new `changed` event to FlightPlayerClock
- Adds isDestroyed() to `VcsCameraPrimitive`
- layer now support referencing of `highlightStyle` from styles collection as it already has been supported for `style`
- Adds a new function to the `window`: `createModuleFromConfig` will create a `VcsModule` from a `VcsModuleConfig`, to be used in iframes.
- Adds new helpers to change geometry layouts from XY to XYZ.
- Adds a `createAbsoluteFeature` helper to resolve features of the current session to an absolute state.
- Added new option `msaa` to DisplayQuality
- Adds two new helpers: `spherical2Distance` & `ecef3DDistance` to calculate actual distance on sphere or in 3D space.¨
- Introduces a new `getAttributes` API on Cesium3DTileFeature, Cesium3DTilePointFeature, Entity & ol.Feature to get attributes.
  This works for 1.0 and 1.1 Cesium3DTile data sets. On ol.Feature it is an alias for getProperties _without_ the geometry.
- New `primitive` rendering of vector tile features.
- Add the `StaticFeatureTileProvider` tile provider, which serves runtime openlayers features as a tile provider.
- Adds `placeGeometryOnSurface`

#### Bugfixes

- Fixed featureAtPixelInteraction to correctly handle translucentDepthPicking
- Fixes an issue where override collections would hand out shadow objects directly when serializing. These are now properly cloned.
- Fixes class registry double `Ctor` type bug.
- Terrain layer implementation remove their visualization on destruction.

### 5.3.3

- adds new `fallbackToCurrentMap` option to `VcsMap`. if a map cannot show the current
  viewpoint, it will fail to the currently active map instead of a fallback map.
- adds a new `maintainViewpointOnCollectionChange` flag to `ObliqueMap`. when
  changing a collection, if the current viewpoint cannot be shown, the new collection
  will not be set and the `failedToSetCollection` event will be called with the
  failing collection.

### 5.3.2

- fixed a Bug where legacy Oblique Datasets could not be read
- fixed a Bug where `WFSLayer.toJSON` did not serialize the `version`

### 5.3.1

- added an IconCache for DeclarativeStyle icons to fix flickering icons in 2D
- added `declutter` option to VectorTileLayer, which is forwarded to the openlayers Implementation

### 5.3.0

- added an API to vcsApp to control the display quality for 3D map
- Adds `movementDisabledChanged` event to `vcsMap` that emits when `disableMovement` is called.

### 5.2.1

- Fixes a bug, when adding invalid modules to the app
- Fixes a bug, where not awaiting set oblique collection lead to unexpected state

### 5.2.0

- Adds parameter to `createEditGeometrySession` for disabling removal and insertion of vertices.
- Adds exclusiveMapControls API to `mapCollection`. Deprecates `movementDisabled` getter and setter and replaces it with more specific getters for keyEvents, pointerEvents and API calls.
- Use new exclusiveMapControls in flightPlayer to disable movement during flight playing
- Changes `createClippingFeature` to make sure feature is also centered when vertical. Adds additional parameter to rotate feature.
- Added a new `chainEnded` property to an `InteractionEvent` ThisEvent will be triggered after the current InteractionChain is finished.
- if an EditFeatureSession is active, a right click on the selected feature is now allowed.
- `EditFeaturesSession` now will set `createSync` on the currently edited Features for faster Visual Feedback.
- Fixed a bug where Clippingplanes would throw errors if the map was unloaded and loaded again.

### 5.1.6

- Fixes a bug where WMS featureinfo could only handle GeoJSON.
- Fixed a bug where vcsModule was loosing config entries on setConfigFromApp.

### 5.1.5

- Fixes an issue in oblique, where geometries could have the wrong symbol flag after an update.

### 5.1.4

- Fixes an issue, where all IDs would be returned from `VectorLayer.addFeatures`, even
  if the features with said ID where not added.
- Fixes an issue, where the WMSLayer.toJSON function did not add the option `singleImage2d`
- FeatureStore now has FeatureStoreFeatureVisibility which takes care of change tracking & highlighting.

### 5.1.3

- Introduces `ModelFill`, an extension of `Fill`. When set on a `Style`, the color
  will also be applied to models which are added via the `olcs_modelUrl` property.
- `getStyleOrDefaultStyle` no longer mutates default style when passing in a vector default style.
- Fixes a bug where the point geometry editor was updating the wrong geometry in the oblique map.

### 5.1.2

- Fixes a bug where anchors from flight GeoJSON files were not added correctly.
- Fixed a bug in `clippingObject`, that made it necessary to call `handleMapChanged()` before `setlayerCollection()`

### 5.1.1

- Fixes a bug in VcsApp where modules with the same id could be loaded more than once.
- changed the featureVisibility.highlight function to also allow Stylefunctions.
- changed the type of the parameter `highlightStyle` in `startSelectFeaturesSession` from Style to HightlightStyle.
- Fixed a bug in selectFeatureSession where on change to oblique a not existing selection was cleared.
- Changed the behaviour of `VcsEvent.raiseEvent`, will now check if the listener is still in the collection.

### 5.1.0

- added `setShadowMap()` and `shadowMapChanged` event on CesiumMap.
- added `hiddenObjects` to `VcsModuleConfig` and to `VcsApp` to globally hide objects from a config.
- introduces `Flight`, a way to define a camera path and then play an animation.
- update check library to v2.
- `Viewpoint` now has `getDefaultOptions` and is only valid, if the positions are
  within the WGS84 bounds.
- Fixes multiple bugs on flights:
  - FlightInstanceOptions now extend VcsObjectOptions
  - Fixes bug where FlightPlayer stopped with disabled input
  - Fixes bug where removing an anchor crashed flightInstance
  - Fixes a bug where first anchor was not visualized on creation
  - Adds new class `FlightCollection`, which has an API to set and access active flight Player
  - Adds an API to access active flight Player `getActiveFlightPlayer(app)`
- added headers option to the following. The configured headers will be send if requests are done.
  - Layers
  - ObliqueCollections for datasets and terrain
  - FeatureProvider
  - Map/CameraLimiter terrain requests
- requests from openlayers and @vcmap/core will now take Cesium.TrustedServers into account and will send:
  - `credentials` `include` if its an xhr request and
  - `crossorigin` `use-credentials` if its an img request
- requests to Icons will now set crossOrigin anonymous or use-credentials depending on the url.
- Deprecated `hasSameOrigin` helper function, use `isSameOrigin`
- Possibility to load WMS as single image.
- Fixes vectorProperties.ts `getValuesForfeatures()` if feature array is empty
- Introduces a `replace` API for `OverrideCollection` to replace items in place without having to remove and re-add the item.
- Fixed a bug where the featureConverter did not take the groundlevel into account for linestrings
- Fixed a bug where the featureConverter did not calculate the correct outlineGeometry for Polygons
- Changed CesiumTilesetLayer url behaviour. The url will only be postfixed with tileset.json if the original Url could not be loaded.
  - This makes it possible to load datasets from a rest endpoint like http://domain.com/api/
- Fixed a Bug where the featureConverter did not take the height into account for point Features rendered as Primitives on AltitudeMode RELATIVE_TO_GROUND
- Changed behaviour of failing layers, they will not be removed from the layers collection on module load
- Custom shader API on `CesiumTilesetLayer` to provide custom shaders for specific layers.
- Fixed a Bug where a feature was still rendered in obliquemap, when the feature was added and directly removed again.
- Fixes a bug, where zIndex was not inlcuded in toJSON of layers.
- Options passed to Layers are no longer mutated.
- Polygon and MultiPolygon geometries serialized using geojson helpers are no longer mutated.
- Adds altitude mode awareness to the editor sessions. You can now set the altitude mode of the geometries being created. The
  editor will also react to changes on the feature or the layer.

### 5.0.4

- fixes bug in vectorObliqueImpl, where same features were added twice to obliqueSource. Caused issues in editor.

### 5.0.3

- Fixes a type bug. Augmentation to openlayers & cesium are now properly exported.

### 5.0.2

- Fixed a Bug in VectorTiles, where a hidden Feature by the layer Style could still be clicked with the FeatureInfo tool.
- Fixed a Bug in the ImageStyleHelper where the Anchor was not correctly returned.

### 5.0.1

- updates @vcsuite/eslint-config
- updates prettier to v3.0
- fixes Bug in cesiumMap.toJson function
- fixes Bug where the OverrideCollection did not create a clone from an item on serialization

### 5.0.0

- Changed CI/CD from Node 16 to 18
- Updated Node-canvas to 2.11.2 (for Node 18/20 prebuild binaries)
- Changed Editor MouseoverInteraction to not change document.body cursor (only changes the map target container cursor)
- Fixed Bug in the featureConverter

### 5.0.0-39

- removed deprecated maximumMemoryUsage from CesiumTilesetLayer (use `tilesetOptions` and https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html#cacheBytes instead)
- added `lightIntensity` on CesiumMap to defaultOptions and added getter/setter
- fixed Bug in VectorProperties `getValuesFromFeatures`, `modelOptions` and `primitiveOptions` are now evaluated

### 5.0.0-38

- Cursor when using the `createFeatureSession` is now a pen.
- Point with the `primitiveOption` set can now be rendered `clampToGround`
- The altitude mode of the editing feature is respected in `editGeometrySesssion`.
- Changing a features altitude mode while editing its geometry will also update the sessions layer.
- Updated Openlayers to 7.5.2
- Updated Cesium to 1.109
- Added a new Options to Cesium Model and Cesium Tileset `useSRGBVertexColors`, `useSRGBColorFactors`.
  - These Options can be used to change the cesium default Color Handling of datasets.
  - (Per GLTF Spec Cesium expects color values in linear space)
- Changed the Cesium custom VCS Shader to now handle Gltf Color values in linear color space.
- Changed the Cesium custom VCS Shader to not do tonemapping anymore.
- Changed the default Cesium Scene Light intensity from 2.0 to 3.0 (can be changed with CesiumMap `lightIntensity`)
- Changed FeatureConverter to work `async` (Cesium changed the Model.fromGltf function to Model.fromGltfAsync)
- Fixed a highlighting bug in cesium.

### 5.0.0-37

- Added a `datasourceId` option to `Layer`
- Added `VcsAppOptions` including optional keys `_id`, `name`, `description` and `properties`
- Added `startingObliqueCollectionName` to `VcsModule`
- Fixed Bug in WFSLayer, can handle XML now.
- Added `version` option to WFSLayer
- Added new function `getValuesForFeatures` and `setValuesForFeatures` to vectorProperties
- Updated Openlayers to version 7.5.1

### 5.0.0-36

- Updated Cesium library to include custom VCS Shader rendering.
  - The original Shading can be reinstated by activating the flag `useOriginalCesiumShader` on the CesiumMap
- Updated API Documentation
  - Ordering By main type
  - added permanent API docs link at https://lib.virtualcitymap.de/core/5.0/docs/
- Added StyleHelpers
  - `getFillFromOptions` and `getFillOptions`
  - `getStrokeFromOptions` and `getStrokeOptions`
  - `getImageStyleFromOptions` and `getImageStyleOptions`
  - `getStyleFromOptions` and `getStyleOptions`
- Removed all APIs which were marked deprecated
  - removed Geojson Feature vcsStyle or FeatureCollection vcsStyle. Use vcsMeta instead.
  - removed symbol showProvidedFeature (this is not needed anymore)
  - removed VectorLayer.alreadyTransformedToMercator Symbol use `import { alreadyTransformedToMercator } from @vcmap/core`
  - removed VectorLayer.alreadyTransformedToImage Symbol use `import { alreadyTransformedToMercator } from @vcmap/core`
  - removed Layer.vcsLayerNameSymbol Symbol use `import { vcsLayerName } from @vcmap/core`
  - removed VectorLayer.obliqueGeometry Symbol use `import { obliqueGeometry } from @vcmap/core`
  - removed VectorLayer.doNotTransform Symbol use `import { doNotTransform } from @vcmap/core`
  - removed VectorLayer.originalFeatureSymbol Symbol use `import { originalFeatureSymbol } from @vcmap/core`
  - removed Evaluation of vectorProperties storeyHeight use vectorProperties `extrudedHeight` and `storeysAboveGround` and `storeyHeightsAboveGround`
  - removed Evaluation of olcs_storeyHeight and olcs_storeyNumbers from Features, use `olcs_extrudedHeight` and `olcs_storeysAboveGround` and `olcs_storeyHeightsAboveGround`

### 5.0.0-35

- Updated Openlayers dependency to 7.4
- Updated Cesium to 1.106
- Updated proj4 to 2.9.0
- Updated UUID to 9.0.0

### 5.0.0-34

- fixed Bug in vectorTileImageryProvider (missing `_ready`)
- removed usage of readyPromise in `CesiumMap.getHeightFromTerrain`
- moved to TS.

### 5.0.0-31

- uses prettier and new eslint config v3.
- features created by the editor are flagged as mercator.
- scaling an ol image style with an array does not break feature converter.
- Updated Openlayers to 7.3
- Updated Cesium to v1.105

### 5.0.0-rc.28

- Introduced `moveTo` API for IndexedCollections
- Breaking Change: renamed `Context` to `VcsModule`
  - renamed all linked methods or properties, e.g. `addModule` or `removeModule`
  - adding new properties to VcsModule class and renaming `id` to `_id`
  - Adding an API to VcsModule to update (`setConfigFromApp`) and serialize (`toJSON`) it
  - Adding an API to vcsApp `serializeModule`, which returns the serialized config of a VcsModule
- new highlight & hidden style handling on ol.Feature. Overwrites `getStyleFunction` prototype on ol.Feature.
- layer properties in vcsMeta
- changes the position of added exclusiveInteractions to the eventHandler. If no index is provided they are always pushed to the end of the array and therefore are executed last.
- introduces `selectFeaturesSession`. Therefore removes selection capablities from `editFeaturesSession` and `editGeometrySession`.
- splits mouse over handling so there is one for feature selection, one for feature editing and one for geometry editing editing.

### 5.0.0-rc.27

- Removed AppedBackedCategory, use Category
- added `getSerializedByKey` method to overrideCollection
- added offset option to ArcStyle to offset the arrow from the starting and endpoint
- Updated Openlayers to 7.2
- Removed unused Underscore.template dependency

### 5.0.0-rc.26

- Update to Cesium 101 (now uses only the @cesium/engine)
- updated documentation

### 5.0.0-rc.25

- Updated Splitscreen and splitDirection handling
- small TS fixes

### 5.0.0-rc.24

- Editor: Adds a `EditFeaturesSession` to transform features.
- Feature converter can now draw primitives at point locations using `olcs_primitiveOptions`.
- Adds `ArrowStyle` & `ArcStyle`. Special OL Styles to style LineStrings with.
- Updates `splitDirection` API on layer and mapCollection and removes ClippingPlanes for splitting

### 5.0.0-rc.23

- Adds a `postRender` event on `VcsMap` and `MapCollection` for convenience.

### 5.0.0-rc.22

- Updated Cesium to version 1.97
- Editor: Adds a `EditGeometrySession` to edit simple geometries.
- Renamed ViewPoint to Viewpoint

### 5.0.0-rc.21

- Updated Openlayers to version 7.0.0

### 5.0.0-rc.20

- changed OverrideCollection `replaced` event to { new:T, old:T }
- added an API to vcsApp to control the dynamic VcsModule `setDynamicContext`, `resetDynamicContext` and `dynamicContextIdChanged`
- added an API to vcsApp to access the added context `app.modules`
- removed DateTime Helpers
- added vcsApp.locale
- added vcsApp.localeChanged
- removed Global Module scoped locale/localeChanged Event
- refactored layer/layerCollection/tileprovider to passThrough the locale
- all persistent interactions have `PointerKeyType.ALL` as their default pointer key type.
- feature at pixel interaction no longer defaults to attaching unknown objects from cesium datasources as features.
- `WMTWSLayer` `style` configuration was renamed to `wmtsStyle` to no get confused with `FeatureLayer.style`.
- labels converter by the feature converter respect text `scale`.
- adds a `markVolatile` function to ensure objects are never serialized into a context.
- exports a `maxZIndex` constant to use for always rendering layers on top.
- `AbstractInteraction` interface is extended by a `modifierChanged` which will be called,
  if the keyboard modifiers are changed.
- Adds `Editor` capabilities.
  - Adds a `CreateFeatureSession` editor session to create new features.

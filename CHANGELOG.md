### 5.0.0-next

- Added a `datasourceId` option to `Layer`
- Added `VcsAppOptions` including optional keys `_id`, `name`, `description` and `properties`
- Added `startingObliqueCollectionName` to `VcsModule`

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

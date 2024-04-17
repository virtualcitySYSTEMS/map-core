### 5.2.0

- Adds parameter to `createEditGeometrySession` for disabling removal and insertion of vertices.
- Adds exclusiveMapControls API to `mapCollection`. Deprecates `movementDisabled` getter and setter and replaces it with more specific getters for keyEvents, pointerEvents and API calls.
- Use new exclusiveMapControls in flightPlayer to disable movement during flight playing
- Changes `createClippingFeature` to make sure feature is also centered when vertical. Adds additional parameter to rotate feature.

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

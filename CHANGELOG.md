###   5.0.0-next
- Introduced `moveTo` API for IndexedCollections
- Refactored context class adding new properties and renaming `id` to `_id`
- Adding an API to context to update `setConfigFromApp` and serialize `toJson` a context
- Adding an API to vcsApp `serializeContext`

###   5.0.0-rc.27
- Removed AppedBackedCategory, use Category
- added `getSerializedByKey` method to overrideCollection
- added offset option to ArcStyle to offset the arrow from the starting and endpoint
- Updated Openlayers to 7.2
- Removed unused Underscore.template dependency

###   5.0.0-rc.26
- Update to Cesium 101 (now uses only the @cesium/engine)
- updated documentation

###   5.0.0-rc.25
- Updated Splitscreen and splitDirection handling
- small TS fixes

###   5.0.0-rc.24
- Editor: Adds a `EditFeaturesSession` to transform features.
- Feature converter can now draw primitives at point locations using `olcs_primitiveOptions`.
- Adds `ArrowStyle` & `ArcStyle`. Special OL Styles to style LineStrings with.
- Updates `splitDirection` API on layer and mapCollection and removes ClippingPlanes for splitting

###   5.0.0-rc.23
- Adds a `postRender` event on `VcsMap` and `MapCollection` for convenience.

###   5.0.0-rc.22
- Updated Cesium to version 1.97
- Editor: Adds a `EditoGeometrySession` to edit simple geometries.
- Renamed ViewPoint to Viewpoint

###   5.0.0-rc.21
- Updated Openlayers to version 7.0.0

###   5.0.0-rc.20
- changed OverrideCollection `replaced` event to { new:T, old:T }
- added an API to vcsApp to control the dynamic Context `setDynamicContext`, `resetDynamicContext` and `dynamicContextIdChanged`
- added an API to vcsApp to access the added context `app.contexts`
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

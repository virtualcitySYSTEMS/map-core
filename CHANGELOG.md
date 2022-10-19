###   5.0.0-rc.next
- Editor: Adds a `EditFeaturesSession` to transform features.

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

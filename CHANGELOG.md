###   5.0.0-rc.next
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

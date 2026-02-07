# VC Map Core @vcmap/core

> Part of the [VC Map Project](https://github.com/virtualcitySYSTEMS/map-ui)

> [API Docs](https://lib.virtualcitymap.de/core/6.2/docs/)

The VC Map Core is a thin abstraction layer and wrapper around OpenLayers and Cesium.
It provides a common data and feature management API and automatically synchronizes data and user actions between the 2D, oblique and 3D views.
Map functions and tools can be developed against this core API to make them available in 2D, 3D and the oblique view rather than having to develop
them redundantly and based on different technologies.

# Features

## [Maps](./documentation/maps.md)

Allows rendering content on three different maps. This allows to select the best technology for a specific usecase, but
still work with the same API.

- 2D Map using OpenLayers
- 3D Map using CesiumJS
- Oblique Map using OpenLayers
- Panorama Map using CesiumJS

## [VcsApp](./documentation/vcsApp.md)

A main class to manage items (`maps`, `layers`, `viewpoints`, `styles`). The VcsApp has a API to add/get/list
items in different Collections. For example the LayerCollection: `const layer = vcsApp.layers.getByKey('myLayerName');`
The VcsApp also provides an API to parse and serialize `Modules`. An Item can be added via parsing of a module or directly
via the API.

## [Layers](./documentation/layers.md)

Some layer are map specific and only work for example in 3D. Layers can be created via the API
`new CesiumTilesetLayer(options);` or loaded into the `VcsApp` in a `Module`. The Core supports the following layer types.

#### Only 3D

- CesiumTilesetLayer (3D Tiles OGC Community Standard)
- CzmlLayer Cesium Czml (https://github.com/AnalyticalGraphicsInc/czml-writer/wiki/CZML-Guide)
- I3SLayer Indexed 3D Scene Layers (https://www.ogc.org/standards/i3s/)
- PointCloudLayer (using CesiumTilesetLayer)
- TerrainLayer Cesium Quantized-Mesh (https://github.com/CesiumGS/quantized-mesh)

#### Supported in 2D and 3D

- WMS Layer
- WMTS Layer
- TMS Layer
- COGLayer (Cloud Optimized GeoTIFF)
- SingleImageryLayer
- Vector Tile Layer
- FlatGeobuf Layer
- OpenStreetMap Layer
- PanoramaDataset Layer (shows positions in 2D/3D and the Panorama in the PanoramaMap)

#### Supported in 2D, 3D and Oblique

- WFS Layer
- GeoJSON Layer
- Vector Layer (allows adding Features via API: `layer.addFeature(new Feature({ geometry: new Polygon({...}) }))`)

#### FeatureLayer `Vector`, `WFSLayer`, `GeoJSONLayer`, `VectorLayer`, `CesiumTileset`, `FlatGeobufLayer`, `PanoramaDatasetLayer`

Layers which provide Features have a common API to hide/highlight/style/access Features.

## [Styles](./documentation/style.md)

The Core supports two style types. A `DeclarativeStyleItem` using the Cesium [3D Tiles Styling](https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling) language
and a `VectorStyleItem` which is based on OpenLayers Styling.
Both Style Items can be serialized to JSON and work for `VectorLayer`, `GeoJSONLayer`, `CesiumTilesetLayer`, `VectorTileLayer`.
`DeclarativeStyleItem` can be used to style each Feature in a dataset based on attribute values or rules depending on attributes.
`VectorStyleItem` are best for static styling of a complete dataset.

## [Configuration Management](./documentation/vcsModule.md)

The core provides a flexible and fully customizable configuration management. Items like `maps`, `layers`, `viewpoints`, `styles` can be managed in `Modules`.
`Modules` can be serialized to a JSON file and loaded/unloaded by the VcsApp.

## [Interactions API](./documentation/interaction.md)

The Interactions API is an abstraction layer to handle map events, for example a click event on the Map.
This allows for developing applications which work in 2D/3D or oblique.

## Workers

Some features use `WebWorkers` to offload heavy computations from the main thread. If you host the library yourself,
you can set the global `vcs.workerBase` to point to the hosted location of the workers. Otherwise it is assumed the code is
hosted in the same structure and a relative URL to the workers directory is used
(which may lead to issues if you dont allow `unsafe-inline` in your CSP).

## Feature Editor API

Based on the Interactions API, the Feature Editor provides functionality to `create`, `select`, and `transform` Features.

## Parametrized Features API

Vector Features can be shown in a `VectorLayer` or `GeoJSONLayer`. GeoJSON Features are just 2D, and in a 2D Map the Features
will just be rendered. In 3D, a Feature can be rendered differently depending on the VectorLayer settings or the properties
of the Feature.

- Render a Feature as a Solid via `extrusion` Parameter.
- Render a Point Feature as a glTF Model.
- Render a Feature as a Classification Primitive to classifiy other content.

For more options, see [VectorProperties](./src/layer/vectorProperties.ts).

## Categories

Categories is a concept to serialize and parse arbitrary JSON Objects from a Module.

## OpenLayers/CesiumJS

The full capabilities of OpenLayers and CesiumJS are available. In 3D for example, a map has an accessor to get the corresponding
Cesium Scene.

## Extensibility

With the ClassRegistry concept and API, it is possible to register your own Item Types to the Framework.
For example with `app.layerClassRegistry.registerClass('myLayer', MyLayerClass)` it is possible to implement a custom layer
while following the Layer Interface. This allows to reuse the Module serialization/parsing concept with custom Items.

# Coding Conventions

### Exporting from a module

- You should export all variables, functions, class, etc., from a module
  which are required to use the API.
- Part of your module which should be part of the library must be added to the index.ts file manually
- Make sure the names of exports have _meaning outside of their module_. E.g., a
  function named `extend(destination: extent3D, source: extend3D):void` would need to be rephrased to `extend3DExtent`.

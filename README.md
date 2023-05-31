# VC Map Core @vcmap/core

> Part of the [VC Map Project](https://github.com/virtualcitySYSTEMS/map-ui)

The VC Map Core is a thin abstraction layer and wrapper around OpenLayers and Cesium.
It provides a common data and feature management API and automatically synchronizes data and user actions between the 2D, oblique and 3D views.
Map functions and tools can be developed against this core API to make them available in 2D, 3D and the oblique view rather than having to develop
them redundantly and based on different technologies.

# Features

## [Maps](./documentation/maps.md)

Allows rendering content on three different maps. This allows to select the best technology for a specific usecase, but
still work with the same API.

- 2D Map using Openlayers
- 3D Map using CesiumJs
- Oblique Map using Openlayers

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
- PointCloudLayer (using CesiumTilesetLayer)
- TerrainLayer Cesium Quantized-Mesh (https://github.com/CesiumGS/quantized-mesh)

#### Supported in 2D and 3D

- WMS Layer
- Vector Tile Layer
- OpenstreetMap Layer

#### Supported in 2D, 3D and Oblique

- WFS Layer
- GeoJSON Layer
- Vector Layer (allows adding Features via API) `layer.addFeature(new Feature({ geometry: new Polygon({...}) }))`

#### FeatureLayer `Vector`, `WFSLayer`, `GeoJSONLayer`, `VectorLayer`, `CesiumTileset`

Layers which provide Features have a common API to hide/highlight/style/access Features.

## [Styles](./documentation/style.md)

The Core supports two style types. A `DeclarativeStyleItem` using the Cesium [3D Tiles Styling](https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling) language
and a `VectorStyleItem` which is based on Openlayers Styling.
Both Style Items can be serialized to JSON and work for `VectorLayer`, `GeoJSONLayer`, `CesiumTilesetLayer`, `VectorTileLayer`.
`DeclarativeStyleItem` can be used to style each Feature in a dataset based on attribute values or rules depending on attributes.
`VectorStyleItem` are best to for static styling of a complete dataset.

## [Configuration Management](./documentation/vcsModule.md)

The core provides a flexible and fully customizable configuration management. Items like `maps`, `layers`, `viewpoints`, `styles` can be managed in `Modules`.
`Modules` can be serialized to a JSON file and loaded/unloaded by the VcsApp.

## [Interactions API](./documentation/interaction.md)

The Interactions API is an abstraction layer to handle map events. For example a click event on the Map.
This allows for developing applications which work in 2D/3D or oblique.

## Feature Editor API

Based on the Interactions API the Feature Editor provides functionality to `create`, `select`, and `transform` Features.

## Parametrized Features API

Vector Features can be shown in a `VectorLayer` or `GeoJSONLayer`. GeoJSON Feature are just 2D, and in a 2D Map the Feature
will just be rendered. In 3D a Feature can be rendered differently depending on the VectorLayer settings or the properties
of the Feature.

- Render a Feature as a Solid via `extrusion` Parameter.
- Render a Point Feature as a Gltf Model.
- Render a Feature as a Classification Primitive to classifiy other content.

More options see [VectorProperties](./src/layer/vectorProperties.ts)

## Categories

Categories is a concept to serialize and parse arbitrary JSON Objects from a Module.

## Openlayers/CesiumJs

The full capability of Openlayers and CesiumJs are available. In 3D, a map for example has an accessor to get the corresponding
Cesium Scene.

## Extensibility

With the ClassRegistry concept and API its possible to register your own Item Types to the Framework.
For example with `app.layerClassRegistry.registerClass('myLayer', MyLayerClass)` its possible to implement a custom layer
while following the Layer Interface. This allows to reuse the Module serialization/parsing Concept with custom Items.

## Getting Started

- clone Repo
- npm install

# Coding Conventions

### Exporting from a module

- You should export all variables, functions, class etc. from a module
  which are required to use the API.
- Party of your module which should be part of the library must be added to the index.ts file manually
- Make sure the names of exports have _meaning outside of their module_. E.g. a
  function names `extend(destination: extent3D, source: extend3D):void` would need to be rephrased to `extend3DExtent`.

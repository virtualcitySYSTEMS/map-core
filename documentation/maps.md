# Maps

VC Map is built upon open, proven, and reliable GIS and web technologies.
It uses [OpenLayers](https://github.com/openlayers/openlayers) for the 2D visualization and oblique view.
[Cesium](https://github.com/cesiumGS/cesium/) is used for the visualization of 3D geo-data.
Users can easily switch between the 2D, oblique and 3D views and dynamically add map layers to the scene that are accessible in all views.

All maps of an application are managed in a [MapCollection](../src/util/mapCollection.ts), which is a readonly property of the [VcsApp](../src/vcsApp.ts) instance.

## Map types

The abstract base [map](../src/map/vcsMap.ts) class is derived from the [VcsObject](../src/vcsObject.ts) class.
It defines the `target`, a HTMLElement where the map's canvas is rendered in, its state, `splitPosition` and `layerCollection`.

For all visualization technologies used, subclasses are derived.
For [OpenLayers](https://github.com/openlayers/openlayers) based visualization of 2D and oblique a [baseOLMap](../src/map/baseOLMap.ts) exists, which is further specialized in a [openlayersMap](../src/map/openlayersMap.ts) and an [obliqueMap](../src/map/obliqueMap.ts).
For [Cesium](https://github.com/cesiumGS/cesium/) based 3D visualization the [cesiumMap](../src/map/cesiumMap.ts) provides a wrapper around the Cesium Scene class.

## MapCollection

The [MapCollection](../src/util/mapCollection.ts) is a container for all available map types of a VcsApp.
Maps can be added to or removed from this collection either via API or config.
The collection has a couple of properties which are shared among its maps.
This includes `layerCollection`, `target`, and `splitPosition`.
Changes on common properties are applied on all maps of the collection.

To currently active map is stored and can be accessed using:

```js
const activeMap = vcsApp.maps.activeMap;
```

To change the active map, use the setter and provide a map name, e.g.:

```js
vcsApp.maps.setActiveMap('CesiumMap');
```

The MapCollection also provides a `postRender` Event, which abstracts the post render events of the different map types.

## Map Target

The map target is an HTML element in which to render the maps.
You can easily define a `div` element and set it as map target.

Here is a very basic example defining an application container with a map div inside:

```html
<!doctype html>
<html class="vcs-ui" lang="en">
  <body>
    <div id="mySampleApp" class="myApplication">
      <span>Application</span>
      <div class="myMapContainer">
        <div id="myMapUUID"><span>Map</span></div>
      </div>
    </div>
    <style>
      .myApplication {
        position: relative;
        display: flex;
        width: 1200px;
        height: 800px;
        background-color: #ff0000;
      }
      .myMapContainer {
        position: absolute;
        top: 20px;
        left: 15px;
        right: 15px;
        bottom: 15px;
        background-color: #0000ff;
      }
      .mapElement {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        overflow: hidden; /* Fix for iFrame content */
      }

      .cesium-widget,
      .cesium-widget canvas {
        width: 100%;
        height: 100%;
        touch-action: none;
      }
    </style>
    <script type="module" src="./start.js"></script>
    <!-- start script, see @vcmap/ui for an example -->
  </body>
</html>
```

To set the map div above as target of your map collection call:

```js
vcsApp.maps.setTarget('myMapUUID');
```

> Notes to make this example working:
>
> - You'll need a container with an absolute position
> - You'll need to define `mapElement` css class like above
> - You'll need to manually set canvas size on `cesium-widget canvas` like above
> - You'll need a start script initializing vcs app

### Exclusive Map Control

The `exclusiveMapControl` concept allows a single feature or module to take control of map navigation interactions, such as pointer events, keyboard events, or API-driven map movement. This ensures that only the designated owner can interact with the map in specific ways, avoiding conflicts with other parts of the application.

#### Requesting Exclusive Map Controls

You can request exclusive control of the map's movement or interaction by calling `requestExclusiveMapControls`. This method takes the following parameters:

- **`options`**: An object specifying which controls to disable. It includes:
  - **`pointerEvents`**: Disables pointer-based map interactions.
  - **`keyEvents`**: Disables keyboard-based map interactions.
  - **`apiCalls`**: Disables programmatic map movement through API calls.
- **`removed`**: A callback function to be invoked when the exclusive map controls are forcefully removed.
- **`id` (optional)**: A unique identifier for the owner of the exclusive controls. If not provided, a UUID will be generated.

The Method returns a function to release the exclusive controls. Alternatively, if all options are provided as false, the controls will also be released.
There is also an exclusiveMapControlsChanged event that is fired when the exclusive controls change.

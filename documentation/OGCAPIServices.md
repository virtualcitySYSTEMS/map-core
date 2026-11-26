# OGC API services

OGC API is a family of standards for web APIs that provide geospatial data. The
standards are modular: different services can provide features, maps, tiles, and
other resources. In `@vcmap/core`, **OGC API - Maps is currently the only OGC API
service supported**. Other OGC API resources, such as Features or Tiles, are not
consumed by `OGCMapLayer`.

## OGC API - Maps

OGC API - Maps returns map images from geospatial data. The
[`OGCMapLayer`](../src/layer/ogcMapLayer.ts) displays these images in OpenLayers
and Cesium. It requests images for map areas as the view changes; by default,
these are requested as tiles from the service's `/map` endpoint. It does not use
an OGC API Tiles endpoint or download/query vector features.

The layer appends `/map` to the configured `url`. If `styleId` is set, it
instead requests `/styles/{styleId}/map` relative to the configured resource.
Set `url` to the service resource immediately before that endpoint. For example, if the service has
`https://example.org/ogc/collections/roads/map`, configure
`https://example.org/ogc/collections/roads` as the URL. The service must provide
a Maps endpoint at the resulting URL and return map images the browser can
display.

To request the dataset-level endpoint and select collections:

```js
const layer = new OGCMapLayer({
  url: 'https://example.org/ogc',
  parameters: {
    collections: 'roads,buildings',
  },
});
```

With the default settings, this requests 256 by 256 pixel tiles in EPSG:3857
(shown unencoded for readability):

```
https://example.org/ogc/map?collections=roads,buildings
  &bbox={west},{south},{east},{north}
  &bbox-crs=http://www.opengis.net/def/crs/EPSG/0/3857
  &crs=http://www.opengis.net/def/crs/EPSG/0/3857
  &width=256&height=256
```

Collection identifiers must match the service's advertised IDs. When selecting
multiple collections, their order is used as the rendering stacking order. See
[Query parameters](#query-parameters) for `collections` and other parameters.

To use a single collection's `/map` endpoint instead, configure the collection
resource URL:

```js
const layer = new OGCMapLayer({
  url: 'https://example.org/ogc/collections/roads',
});
```

This requests `https://example.org/ogc/collections/roads/map?…`.

To request a styled map, set `styleId`:

```js
const layer = new OGCMapLayer({
  url: 'https://example.org/ogc/collections/roads',
  styleId: 'night',
});
```

This requests `https://example.org/ogc/collections/roads/styles/night/map?…`.

### Request parameters and service requirements

For each map image, the layer supplies spatial and image-size parameters:
`bbox`, `bbox-crs`, `crs`, `width`, and `height`. The service must support the
CRS and request parameters used by the layer. CRS values are sent as URIs:
`http://www.opengis.net/def/crs/EPSG/0/3857` for EPSG:3857 and
`http://www.opengis.net/def/crs/OGC/1.3/CRS84` for OGC CRS84.

| Layer setting                            | Requests made by the layer                | Requirement                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tilingSchema: 'mercator'` (the default) | `crs` and `bbox-crs` set to EPSG:3857     | The service must implement the [Spatial Subsetting](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/spatial-subsetting) and [Coordinate Reference System](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/crs) conformance classes and support EPSG:3857 for both the bounding-box CRS and the map CRS.                                                                           |
| `tilingSchema: 'geographic'`             | `crs` and `bbox-crs` set to OGC CRS84     | The service must implement the [Spatial Subsetting](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/spatial-subsetting) and [Coordinate Reference System](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/crs) conformance classes and support OGC CRS84 (longitude, latitude) for both the bounding-box CRS and the map CRS.                                                     |
| `tileSize`                               | `width` and `height` for each tiled image | The service must implement the [Spatial Subsetting](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/spatial-subsetting) and [Scaling](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/scaling) conformance classes and accept the requested image dimensions. The default is 256 by 256 pixels. In OpenLayers single-image mode, OpenLayers chooses the image dimensions instead. |
| `styleId`                                | `/styles/{styleId}/map`                   | The service must implement the [Styled Maps](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/styled-map) conformance class and provide the requested style.                                                                                                                                                                                                                           |
| `parameters`                             | Further query parameters                  | The service must support each supplied parameter and its corresponding conformance class, if defined by OGC API - Maps. Service-specific parameters require service-specific support. See [Query parameters](#query-parameters).                                                                                                                                                          |

Check the service's `/conformance` response for the conformance class URIs
corresponding to the layer settings you use:

- [Spatial Subsetting](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/spatial-subsetting)
- [Scaling](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/scaling)
- [Coordinate Reference System](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/crs)
- [Date and Time](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/datetime) when passing `datetime`
- [Collection Selection](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/collections-selection) when passing `collections`
- [Background](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/background) when passing `transparent` or `bgcolor`
- [Styled Maps](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/styled-map) when setting `styleId`
- [Display Resolution](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/display-resolution) when using `singleImage2d` on high-DPI displays (see [Common pitfalls](#common-pitfalls))

The CRS options are limited to CRS84 and EPSG:3857. In particular, the
geographic option uses CRS84 (longitude, latitude), not an EPSG:4326 request.
The layer does not negotiate a CRS with the server or discover which optional
parameters it supports.

The conformance classes for `datetime`, `collections`, and the Background
parameters are optional in OGC API - Maps. A service conforming to the standard
is not necessarily required to implement every optional class. Only pass these
parameters when the service declares support for the corresponding conformance
class. If a parameter is omitted, the server's default behavior applies.

### Query parameters

Apart from the spatial and image-size parameters, all query parameters are
passed using `parameters`: standard OGC API - Maps parameters, such as
`datetime`, `collections`, `transparent` or `bgcolor`, as well as
service-specific ones. It accepts a `Record<string, string | string[]>`: use
strings for values, including numbers and booleans. An array sends a repeated
query parameter, not a comma-separated value; use a single comma-separated
string when the service expects one, e.g. for `collections`.

| Parameter     | Example value                                 | Requirement                                                                                                                                                                                                                                                                  |
| ------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `datetime`    | `'2026-10-23T00:00:00Z'` or `'2026-01-01/..'` | The service must implement the [Date and Time](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/datetime) conformance class and accept the supplied instant or interval.                                                                                                  |
| `collections` | `'roads,buildings'`                           | The service must implement the [Collection Selection](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/collections-selection) conformance class.                                                                                                                          |
| `transparent` | `'true'` or `'false'`                         | The service must implement the [Background](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/background) conformance class. If omitted, such services default to a transparent background unless `bgcolor` is set, so map areas without data do not cover layers beneath. |
| `bgcolor`     | `'0xFFFFFF'`                                  | The service must implement the [Background](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/background) conformance class.                                                                                                                                               |

```js
const layer = new OGCMapLayer({
  url: 'https://example.org/ogc',
  parameters: {
    collections: 'roads,buildings',
    datetime: '2026-10-23T00:00:00Z',
    transparent: 'false',
    bgcolor: '0xFFFFFF',
  },
});
```

The `parameters` property of the layer returns a copy. Changing the copy has no
effect until it is assigned back, which reloads the layer if the parameters
changed:

```js
const parameters = layer.parameters;
parameters.datetime = '2026-11-01T00:00:00Z';
layer.parameters = parameters;
```

There is no single conformance class for `parameters`. Check the service's
`/conformance` response for each standard parameter's class and consult its API
documentation for accepted values and service-specific parameters. The layer
does not validate these values or discover server support.

Entries in `parameters` replace query parameters with the same name already in
`url`. Do not set `bbox`, `bbox-crs`, `crs`, `width`, or `height` through
`parameters` or `url`: the map implementations generate these for each image.
Tiled requests overwrite supplied values, while OpenLayers single-image
requests append the generated values, resulting in duplicate parameters.

### Common pitfalls

- **Do not include `/map` in `url`.** The layer appends it. Including it
  yourself results in a request to `/map/map`.
- **Check the endpoint shape.** A dataset-level map endpoint and a
  collection-level map endpoint are different resources. Use the matching
  parent resource as the layer URL; use the `collections` parameter to select
  collections at the dataset-level endpoint.
- **Check advertised conformance and supported CRS.** A server may implement
  OGC API - Maps without supporting the optional parameters or either CRS this
  layer requests. A browser may show failed or empty imagery if the service
  rejects those requests.
- **Treat `datetime` as a server-side filter.** The layer sends the value to
  the service; it does not validate available time values or find a nearest
  time for you.
- **`singleImage2d` only affects OpenLayers.** When enabled, OpenLayers requests
  a single image for the current view instead of tiled images. The image covers
  an area larger than the viewport (1.5 times), and `tileSize`, `minLevel` and
  `maxLevel` do not apply. On high-DPI displays (device pixel ratio other than
  1), OpenLayers additionally sends `mm-per-pixel`, which requires the
  [Display Resolution](https://www.opengis.net/spec/ogcapi-maps-1/1.0/conf/display-resolution)
  conformance class. Cesium always uses tiled requests.
- **Expect repeated requests.** The default behavior requests individual image
  areas as the map is panned and zoomed. The server must handle the resulting
  `/map` requests at the requested bounding boxes and dimensions.

For the standard's endpoint and parameter definitions, see the
[OGC API - Maps overview](https://ogcapi.ogc.org/maps/overview.html) and
[OGC API - Maps Core specification](https://docs.ogc.org/is/20-058/20-058.html).

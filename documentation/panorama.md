# Panorama

Panorama image handling in the VCMap.

## Data Structure & Format

The following outlines the two levels of data structure for panorama images in the VCMap. Basically we have to distinguish between
a data set of images, and the images themselves.

### Data Set

A panorama data set is a collection of images that belong to the same capture campaign. A dataset is represented by an images.json, which in
turn contains the metadata fo the images. The image.json should refer to a tiled structure of other image.jsons so that not the entire metadata is
loaded into the client at once. This will be done on a single level, depending on point density.

### Panorama Image

This is the actual image data as represented by the image.jsons metadata. The image data should be accessible relative to the
provided metadata. It is planned to use COG (Cloud Optimized GeoTIFF) for the image data. The image data
contains two layers:

- one RGB layer and
- one depth layer (32bit grey scale). The depth layer is optional?

If COGs are not possible, a fallback `static` image data structure can be used.

The raw image data needs to be processed in the flowing manner:

- flipped on the Y axis (because we render it on the inside of a sphere)
- tiled using a default tile size of 1024x1024 pixels and a geographic tiling scheme with two level 0 base tiles.

### Static Data Structure

Given / as the root of the data set, the data should be structured as follows for the COG approach:

```
- /
- images.json
- metaTiles/
  - 12/
    - 1234/
      - 1234.json
    - 1235/
      - 1235.json
- images/
  - imageName.gtiff
```

and for the static files approach:

```
- /
- images.json
- metaTiles/
  - 12/
    - 1234/
      - 1234.json
    - 1235/
      - 1235.json
- images/
  - imageName/
    - tileset.json
    - rgb/
      - 0/
        - 0/
          - 0.png
          - 1.png
        - 1/
          - 0.png
          - 1.png
    - depth/
      - 4/
        - 0/
          - 0.png
          - 1.png
        - 1/
          - 0.png
          - 1.png
```

The `images.json` contains the metadata of the image metadata in the data set.
The `metaTiles` directory contains the metadata of the images in a tiled structure.
The `images` directory contains the actual image data.

When resolving an image by name, this can always be done by adding `images/${imageName}.{format}` to the root url for COG
and `images/${imageName}/tileset.json` for the static files approach.

## Runtime Objects

The following objects are used at runtime to represent the panorama data.

### PanoramaImageDataSet

Points to a remote [Data Set](#data-set). These resources contains tiled image information. Very similar to the way oblique image data sets are handled.

The following behavior is unclear and depends on whether we can load multiple data sets at once:

- Provides 2D points of all the loaded images.
- Provides 2D extents of available tile.
- Provides means to get all the images in a certain extent
- Maintains a KNN index of all the images loaded (serialized metadata only).
- Maintains an LRU cache of the instantiated [PanoramaImage](#PanoramaImage) objects.

### PanoramaImage

Holds all the metadata required to render the image:

- name
- position
- orientation.
- Potentially others (such as min / max depth).

Behavior:

- It provides the transformation matrix to render the sphere by and an inverse to transform world to sphere coordinates.
- It provides a [PanoramaTileProvider](#PanoramaTileProvider) to load the image data.

### PanoramaImageTile

Represents the tile of an image.

- Renders as a wedge with its image data as texture.
- Provide a primitive to the [PanoramaImageView](#PanoramaImageView).
- Caches the primitive.

### PanoramaTileProvider

A construct that is able to load image data with a certain strategy (static or COG come to mind) and provide it to the tile.

- The tile provider is valid for one image.
- Provides [PanoramaImageTiles](#PanoramaImageTile) based on tile coordinates and caches them on the image.
- Provides a method to perform „getDepth“ at a spherical coordinate and „getDepthMostDetailed“ at a spherical coordinate.
- Maintains a cache of its loaded [PanoramaImageTiles](#PanoramaImageTile). (LRU?)
- Maintains a cache of its loaded depth data. (LRU?)

### PanoramaImageView

This construct is similar to the ol.View and describes a scene based on an image.

- Renders an image into the cesium scene.
- Requests [PanoramaImageTiles](#PanoramaImageTile) from the current images [PanoramaTileProvider](#PanoramaTileProvider).
- Renders the primitives as provided by the tiles loaded.
- Ensures a base level „shell“ is always rendered.
- Determines which tiles to render.
- Fires map interaction events.
- Can load/unload images? This would mean, the View is kept stable on the [PanoramaMap](#PanoramaMap).

### PanoramaMap

This is the `VCMap` interface which allows us to treat the panorama data as a map.

- Shows a current image (or a blank image, if there isn’t one) by using the [PanoramaImageView](#PanoramaImageView). (This behavior needs to be defined)
- Can load a Viewpoint.
- Can determine, if a viewpoint is visible (by using min / max depth)
- Can load / unload data sets. (More than one at a time?).
  - Maintains an index of all currently available images if more than one datasource can be loaded.

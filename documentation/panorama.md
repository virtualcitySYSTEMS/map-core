# Panorama

Panorama image handling in the VCMap.

## Current Challenges

- Camera orientation and navigation. currently, the camera turns around ellipsoid up and not around the spheres coordiante system.
- Navigation only works, if the image is not tilted.

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

## Concepts: Coordinate Systems

The panorama image is rendered into a sphere using the cesium renderer. There is some
coordinate magic to take into account. There are three coordinate systems to consider:

- The cartesian world coordinate system (ECEF) which is used by cesium. This is the coordinate system the camera moves in.
- The cartesian sphere coordinate system which is used to render the sphere.
  This is a coordinate system where the sphere is positioned in ECEF using the images modelMatrix. The camera is always at the origin.
  It must be ensured, that the camera is aligned to the spheres up vector. It may not roll, otherwise FOV calculations will be off.
- The spherical coordinate system of the flipped image we are rendering into the sphere.

Transformation: ECEF -> image coordinate. You can find these transformations in the `sphericalCoordinates.ts` module.
`globalCartesianToImageSpherical` does the following:

- You can move from ECEF into the spheres cartesian coordinate system by inversing the images model matrix.
- You can then place the cartesian sphere coordinate system into the spherical coordinate system by normalizing this point.
  This places the point on the unit sphere. You can then calculate the spherical coordinates.
- We then flip the X axis, same as the image data, to get the correct image coordinates.

## Concept: FOV

The FOV is defined by the camera. Once calculated in ECEF, we move it to image coordinates system and create the
bounds. Helper functions are found `fovHelpers.ts`. The following restriction apply:

- The FOV can wrap around the X axis. You will get one in general or two bounds if it wraps around.
- We do not wrap around the Y axis. This is a restriction of the current implementation.
- Thus, you must ensure that the camera is always aligned to the spheres up vector.
- You must restrict the view, so the pole will never be in view (slightly is not a problem, since we render a shell)

## Concept: Tiling

The image data is tiled. We request tiles based on the current FOV _extent_ (we thus load too many tiles).
The tile leve is determined by the current FOV bounds number of pixel & angle _at the center_ this means, when looking
upward (or downward) higher resolution tiles are loaded then at the equator. To not tax the GPU too much we do the
following:

- We always render a level 0 (or maybe 1, could be configurable) shell around the sphere.
- Starting at level 3, we stop rendering polar regions directly, in this case, only the shell is rendered at the polar regions.

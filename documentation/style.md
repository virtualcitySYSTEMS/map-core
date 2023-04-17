# Style
Most of this section is incomplete and shall have more content in future.

- [Using ol.style.Style on ol.Feature](#Using ol.style.Style on ol.Feature)
- [Arrows](#arrows)
- [Arcs](#arcs)

## Using ol.style.Style on ol.Feature
To style a single `Feature`, you shall call the `.setStyle()` method with a 
`StyleLike`. There are certain exceptions: when hiding or highlighting 
features. It is required to use the layers `FeatureVisibility` or the `LayerCollection`s
`.globalHider` to hide and highlight features.
This ensures the features _style_ remains correct, even though the feature
is rendered differently. The reason this works, is because he `@vcmap/core` patches
`ol.Feature.prototype.getStyleFunction` to ensure hidden features are hidden
and highlighted features highlighted _without_ changing the style on the feature.

```javascript
import { LayerCollection, VectorLayer } from '@vcmap/core';
import { Feature } from 'ol';
import { LineString } from 'ol/geom';
import { Style, Stroke } from 'ol/style';

const collection = new LayerCollection();
const layer = new VectorLayer({});
collection.add(layer);

const features = [
  new Feature({ geometry: new LineString([[0, 0], [1, 0]]) }),
  new Feature({ geometry: new LineString([[0, 0], [0, 1]]) }),
];

const featureStyle = new Style({ stroke: new Stroke({ color: '#000000', widht: 1 }) });
features.forEach((f) => { f.setStyle(featureStyle); });

const [id1, id2] = layer.addFeatures(features);
// the first feature is red
layer.featureVisibility.highlight({ 
  [id1]: new Style({ stroke: new Storke({ color: '#FF0000', width: 4 }) }), 
});

// the second feature is hidden
collection.globalHider.hideObjects([id2]); 

features.forEach((f) => {
  assert(f.getStyle() === featureStyle);
  assert(!f.getStyleFunction()().includes(featureStyle));
});
``` 

## Arrows
You can create an `ArrowStyle`, which is a specialized `ol.style.Style`. It will
render an arrow head at the end of a `ol.geom.LineString`. It will not render _any other
geometry_. You can have arrow heads at the _start_, _end_ or at _both_ ends of your 
line by setting the `end` configuration using the `ArrowEnd` enum.

```javascript
import { ArrowStyle, ArrowEnd, VectorLayer } from '@vcmap/core';

const style = new ArrowStyle({
  color: '#FF0000', // sets the color of the arrow head & the line
  end: ArrowEnd.BOTH, // have an arrow at both ends of the line
});

const layer = new VectorLayer({});
layer.setStyle(style);
```

To define the shape of the arrow head, you can provide your own definition of the 
`Primitive` to be rendered in 3D. The `ol.style.Icon` used in 2D can be deduced
for primitives of type: `SPHERE`, `BOX` & `CYLINDER`. By default, the arrow head
is a `CYLINDER` with a top radius of 0, resulting in a triangle representation
in 2D. You could use a cube as follows:

```javascript
import { ArrowStyle, PrimitiveOptionsType } from '@vcmap/core';

const style = new ArrowStyle({
  color: '#FF0000', // sets the color of the arrow head & the line
  primitiveOptions: { // sets a box, which will result in a square 2D representation
    type: PrimitiveOptionsType.BOX,
    geometryOptions: {
      minimum: [0, 0, 0],
      maximum: [6, 6, 9],
    },
    offset: [-3, -3, 0],
  },
});
```

You can also provide a custom 2D icon.

```javascript
import { ArrowStyle } from '@vcmap/core';

// create a custom white svg icon
const radius = 10;
const icon = `<svg height="${radius * 2}" width="${radius * 2}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${radius}" cy="${radius}" r="${radius}" style="fill:white;" />
</svg>`;

const style = new ArrowStyle({
  color: '#FF0000', // sets the color of the line
  arrowIcon: {
    src: `data:image/svg+xml,${encodeURIComponent(icon)}`,
    color: '#00FF00', // arrow head is now green
  },
});
```

### Arcs
The `ArcStyle` is a special kind of `ArrowStyle`. It will render an _arc_ from
the first point to the last point of LineString geometries. If the geometries have
3D coordinates, the arcs will be 3D as well (otherwise they are drapped onto the terrain).
Usage is the same as an arrow style:

```javascript
import { ArcStyle, ArrowEnd, VectorLayer } from '@vcmap/core';

const style = new ArcStyle({
  color: '#FF0000', // sets the color of the arrow head & the line
  end: ArrowEnd.BOTH, // have an arrow at both ends of the line
});

const layer = new VectorLayer({});
layer.setStyle(style);
```

You can draw arcs _without_ arrows too:

```javascript
import { ArcStyle, ArrowEnd } from '@vcmap/core';

const style = new ArcStyle({
  end: ArrowEnd.NONE, // no arrow heads drawn
});
```

You can define the `arcFactor`, which states how extreme the arc is. An arcFactor of 
`0.5` will lead to the arc following a circle path with the center at the mid point 
of start and end.

```javascript
import { ArcStyle } from '@vcmap/core';

const style = new ArcStyle({ arcFactor: 0.2 });
style.arcFactor = 0.5; // you can change the arc factor. You must redraw yourself
```

The arc is rendered in `segments`. By default, this is 64. You can set the number
of segments to either get smoother arcs or better performance.

```javascript
import { ArcStyle } from '@vcmap/core';

const style = new ArcStyle({ numberOfSegments: 128 });
style.numberOfSegments = 16; // you can change the number of segments. You must redraw yourself
```

# Feature Provider

There are three types of feature providers:

1. feature providers which provide a feature for a given location & resolution (see [AbstractFeatureProvider](../src/featureProvider/abstractFeatureProvider.ts))
2. feature providers which only provide _attributes_ for an existing feature
   (see [AbstractAttributeProvider](../src/featureProvider/abstractAttributeProvider.ts)).
3. a composite feature provider which combines both feature and attribute providers
   (see [CompositeFeatureProvider](../src/featureProvider/compositeFeatureProvider.ts) & [Composition](#composition)).

There are some built-in feature & attribute providers:

- [TileProviderFeatureProvider](../src/featureProvider/tileProviderFeatureProvider.ts): provides features from a tile provider.
- [WMSFeatureProvider](../src/featureProvider/wmsFeatureProvider.ts): provides features from a WMS server with a feature info response.
- [UrlIdAttributeProvider](../src/featureProvider/urlIdAttributeProvider.ts): provides attributes for features based on their ID from a given URL template.

## Composition

You can combine multiple types of providers by using a composition feature provider.
This will provide features from multiple sources or add attributes from multiple attribute providers to the same feature
or do both. Composition brings with it some restrictions:

- Event though you can combine multiple feature providers, you can only define one `showGeometry` & `mapTypes`
  option for the composite provider. On construction, this is _enforced_ by mutating the individual
  providers to have the same map types as the composite provider.
- If you construct a composite provider from the class registry, make sure to have the options set to instances and not
  serialized providers.
- You cannot _clone_ a composite provider. If you need to clone a composite provider, you need to clone
  the individual providers and create a new composite provider from them. You cannot do `new CompositeFeatureProvider(existingCompositeProvider.toJSON())`.
- A composite provider will only augment multiple features if all attribute providers
  implement the `augmentFeatures` interface.

### A Note on Serialization

In general, feature providers can be serialized to JSON when serializing the layer.¨
However, to deserialize the layer (with its feature provider) from JSON, you
must use the `deserializeLayer` helper or `app.layers.parseItems`. This is especially
important for composite feature providers, as they need to deserialize the individual
providers correctly, but can only fully be restored when provided _instances_. Use
the `deserializeFeatureProvider` helper to deserialize individual feature providers.

## Implementing a Feature Provider

To implement a custom feature provider, you need to extend the `AbstractFeatureProvider` class and implement the
`getFeaturesByCoordinate` method. This method should resolve to an array of features for the given location and resolution.

To implement a custom attribute provider, you need to extend the `AbstractAttributeProvider` class and implement the
protected `_getAttributes` method. This method should resolve to an object of attributes for the given feature.

Furthermore, an attribute provider used in providing attributes to tiled layers,
can also implement the `_getBulkAttributes` interface, which allows to modify features
in bulk. It is passed an array of keys and features, plus the extent.

This is an example implementation of a custom attribute provider which uses an r-tree
to provide attributes in bulk for features within a given extent:

```ts
import {
  type EventFeature,
  AbstractAttributeProvider,
  type CesiumTilesetLayerOptions,
} from '@vcmap/core';
import RBush from 'rbush';

class MyCustomAttributeProvider extends AbstractAttributeProvider {
  /**
   * my data. get it from somewhere
   */
  data = new Map<string, Record<string, unknown>>();

  /**
   * my data. rtree optimized for loading from extent. you could also request data from a WFS or similar
   */
  rtree = new RBush<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    value: Record<string, unknown>;
    id: string;
  }>();

  protected async _getAttributes(
    key: string,
    feature: EventFeature,
  ): Promise<Record<string, unknown> | undefined> {
    return this.data.get(key);
  }

  // if you dont optimize for bulk, you dont have to implement this method
  protected async _getBulkAttributes(
    bulk: { key: string; feature: EventFeature }[],
    extent: Extent,
  ): Promise<(Record<string, any> | undefined)[]> {
    const results: (Record<string, unknown> | undefined)[] = new Array(
      bulk.length,
    );
    // search rtree for items in extent
    // or fetch from WFS or similar
    const searchResult = this.rtree.search({
      minX: extent[0],
      minY: extent[1],
      maxX: extent[2],
      maxY: extent[3],
    });

    for (let i = 0; i < bulk.length; i++) {
      const key = bulk[i].key;
      const dataItem = searchResult.find((item) => item.id === key);
      if (dataItem) {
        results[i] = dataItem.value;
      } else {
        results[i] = undefined; // no data found for this feature. you can also fill array with undefined. or what have you
      }
    }
    return results;
  }
}

/**
 * Initialize within a plugin like this, so that the provider is registered and can be used in layer configs
 * @param app
 */
function init(app: VcsApp): void {
  app.featureProviderClassRegistry.registerClass(
    MyCustomAttributeProvider.className,
    MyCustomAttributeProvider,
  );
}

/**
 * Example layer config using the custom feature provider
 */
function getLayerConfigWithFeatureProvider(): CesiumTilesetLayerOptions {
  return {
    // ...
    featureProvider: {
      type: 'CompositeFeatureProvider',
      attributeProviders: [
        {
          type: 'MyCustomAttributeProvider',
          // custom options here
        },
      ],
    },
  };
}

/**
 * Example layer config using the custom attribute provider. This works for CesiumTileset layers
 * and VectorTile layers and uses the attribute provider on data load.
 */
function getLayerConfigWithAttributeProvider(): CesiumTilesetLayerOptions {
  return {
    // ...
    attributeProvider: {
      type: 'MyCustomAttributeProvider',
      // custom options here
    },
  };
}
```

If you provide a custom feature or attribute provider in a plugin, make sure to register it
to the `app.featureProviderClassRegistry` in the plugins initialization phase.

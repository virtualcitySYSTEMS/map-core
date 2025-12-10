import { expect } from 'chai';
import { Feature } from 'ol';
import { Cartesian2 } from '@vcmap-cesium/engine';
import OpenlayersMap from '../../../src/map/openlayersMap.js';
import AbstractFeatureProvider, {
  type AbstractFeatureProviderOptions,
} from '../../../src/featureProvider/abstractFeatureProvider.js';
import FeatureProviderInteraction from '../../../src/interaction/featureProviderInteraction.js';
import type { InteractionEvent } from '../../../src/interaction/abstractInteraction.js';
import type LayerCollection from '../../../src/util/layerCollection.js';
import VectorLayer from '../../../src/layer/vectorLayer.js';
import { isProvidedClusterFeature } from '../../../src/featureProvider/featureProviderSymbols.js';
import {
  CompositeFeatureProvider,
  EventType,
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
  vcsLayerName,
} from '../../../index.js';
import TestAttributeProvider from '../featureProvider/testAttributeProvider.js';

class TestFeatureProvider extends AbstractFeatureProvider {
  static get className(): string {
    return 'TestFeatureProvider';
  }

  constructor(
    private _features: Feature[],
    options: AbstractFeatureProviderOptions,
  ) {
    super(options);
  }

  getFeaturesByCoordinate(): Promise<Feature[]> {
    return Promise.resolve(this._features);
  }
}

async function addLayerWithFeatureProvider(
  layerCollection: LayerCollection,
  features: Feature[],
): Promise<VectorLayer> {
  const layer = new VectorLayer({});
  layer.featureProvider = new TestFeatureProvider(features, {
    mapTypes: [OpenlayersMap.className],
  });
  await layer.activate();
  layerCollection.add(layer);
  return layer;
}

async function addLayerWithAttributeProvider(
  layerCollection: LayerCollection,
  value: number,
): Promise<VectorLayer> {
  const layer = new VectorLayer({});
  layer.featureProvider = new TestAttributeProvider(value);
  await layer.activate();
  layerCollection.add(layer);
  return layer;
}

describe('FeatureProviderInteraction', () => {
  let map: OpenlayersMap;
  let interaction: FeatureProviderInteraction;

  function getDummyEvent(feature?: Feature): InteractionEvent {
    return {
      key: ModificationKeyType.NONE,
      pointer: PointerKeyType.LEFT,
      pointerEvent: PointerEventType.UP,
      type: EventType.CLICK,
      windowPosition: new Cartesian2(1, 1),
      map,
      position: [0, 0, 0],
      feature,
    };
  }

  before(() => {
    map = new OpenlayersMap({});
    interaction = new FeatureProviderInteraction();
  });

  afterEach(() => {
    [...map.layerCollection].forEach((l) => {
      l.destroy();
    });
    map.layerCollection.clear();
  });

  after(() => {
    interaction.destroy();
    map.destroy();
  });

  describe('providing features on interaction', () => {
    it('should retrieve the feature from a layer with a supported feature info', async () => {
      const feature = new Feature();
      await addLayerWithFeatureProvider(map.layerCollection, [feature]);
      const event = getDummyEvent();
      await interaction.pipe(event);
      expect(event).to.have.property('feature', feature);
    });

    it('should return a cluster feature if providing multiple features', async () => {
      const feature1 = new Feature();
      const feature2 = new Feature();
      await addLayerWithFeatureProvider(map.layerCollection, [
        feature1,
        feature2,
      ]);
      const event = getDummyEvent();
      await interaction.pipe(event);
      expect(event).to.have.property('feature');
      expect(event.feature).to.have.property(isProvidedClusterFeature, true);
      const features = (event.feature as Feature)?.get('features') as Feature[];
      expect(features).to.have.ordered.members([feature1, feature2]);
    });

    it('should not overwrite a feature, if the event already has a feature', async () => {
      const feature = new Feature();
      await addLayerWithFeatureProvider(map.layerCollection, [
        new Feature(),
        new Feature(),
      ]);
      const event = getDummyEvent();
      event.feature = feature;
      await interaction.pipe(event);
      expect(event).to.have.property('feature', feature);
    });

    it('should order layers based on order they were added', async () => {
      const feature1 = new Feature();
      const feature2 = new Feature();
      await addLayerWithFeatureProvider(map.layerCollection, [feature1]);
      await addLayerWithFeatureProvider(map.layerCollection, [feature2]);
      const event = getDummyEvent();
      await interaction.pipe(event);
      expect(event).to.have.property('feature');
      const features = (event.feature as Feature)?.get('features') as Feature[];
      expect(features).to.have.ordered.members([feature2, feature1]);
    });

    it('should skip layers which do not provide a feature at said pixel', async () => {
      const feature = new Feature();
      await addLayerWithFeatureProvider(map.layerCollection, [feature]);
      await addLayerWithFeatureProvider(map.layerCollection, []);
      const event = getDummyEvent();
      await interaction.pipe(event);
      expect(event).to.have.property('feature', feature);
    });

    it('should respect the layers zIndex', async () => {
      const feature1 = new Feature();
      const feature2 = new Feature();
      const layer = await addLayerWithFeatureProvider(map.layerCollection, [
        feature1,
      ]);
      layer.zIndex = 2;
      await addLayerWithFeatureProvider(map.layerCollection, [feature2]);
      const event = getDummyEvent();
      await interaction.pipe(event);
      expect(event).to.have.property('feature');
      const features = (event.feature as Feature)?.get('features') as Feature[];
      expect(features).to.have.ordered.members([feature1, feature2]);
    });
  });

  describe('augmentation of features on interaction', () => {
    it('should augment a feature with attributes from the layers attribute provider', async () => {
      const layer = await addLayerWithAttributeProvider(
        map.layerCollection,
        42,
      );
      const feature = new Feature();
      feature.setId('feature1');
      feature[vcsLayerName] = layer.name;
      const event = getDummyEvent(feature);
      await interaction.pipe(event);
      expect(feature.get('testAttribute')).to.equal(42);
    });

    it('should not augment a feature if the layer has no attribute provider', async () => {
      const layer = new VectorLayer({});
      await layer.activate();
      map.layerCollection.add(layer);
      const feature = new Feature();
      feature.setId('feature1');
      feature[vcsLayerName] = layer.name;
      const event = getDummyEvent(feature);
      await interaction.pipe(event);
      expect(feature.get('testAttribute')).to.be.undefined;
    });

    it('should augment a provided feature with attributes from the layers attribute provider', async () => {
      const feature = new Feature();
      feature.setId('feature1');
      const layer = await addLayerWithFeatureProvider(map.layerCollection, []);
      layer.featureProvider = new CompositeFeatureProvider({
        featureProviders: [layer.featureProvider!],
        attributeProviders: [new TestAttributeProvider(64)],
      });
      layer.featureProvider.getProviderFeature(feature, layer);
      const event = getDummyEvent(feature);
      await interaction.pipe(event);
      expect(feature.get('testAttribute')).to.equal(64);
    });
  });
});

import { expect } from 'chai';
import { Feature } from 'ol';
import type { Coordinate } from 'ol/coordinate.js';
import type { Geometry } from 'ol/geom.js';
import OpenlayersMap from '../../../src/map/openlayersMap.js';
import AbstractFeatureProvider from '../../../src/featureProvider/abstractFeatureProvider.js';
import FeatureProviderInteraction from '../../../src/interaction/featureProviderInteraction.js';
import type { InteractionEvent } from '../../../src/interaction/abstractInteraction.js';
import type LayerCollection from '../../../src/util/layerCollection.js';
import VectorLayer from '../../../src/layer/vectorLayer.js';
import { isProvidedClusterFeature } from '../../../src/featureProvider/featureProviderSymbols.js';

async function addLayerWithFeatureProvider(
  layerCollection: LayerCollection,
  getFeatureByCoordinate: (
    _coordinate: Coordinate,
    _resolution: number,
    _headers?: Record<string, string>,
  ) => Promise<Feature<Geometry>[]>,
): Promise<VectorLayer> {
  const layer = new VectorLayer({});
  layer.featureProvider = new AbstractFeatureProvider(layer.name, {
    mapTypes: [OpenlayersMap.className],
  });
  layer.featureProvider.getFeaturesByCoordinate = getFeatureByCoordinate;
  await layer.activate();
  layerCollection.add(layer);
  return layer;
}

describe('FeatureProviderInteraction', () => {
  let map: OpenlayersMap;
  let interaction: FeatureProviderInteraction;

  function getDummyEvent(): InteractionEvent {
    return {
      map,
      position: [0, 0, 0],
    } as unknown as InteractionEvent;
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

  it('should retrieve the feature from a layer with a supported feature info', async () => {
    const feature = new Feature();
    await addLayerWithFeatureProvider(map.layerCollection, () =>
      Promise.resolve([feature]),
    );
    const event = getDummyEvent();
    await interaction.pipe(event);
    expect(event).to.have.property('feature', feature);
  });

  it('should return a cluster feature if providing multiple features', async () => {
    const feature1 = new Feature();
    const feature2 = new Feature();
    await addLayerWithFeatureProvider(map.layerCollection, () =>
      Promise.resolve([feature1, feature2]),
    );
    const event = getDummyEvent();
    await interaction.pipe(event);
    expect(event).to.have.property('feature');
    expect(event.feature).to.have.property(isProvidedClusterFeature, true);
    const features = (event.feature as Feature)?.get('features') as Feature[];
    expect(features).to.have.ordered.members([feature1, feature2]);
  });

  it('should not overwrite a feature, if the event already has a feature', async () => {
    const feature = new Feature();
    await addLayerWithFeatureProvider(map.layerCollection, () =>
      Promise.resolve([new Feature()]),
    );
    const event = getDummyEvent();
    event.feature = feature;
    await interaction.pipe(event);
    expect(event).to.have.property('feature', feature);
  });

  it('should order layers based on order they were added', async () => {
    const feature1 = new Feature();
    const feature2 = new Feature();
    await addLayerWithFeatureProvider(map.layerCollection, () =>
      Promise.resolve([feature1]),
    );
    await addLayerWithFeatureProvider(map.layerCollection, () =>
      Promise.resolve([feature2]),
    );
    const event = getDummyEvent();
    await interaction.pipe(event);
    expect(event).to.have.property('feature');
    const features = (event.feature as Feature)?.get('features') as Feature[];
    expect(features).to.have.ordered.members([feature2, feature1]);
  });

  it('should skip layers which do not provide a feature at said pixel', async () => {
    const feature = new Feature();
    await addLayerWithFeatureProvider(map.layerCollection, () =>
      Promise.resolve([feature]),
    );
    await addLayerWithFeatureProvider(map.layerCollection, () =>
      Promise.resolve([]),
    );
    const event = getDummyEvent();
    await interaction.pipe(event);
    expect(event).to.have.property('feature', feature);
  });

  it('should respect the layers zIndex', async () => {
    const feature1 = new Feature();
    const feature2 = new Feature();
    const layer = await addLayerWithFeatureProvider(map.layerCollection, () =>
      Promise.resolve([feature1]),
    );
    layer.zIndex = 2;
    await addLayerWithFeatureProvider(map.layerCollection, () =>
      Promise.resolve([feature2]),
    );
    const event = getDummyEvent();
    await interaction.pipe(event);
    expect(event).to.have.property('feature');
    const features = (event.feature as Feature)?.get('features') as Feature[];
    expect(features).to.have.ordered.members([feature1, feature2]);
  });
});

import { Feature } from 'ol';
import {
  VectorLayer,
  OpenlayersMap,
  AbstractFeatureProvider,
} from '../../../index.js';
import FeatureProviderInteraction from '../../../src/interaction/featureProviderInteraction.js';

async function addLayerWithFeatureProvider(
  layerCollection,
  getFeatureByCoordinate,
) {
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
  let map;
  let interaction;
  function getDummyEvent() {
    return {
      map,
      position: [0, 0, 0],
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

  it('should retrieve the feature from a layer with a supported feature info', async () => {
    const feature = new Feature();
    await addLayerWithFeatureProvider(map.layerCollection, () => [feature]);
    const event = getDummyEvent();
    await interaction.pipe(event);
    expect(event).to.have.property('feature', feature);
  });

  it('should return the first feature if returning an array', async () => {
    const feature = new Feature();
    await addLayerWithFeatureProvider(map.layerCollection, () => [
      feature,
      new Feature(),
    ]);
    const event = getDummyEvent();
    await interaction.pipe(event);
    expect(event).to.have.property('feature', feature);
  });

  it('should not overwrite a feature, if the event already has a feature', async () => {
    const feature = new Feature();
    await addLayerWithFeatureProvider(map.layerCollection, () => [
      new Feature(),
    ]);
    const event = getDummyEvent();
    event.feature = feature;
    await interaction.pipe(event);
    expect(event).to.have.property('feature', feature);
  });

  it('should order layers based on order they where added', async () => {
    const feature = new Feature();
    await addLayerWithFeatureProvider(map.layerCollection, () => [
      new Feature(),
    ]);
    await addLayerWithFeatureProvider(map.layerCollection, () => [feature]);
    const event = getDummyEvent();
    await interaction.pipe(event);
    expect(event).to.have.property('feature', feature);
  });

  it('should skip layer which do not provide a feature at said pixel', async () => {
    const feature = new Feature();
    await addLayerWithFeatureProvider(map.layerCollection, () => [feature]);
    await addLayerWithFeatureProvider(map.layerCollection, () => []);
    const event = getDummyEvent();
    await interaction.pipe(event);
    expect(event).to.have.property('feature', feature);
  });

  it('should respect the layers zIndex', async () => {
    const feature = new Feature();
    const layer = await addLayerWithFeatureProvider(map.layerCollection, () => [
      feature,
    ]);
    layer.zIndex = 2;
    await addLayerWithFeatureProvider(map.layerCollection, () => [
      new Feature(),
    ]);
    const event = getDummyEvent();
    await interaction.pipe(event);
    expect(event).to.have.property('feature', feature);
  });
});

import { expect } from 'chai';
import sinon from 'sinon';
import Feature from 'ol/Feature.js';
import { Cartesian2 } from '@vcmap-cesium/engine';
import Point from 'ol/geom/Point.js';
import {
  EventType,
  type InteractionEvent,
  MapCollection,
  ModificationKeyType,
  OpenlayersMap,
  PointerEventType,
  PointerKeyType,
} from '../../../index.js';
import PanoramaImageSelection from '../../../src/interaction/panoramaImageSelection.js';
import PanoramaDataset from '../../../src/panorama/panoramaDataset.js';
import { panoramaFeature } from '../../../src/layer/vectorSymbols.js';
import {
  getPanoramaImage,
  getPanoramaMap,
} from '../helpers/panoramaHelpers.js';
import type PanoramaMap from '../../../src/map/panoramaMap.js';

describe('PanoramaImageSelection', () => {
  let panoramaMap: PanoramaMap;
  let mapCollection: MapCollection;
  let interaction: PanoramaImageSelection;
  let event: InteractionEvent;
  let map: OpenlayersMap;
  let feature: Feature;
  let dataset: PanoramaDataset;
  let activatePanoramaMapStub: sinon.SinonStub;
  let destroyPanoramaImage: () => void;

  before(async () => {
    mapCollection = new MapCollection();
    map = new OpenlayersMap({});
    panoramaMap = getPanoramaMap();
    mapCollection.add(map);
    mapCollection.add(panoramaMap);
    event = {
      pointerEvent: PointerEventType.DOWN,
      map,
      windowPosition: new Cartesian2(10, 10),
      pointer: PointerKeyType.LEFT,
      type: EventType.CLICK,
      key: ModificationKeyType.NONE,
    };
    feature = new Feature({
      geometry: new Point([0, 0]),
    });
    dataset = new PanoramaDataset({
      url: 'foo',
    });
    feature.setId('testPanoramaFeature');
    feature[panoramaFeature] = {
      dataset,
      name: 'testPanorama',
      time: '2023-10-01T00:00:00Z',
    };
    activatePanoramaMapStub = sinon.stub(mapCollection, 'activatePanoramaMap');
    const { panoramaImage, destroy } = await getPanoramaImage();
    sinon.stub(dataset, 'createPanoramaImage').resolves(panoramaImage);
    destroyPanoramaImage = destroy;
  });

  beforeEach(() => {
    interaction = new PanoramaImageSelection(mapCollection);
  });

  afterEach(() => {
    interaction.destroy();
    activatePanoramaMapStub.resetHistory();
  });

  after(() => {
    map.destroy();
    panoramaMap.destroy();
    dataset.destroy();
    mapCollection.destroy();
    destroyPanoramaImage();
  });

  it('should activate panorama image on click', async () => {
    await interaction.pipe({ ...event, feature });
    expect(activatePanoramaMapStub).to.have.been.calledOnce;
  });

  it('should not activate panorama image if feature is not a panorama feature', async () => {
    await interaction.pipe({ ...event, feature: new Feature() });
    expect(activatePanoramaMapStub).to.not.have.been.called;
  });

  it('should stop propagation if provided a panorama image feature', async () => {
    const nextEvent = await interaction.pipe({ ...event, feature });
    expect(nextEvent.stopPropagation).to.be.true;
  });

  describe('with a panorama map active', () => {
    let setCurrentImageStub: sinon.SinonStub;

    before(() => {
      setCurrentImageStub = sinon.stub(panoramaMap, 'setCurrentImage');
    });

    afterEach(() => {
      setCurrentImageStub.resetHistory();
    });

    it('should set the current image on the panorama map', async () => {
      await interaction.pipe({ ...event, feature, map: panoramaMap });
      expect(setCurrentImageStub).to.have.been.calledOnce;
      expect(activatePanoramaMapStub).to.not.have.been.called;
    });

    it('should not set the current panorama image if feature is not a panorama feature', async () => {
      await interaction.pipe({
        ...event,
        feature: new Feature(),
        map: panoramaMap,
      });
      expect(setCurrentImageStub).to.not.have.been.called;
      expect(activatePanoramaMapStub).to.not.have.been.called;
    });
  });
});

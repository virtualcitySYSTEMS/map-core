import { Cartesian2 } from '@vcmap-cesium/engine';
import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import { expect } from 'chai';
import sinon from 'sinon';
import PanoramaFeatureHighlight from '../../../src/interaction/panoramaFeatureHighlight.js';
import type { InteractionEvent } from '../../../src/interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
  OpenlayersMap,
  PointerEventType,
  PointerKeyType,
} from '../../../index.js';
import { getPanoramaMap } from '../helpers/panoramaHelpers.js';
import { panoramaFeature } from '../../../src/layer/vectorSymbols.js';
import PanoramaDatasetLayer from '../../../src/layer/panoramaDatasetLayer.js';
import { timeout } from '../helpers/helpers.js';
import type PanoramaMap from '../../../src/map/panoramaMap.js';

describe('PanoramaFeatureHighlight', () => {
  let map: PanoramaMap;
  let interaction: PanoramaFeatureHighlight;
  let testEvent: InteractionEvent;
  let feature: Feature;
  let dataset: PanoramaDatasetLayer;
  let pickStub: sinon.SinonStub;

  before(() => {
    map = getPanoramaMap();
    feature = new Feature({
      geometry: new Point([0, 0]),
    });
    dataset = new PanoramaDatasetLayer({
      url: 'foo',
    });
    feature.setId('testPanoramaFeature');
    feature[panoramaFeature] = {
      dataset,
      name: 'testPanorama',
      time: '2023-10-01T00:00:00Z',
    };

    testEvent = {
      map,
      windowPosition: new Cartesian2(100, 100),
      type: EventType.MOVE,
      pointerEvent: PointerEventType.MOVE,
      key: ModificationKeyType.NONE,
      pointer: PointerKeyType.ALL,
    };
  });

  beforeEach(() => {
    interaction = new PanoramaFeatureHighlight();
    pickStub = sinon.stub(map.getCesiumWidget().scene, 'pick');
  });

  afterEach(() => {
    interaction.destroy();
    pickStub.restore();
  });

  after(() => {
    map.destroy();
  });

  describe('without a highlighted panorama feature', () => {
    it('should highlight the panorama feature', async () => {
      pickStub.returns({
        id: { olFeature: feature },
      });
      await interaction.pipe({ ...testEvent });
      expect(dataset.featureVisibility.highlightedObjects).to.have.property(
        'testPanorama',
      );
    });

    it('should not highlight random features', async () => {
      const randomFeature = new Feature({
        geometry: new Point([1, 1]),
      });
      randomFeature.setId('randomFeature');
      pickStub.returns({
        id: { olFeature: randomFeature },
      });
      await interaction.pipe({ ...testEvent });
      expect(dataset.featureVisibility.highlightedObjects).to.be.empty;
    });
  });

  describe('with a highlighted panorama feature', () => {
    beforeEach(async () => {
      pickStub.returns({
        id: { olFeature: feature },
      });
      await interaction.pipe({ ...testEvent });
      await timeout(100); // wait for min frame length
    });

    it('should unhighlight the panorama feature, if no feature is present', async () => {
      pickStub.returns(undefined);
      await interaction.pipe({ ...testEvent });
      expect(dataset.featureVisibility.highlightedObjects).to.be.empty;
    });

    it('should not highlight a panorama feature with the same name', async () => {
      const spy = sinon.spy(dataset.featureVisibility, 'highlight');
      pickStub.returns({
        id: { olFeature: feature },
      });
      await interaction.pipe({ ...testEvent });
      expect(spy).to.not.have.been.called;
    });

    it('should unhighlight on destruction', () => {
      interaction.destroy();
      expect(dataset.featureVisibility.highlightedObjects).to.be.empty;
    });

    describe('when map is not a panorama map', () => {
      let secondMap: OpenlayersMap;

      before(() => {
        secondMap = new OpenlayersMap({});
      });

      after(() => {
        secondMap.destroy();
      });

      it('should unhighlight, if passed another map', async () => {
        pickStub.returns({
          id: { olFeature: feature },
        });
        await interaction.pipe({ ...testEvent, map: secondMap });
        expect(dataset.featureVisibility.highlightedObjects).to.be.empty;
      });
    });
  });

  describe('throttling of events', () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      clock = sinon.useFakeTimers(Date.now());
    });

    afterEach(() => {
      clock.restore();
    });

    it('should process first event immediately, ignoring any other features', async () => {
      pickStub.returns(undefined);
      await interaction.pipe({ ...testEvent });
      pickStub.returns({
        id: { olFeature: feature },
      });
      await interaction.pipe({ ...testEvent });
      expect(dataset.featureVisibility.highlightedObjects).to.be.empty;
    });

    it('should process first event immediately, ignoring any empty events that follow', async () => {
      pickStub.returns({
        id: { olFeature: feature },
      });
      await interaction.pipe({ ...testEvent });
      pickStub.returns(undefined);
      await interaction.pipe({ ...testEvent });
      expect(dataset.featureVisibility.highlightedObjects).to.have.property(
        'testPanorama',
      );
    });

    it('should continue to evaluate events after the throttle time', async () => {
      pickStub.returns({
        id: { olFeature: feature },
      });
      await interaction.pipe({ ...testEvent });
      clock.tick(100);
      pickStub.returns(undefined);
      await interaction.pipe({ ...testEvent });
      expect(dataset.featureVisibility.highlightedObjects).to.be.empty;
    });
  });
});

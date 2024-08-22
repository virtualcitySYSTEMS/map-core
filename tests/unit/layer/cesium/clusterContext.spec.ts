import { CustomDataSource, Scene } from '@vcmap-cesium/engine';
import Feature from 'ol/Feature.js';
import { expect } from 'chai';
import { LineString, Point } from 'ol/geom.js';
import { Fill, RegularShape, Style } from 'ol/style.js';
import OlText from 'ol/style/Text.js';
import Stroke from 'ol/style/Stroke.js';
import VectorProperties from '../../../../src/layer/vectorProperties.js';
import { CesiumMap } from '../../../../index.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';
import ClusterContext from '../../../../src/layer/cesium/clusterContext.js';

describe('ClusterContext', () => {
  let dataSource: CustomDataSource;

  let map: CesiumMap;
  let scene: Scene;

  before(() => {
    dataSource = new CustomDataSource();
    map = getCesiumMap();
    scene = map.getScene()!;
  });

  after(() => {
    map.destroy();
  });

  describe('constructor', () => {
    let clusterContext: ClusterContext;

    before(() => {
      clusterContext = new ClusterContext(dataSource);
    });

    after(() => {
      clusterContext.destroy();
    });

    it('should use the data source entites', () => {
      expect(clusterContext.entities).to.equal(dataSource.entities);
    });
  });

  describe('adding a feature', () => {
    let clusterContext: ClusterContext;

    before(() => {
      clusterContext = new ClusterContext(dataSource);
    });

    afterEach(() => {
      clusterContext.clear();
    });

    after(() => {
      clusterContext.destroy();
    });

    it('should add a feature which converts to a billboard', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      await clusterContext.addFeature(
        feature,
        new Style({
          image: new RegularShape({
            points: 0,
            radius: 1,
            fill: new Fill({ color: '#ff0000' }),
          }),
        }),
        new VectorProperties({}),
        scene,
      );

      expect(clusterContext.entities.values).to.have.lengthOf(1);
    });

    it('should add a feature which converts to a label', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      await clusterContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      expect(clusterContext.entities.values).to.have.lengthOf(1);
    });

    it('should not add a feature which converts to a primitive', async () => {
      const feature = new Feature({
        geometry: new LineString([
          [1, 1, 1],
          [2, 2, 1],
        ]),
      });

      await clusterContext.addFeature(
        feature,
        new Style({
          stroke: new Stroke({
            color: '#ff0000',
            width: 1,
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      expect(clusterContext.entities.values).to.have.lengthOf(0);
    });
  });

  describe('reference setting on primitives', () => {
    let clusterContext: ClusterContext;

    before(() => {
      clusterContext = new ClusterContext(dataSource);
    });

    afterEach(() => {
      clusterContext.clear();
    });

    after(() => {
      clusterContext.destroy();
    });

    it('should not set the feature reference, if allow picking is false', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      await clusterContext.addFeature(
        feature,
        new Style({
          image: new RegularShape({
            points: 0,
            radius: 1,
            fill: new Fill({ color: '#ff0000' }),
          }),
        }),
        new VectorProperties({ allowPicking: false }),
        scene,
      );

      expect(clusterContext.entities.values[0]).to.not.have.property(
        'olFeature',
      );
    });

    it('should set the picking reference', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      await clusterContext.addFeature(
        feature,
        new Style({
          image: new RegularShape({
            points: 0,
            radius: 1,
            fill: new Fill({ color: '#ff0000' }),
          }),
        }),
        new VectorProperties({}),
        scene,
      );

      expect(clusterContext.entities.values[0]).to.have.property(
        'olFeature',
        feature,
      );
    });
  });

  describe('removing a feature', () => {
    describe('if the feature was already converted', () => {
      let clusterContext: ClusterContext;

      before(() => {
        clusterContext = new ClusterContext(dataSource);
      });

      afterEach(() => {
        clusterContext.clear();
      });

      after(() => {
        clusterContext.destroy();
      });

      it('should remove a feature which converts to a billboard', async () => {
        const feature = new Feature({
          geometry: new Point([1, 1, 1]),
        });

        await clusterContext.addFeature(
          feature,
          new Style({
            image: new RegularShape({
              points: 0,
              radius: 1,
              fill: new Fill({ color: '#ff0000' }),
            }),
          }),
          new VectorProperties({}),
          scene,
        );

        expect(clusterContext.entities.values).to.have.lengthOf(1);
        clusterContext.removeFeature(feature);
        expect(clusterContext.entities.values).to.have.lengthOf(0);
      });

      it('should remove a feature which converts to a label', async () => {
        const feature = new Feature({
          geometry: new Point([1, 1, 1]),
        });

        await clusterContext.addFeature(
          feature,
          new Style({
            text: new OlText({
              text: 'foo',
            }),
          }),
          new VectorProperties({}),
          scene,
        );

        expect(clusterContext.entities.values).to.have.lengthOf(1);
        clusterContext.removeFeature(feature);
        expect(clusterContext.entities.values).to.have.lengthOf(0);
      });
    });

    describe('if the feature is currently being converted', () => {
      let clusterContext: ClusterContext;

      before(() => {
        clusterContext = new ClusterContext(dataSource);
      });

      after(() => {
        clusterContext.destroy();
      });

      it('should not add it in the first place', async () => {
        const feature = new Feature({
          geometry: new Point([1, 1, 1]),
        });

        const promise = clusterContext.addFeature(
          feature,
          new Style({
            image: new RegularShape({
              points: 0,
              radius: 1,
              fill: new Fill({ color: '#ff0000' }),
            }),
          }),
          new VectorProperties({}),
          scene,
        );

        expect(clusterContext.entities.values).to.have.lengthOf(0);
        clusterContext.removeFeature(feature);
        await promise;
        expect(clusterContext.entities.values).to.have.lengthOf(0);
      });
    });
  });

  describe('adding a feature twice', () => {
    let clusterContext: ClusterContext;

    before(() => {
      clusterContext = new ClusterContext(dataSource);
    });

    afterEach(() => {
      clusterContext.clear();
    });

    after(() => {
      clusterContext.destroy();
    });

    it('should remove the old feature primitives and add the new ones', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      await clusterContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      await clusterContext.addFeature(
        feature,
        new Style({
          image: new RegularShape({
            points: 0,
            radius: 1,
            fill: new Fill({ color: '#ff0000' }),
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      expect(clusterContext.entities.values).to.have.lengthOf(1);
    });

    it('should only add the feature once, even if the feature is added multiple times in quick succession', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      const p1 = clusterContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      const p2 = clusterContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      const p3 = clusterContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      await Promise.all([p1, p2, p3]);
      expect(clusterContext.entities.values).to.have.lengthOf(1);
    });
  });
});

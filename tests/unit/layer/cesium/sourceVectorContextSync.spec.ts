import { expect } from 'chai';
import Feature from 'ol/Feature.js';
import VectorSource from 'ol/source/Vector.js';
import { StyleLike } from 'ol/style/Style.js';
import { LineString, Point } from 'ol/geom.js';
import {
  Primitive,
  PrimitiveCollection,
  SplitDirection,
} from '@vcmap-cesium/engine';
import { timeout } from '../../helpers/helpers.js';
import {
  CesiumMap,
  defaultVectorStyle,
  VectorContext,
  VectorProperties,
} from '../../../../index.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';
import {
  createSourceVectorContextSync,
  SourceVectorContextSync,
} from '../../../../src/layer/cesium/sourceVectorContextSync.js';

function createFeature(): Feature {
  return new Feature({
    geometry: new LineString([
      [0, 0, 1],
      [1, 1, 1],
    ]),
  });
}

function createPointFeature(): Feature {
  return new Feature({
    geometry: new Point([1, 1, 1]),
  });
}

describe('sourceVectorContextSync', () => {
  let vectorProperties: VectorProperties;
  let style: StyleLike;
  let map: CesiumMap;
  let rootCollection: PrimitiveCollection;

  before(() => {
    vectorProperties = new VectorProperties({});
    ({ style } = defaultVectorStyle);
    rootCollection = new PrimitiveCollection();
    map = getCesiumMap({});
  });

  after(() => {
    vectorProperties.destroy();
    map.destroy();
    rootCollection.destroy();
  });

  describe('creating a sourceVectorContextSync', () => {
    let vectorSource: VectorSource;
    let vectorContext: VectorContext;
    let sourceSync: SourceVectorContextSync | undefined;

    beforeEach(() => {
      vectorSource = new VectorSource();
      vectorContext = new VectorContext(
        map,
        rootCollection,
        SplitDirection.NONE,
      );
    });

    afterEach(() => {
      vectorSource.dispose();
      vectorContext.destroy();
      sourceSync?.destroy();
    });

    it('should add all features in the source when activated', () => {
      const features = [createFeature(), createPointFeature()];
      vectorSource.addFeatures(features);
      sourceSync = createSourceVectorContextSync(
        vectorSource,
        vectorContext,
        map.getScene()!,
        style,
        vectorProperties,
      );
      sourceSync.activate();
      features.forEach((f) => {
        expect(vectorContext.hasFeature(f)).to.be.true;
      });
    });
  });

  describe('adding a feature to the source', () => {
    let vectorSource: VectorSource;
    let vectorContext: VectorContext;
    let sourceSync: SourceVectorContextSync;

    beforeEach(() => {
      vectorSource = new VectorSource();
      vectorContext = new VectorContext(
        map,
        rootCollection,
        SplitDirection.NONE,
      );
      sourceSync = createSourceVectorContextSync(
        vectorSource,
        vectorContext,
        map.getScene()!,
        style,
        vectorProperties,
      );
    });

    afterEach(() => {
      vectorSource.dispose();
      vectorContext.destroy();
      sourceSync.destroy();
    });

    describe('if active', () => {
      beforeEach(() => {
        sourceSync.activate();
      });

      it('should add the feature to the context', () => {
        const features = [createFeature(), createPointFeature()];
        vectorSource.addFeatures(features);
        features.forEach((f) => {
          expect(vectorContext.hasFeature(f)).to.be.true;
        });
      });
    });

    describe('if inactive', () => {
      it('should cache the feature, adding it to the context when activated', () => {
        const features = [createFeature(), createPointFeature()];
        vectorSource.addFeatures(features);
        features.forEach((f) => {
          expect(vectorContext.hasFeature(f)).to.be.false;
        });
        sourceSync.activate();
        features.forEach((f) => {
          expect(vectorContext.hasFeature(f)).to.be.true;
        });
      });
    });
  });

  describe('removing a feature from the source', () => {
    let vectorSource: VectorSource;
    let vectorContext: VectorContext;
    let sourceSync: SourceVectorContextSync;
    let feature: Feature;

    beforeEach(() => {
      vectorSource = new VectorSource();
      vectorContext = new VectorContext(
        map,
        rootCollection,
        SplitDirection.NONE,
      );
      sourceSync = createSourceVectorContextSync(
        vectorSource,
        vectorContext,
        map.getScene()!,
        style,
        vectorProperties,
      );
      feature = createFeature();
      vectorSource.addFeature(feature);
    });

    afterEach(() => {
      vectorSource.dispose();
      vectorContext.destroy();
      sourceSync.destroy();
    });

    describe('if active', () => {
      beforeEach(() => {
        sourceSync.activate();
      });

      it('should remove the feature from the context', () => {
        vectorSource.removeFeature(feature);
        expect(vectorContext.hasFeature(feature)).to.be.false;
      });
    });

    describe('if inactive', () => {
      it('should remove the feature from the cache', () => {
        vectorSource.removeFeature(feature);
        sourceSync.activate();
        expect(vectorContext.hasFeature(feature)).to.be.false;
      });
    });
  });

  describe('changing a feature', () => {
    let vectorSource: VectorSource;
    let vectorContext: VectorContext;
    let sourceSync: SourceVectorContextSync;
    let feature: Feature;

    beforeEach(() => {
      vectorSource = new VectorSource();
      vectorContext = new VectorContext(
        map,
        rootCollection,
        SplitDirection.NONE,
      );
      sourceSync = createSourceVectorContextSync(
        vectorSource,
        vectorContext,
        map.getScene()!,
        style,
        vectorProperties,
      );
      feature = createFeature();
      vectorSource.addFeature(feature);
    });

    afterEach(() => {
      vectorSource.dispose();
      vectorContext.destroy();
      sourceSync.destroy();
    });

    describe('if active', () => {
      beforeEach(() => {
        sourceSync.activate();
      });

      it('should remove the feature from the context and add it again', async () => {
        await timeout(100);
        const primitiveCollection = rootCollection.get(
          0,
        ) as PrimitiveCollection;
        expect(primitiveCollection.length).to.equal(1);
        const p = primitiveCollection.get(0) as Primitive;
        feature.changed();
        await timeout(100);
        expect(primitiveCollection.length).to.equal(1);
        const p2 = primitiveCollection.get(0) as Primitive;
        expect(p).to.not.equal(p2);
        expect(vectorContext.hasFeature(feature)).to.be.true;
      });
    });

    describe('if inactive', () => {
      it('should cache the feature', () => {
        feature.changed();
        sourceSync.activate();
        expect(vectorContext.hasFeature(feature)).to.be.true;
      });
    });
  });

  describe('changing vector properties', () => {
    let vectorSource: VectorSource;
    let vectorContext: VectorContext;
    let sourceSync: SourceVectorContextSync;
    let feature: Feature;

    beforeEach(() => {
      vectorSource = new VectorSource();
      vectorContext = new VectorContext(
        map,
        rootCollection,
        SplitDirection.NONE,
      );
      sourceSync = createSourceVectorContextSync(
        vectorSource,
        vectorContext,
        map.getScene()!,
        style,
        vectorProperties,
      );
      feature = createFeature();
      vectorSource.addFeature(feature);
    });

    afterEach(() => {
      vectorSource.dispose();
      vectorContext.destroy();
      sourceSync.destroy();
    });

    describe('if active', () => {
      beforeEach(() => {
        sourceSync.activate();
      });

      it('should remove the feature from the context and add it again', async () => {
        await timeout(100);
        const primitiveCollection = rootCollection.get(
          0,
        ) as PrimitiveCollection;
        expect(primitiveCollection.length).to.equal(1);
        const p = primitiveCollection.get(0) as Primitive;
        vectorProperties.propertyChanged.raiseEvent(['modelAutoScale']);
        await timeout(100);
        expect(primitiveCollection.length).to.equal(1);
        const p2 = primitiveCollection.get(0) as Primitive;
        expect(p).to.not.equal(p2);
        expect(vectorContext.hasFeature(feature)).to.be.true;
      });
    });

    describe('if inactive', () => {
      it('should cache the feature', () => {
        vectorProperties.propertyChanged.raiseEvent(['modelAutoScale']);
        sourceSync.activate();
        expect(vectorContext.hasFeature(feature)).to.be.true;
      });
    });
  });

  describe('destroying a sourceVectorContextSync', () => {
    let vectorSource: VectorSource;
    let vectorContext: VectorContext;
    let sourceSync: SourceVectorContextSync;
    let feature: Feature;

    beforeEach(() => {
      vectorSource = new VectorSource();
      vectorContext = new VectorContext(
        map,
        rootCollection,
        SplitDirection.NONE,
      );
      sourceSync = createSourceVectorContextSync(
        vectorSource,
        vectorContext,
        map.getScene()!,
        style,
        vectorProperties,
      );
      sourceSync.activate();
      feature = createFeature();
      vectorSource.addFeature(feature);
      sourceSync.destroy();
    });

    afterEach(() => {
      vectorSource.dispose();
      vectorContext.destroy();
    });

    it('should no longer listen to new features being added', () => {
      const f = createFeature();
      vectorSource.addFeature(f);
      expect(vectorContext.hasFeature(f)).to.be.false;
    });

    it('should no longer listen to feature changes', async () => {
      await timeout(100);
      const primitiveCollection = rootCollection.get(0) as PrimitiveCollection;
      expect(primitiveCollection.length).to.equal(1);
      const p = primitiveCollection.get(0) as Primitive;
      feature.changed();
      await timeout(100);
      expect(primitiveCollection.length).to.equal(1);
      const p2 = primitiveCollection.get(0) as Primitive;
      expect(p).to.equal(p2);
    });

    it('should no longer listen to vector property changes', async () => {
      await timeout(100);
      const primitiveCollection = rootCollection.get(0) as PrimitiveCollection;
      expect(primitiveCollection.length).to.equal(1);
      const p = primitiveCollection.get(0) as Primitive;
      vectorProperties.propertyChanged.raiseEvent(['modelAutoScale']);
      await timeout(100);
      expect(primitiveCollection.length).to.equal(1);
      const p2 = primitiveCollection.get(0) as Primitive;
      expect(p).to.equal(p2);
    });

    it('should no longer remove features from the context', () => {
      vectorSource.removeFeature(feature);
      expect(vectorContext.hasFeature(feature)).to.be.true;
    });
  });
});

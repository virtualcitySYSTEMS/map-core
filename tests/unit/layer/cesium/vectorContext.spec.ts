import nock from 'nock';
import Feature from 'ol/Feature.js';
import { LineString, Point } from 'ol/geom.js';
import { Fill, RegularShape, Style } from 'ol/style.js';
import {
  Primitive,
  PrimitiveCollection,
  Cartesian3,
  Matrix4,
  Model,
  SplitDirection,
  Scene,
} from '@vcmap-cesium/engine';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import Stroke from 'ol/style/Stroke.js';
import OlText from 'ol/style/Text.js';
import VectorContext, {
  setReferenceForPicking,
  setupScalingPrimitiveCollection,
} from '../../../../src/layer/cesium/vectorContext.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';
import VectorProperties from '../../../../src/layer/vectorProperties.js';
import { CesiumMap } from '../../../../index.js';

describe('VectorContext', () => {
  let map: CesiumMap;
  let scene: Scene;

  before(() => {
    map = getCesiumMap();
    scene = map.getScene()!;
  });

  after(() => {
    map.destroy();
  });

  describe('setReferenceForPicking', () => {
    it('should correctly set a primitives olFeature attribute', () => {
      const testFeature = new Feature();
      const testPrimitive = new Primitive();
      setReferenceForPicking(testFeature, testPrimitive);
      expect(testPrimitive).to.have.property('olFeature', testFeature);
    });
  });

  describe('constructor', () => {
    let collection: PrimitiveCollection;
    let vectorContext: VectorContext;

    before(() => {
      collection = new PrimitiveCollection();
      vectorContext = new VectorContext(map, collection, SplitDirection.NONE);
    });

    after(() => {
      vectorContext.destroy();
    });

    it('should add primitives, labels and billboards to the root collection', () => {
      expect(collection.length).to.equal(4);
      expect(collection.contains(vectorContext.primitives)).to.be.true;
      expect(collection.contains(vectorContext.scaledPrimitives)).to.be.true;
      expect(collection.contains(vectorContext.billboards)).to.be.true;
      expect(collection.contains(vectorContext.labels)).to.be.true;
    });
  });

  describe('adding a feature', () => {
    let vectorContext: VectorContext;

    before(() => {
      const collection = new PrimitiveCollection();
      vectorContext = new VectorContext(map, collection, SplitDirection.NONE);
    });

    afterEach(() => {
      vectorContext.clear();
    });

    after(() => {
      vectorContext.destroy();
    });

    it('should add a feature which converts to a primitive', async () => {
      const feature = new Feature({
        geometry: new LineString([
          [1, 1, 1],
          [2, 2, 1],
        ]),
      });

      await vectorContext.addFeature(
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
      expect(vectorContext.primitives.length).to.equal(1);
      expect(vectorContext.hasFeature(feature)).to.be.true;
    });

    it('should add a feature which converts to a scaled primitive', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
        olcs_primitiveOptions: {
          type: 'sphere',
          geometryOptions: {
            radius: 1,
          },
        },
        olcs_modelAutoScale: true,
      });

      await vectorContext.addFeature(
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

      expect(vectorContext.scaledPrimitives.length).to.equal(1);
      expect(vectorContext.hasFeature(feature)).to.be.true;
    });

    it('should add a feature which converts to a billboard', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      await vectorContext.addFeature(
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

      expect(vectorContext.billboards.length).to.equal(1);
      expect(vectorContext.hasFeature(feature)).to.be.true;
    });

    it('should add a feature which converts to a label', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      await vectorContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      expect(vectorContext.labels.length).to.equal(1);
      expect(vectorContext.hasFeature(feature)).to.be.true;
    });

    it('should return hasFeature true, even if the feature is still converting', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });
      const promise = vectorContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      expect(vectorContext.hasFeature(feature)).to.be.true;
      await promise;
    });
  });

  describe('reference setting on primitives', () => {
    let vectorContext: VectorContext;

    before(() => {
      const collection = new PrimitiveCollection();
      vectorContext = new VectorContext(map, collection, SplitDirection.NONE);
    });

    afterEach(() => {
      vectorContext.clear();
    });

    after(() => {
      vectorContext.destroy();
    });

    it('should not set the feature reference, if allow picking is false', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      await vectorContext.addFeature(
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

      expect(vectorContext.billboards.get(0)).to.not.have.property('olFeature');
    });

    it('should set the picking reference', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      await vectorContext.addFeature(
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

      expect(vectorContext.billboards.get(0)).to.have.property(
        'olFeature',
        feature,
      );
    });
  });

  describe('removing a feature', () => {
    describe('if the feature was already converted', () => {
      let vectorContext: VectorContext;

      before(() => {
        const collection = new PrimitiveCollection();
        vectorContext = new VectorContext(map, collection, SplitDirection.NONE);
      });

      afterEach(() => {
        vectorContext.clear();
      });

      after(() => {
        vectorContext.destroy();
      });

      it('should remove a feature which converts to a primitive', async () => {
        const feature = new Feature({
          geometry: new LineString([
            [1, 1, 1],
            [2, 2, 1],
          ]),
        });

        await vectorContext.addFeature(
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
        expect(vectorContext.primitives.length).to.equal(1);
        vectorContext.removeFeature(feature);
        expect(vectorContext.primitives.length).to.equal(0);
      });

      it('should remove a feature which converts to a scaled primitive', async () => {
        const feature = new Feature({
          geometry: new Point([1, 1, 1]),
          olcs_primitiveOptions: {
            type: 'sphere',
            geometryOptions: {
              radius: 1,
            },
          },
          olcs_modelAutoScale: true,
        });

        await vectorContext.addFeature(
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

        expect(vectorContext.scaledPrimitives.length).to.equal(1);
        vectorContext.removeFeature(feature);
        expect(vectorContext.scaledPrimitives.length).to.equal(0);
      });

      it('should remove a feature which converts to a billboard', async () => {
        const feature = new Feature({
          geometry: new Point([1, 1, 1]),
        });

        await vectorContext.addFeature(
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

        expect(vectorContext.billboards.length).to.equal(1);
        vectorContext.removeFeature(feature);
        expect(vectorContext.billboards.length).to.equal(0);
      });

      it('should remove a feature which converts to a label', async () => {
        const feature = new Feature({
          geometry: new Point([1, 1, 1]),
        });

        await vectorContext.addFeature(
          feature,
          new Style({
            text: new OlText({
              text: 'foo',
            }),
          }),
          new VectorProperties({}),
          scene,
        );
        expect(vectorContext.labels.length).to.equal(1);
        vectorContext.removeFeature(feature);
        expect(vectorContext.labels.length).to.equal(0);
      });
    });

    describe('if the feature is currently being converted', () => {
      let vectorContext: VectorContext;

      before(() => {
        const collection = new PrimitiveCollection();
        vectorContext = new VectorContext(map, collection, SplitDirection.NONE);
      });

      after(() => {
        vectorContext.destroy();
      });

      it('should not add it in the first place', async () => {
        const feature = new Feature({
          geometry: new Point([1, 1, 1]),
        });

        const promise = vectorContext.addFeature(
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

        expect(vectorContext.billboards.length).to.equal(0);
        vectorContext.removeFeature(feature);
        await promise;
        expect(vectorContext.billboards.length).to.equal(0);
      });
    });
  });

  describe('adding a feature twice', () => {
    let vectorContext: VectorContext;

    before(() => {
      const collection = new PrimitiveCollection();
      vectorContext = new VectorContext(map, collection, SplitDirection.NONE);
    });

    afterEach(() => {
      vectorContext.clear();
    });

    after(() => {
      vectorContext.destroy();
    });

    it('should remove the old feature primitives and add the new ones', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      await vectorContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      expect(vectorContext.billboards.length).to.equal(0);
      expect(vectorContext.labels.length).to.equal(1);
      await vectorContext.addFeature(
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
      expect(vectorContext.billboards.length).to.equal(1);
      expect(vectorContext.labels.length).to.equal(0);
    });

    it('should only add the feature once, even if the feature is added multiple times in quick succession', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      const p1 = vectorContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      const p2 = vectorContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      const p3 = vectorContext.addFeature(
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
      expect(vectorContext.labels.length).to.equal(1);
    });

    it('should only remove the current feature, once the new one which will be added is ready', async () => {
      const feature = new Feature({
        geometry: new Point([1, 1, 1]),
      });

      await vectorContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo1',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      expect(vectorContext.labels.length).to.equal(1);
      const p2 = vectorContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo2',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      const p3 = vectorContext.addFeature(
        feature,
        new Style({
          text: new OlText({
            text: 'foo3',
          }),
        }),
        new VectorProperties({}),
        scene,
      );
      expect(vectorContext.labels.length).to.equal(1);
      expect(vectorContext.labels.get(0)).to.have.property('text', 'foo1');
      await Promise.all([p2, p3]);
      expect(vectorContext.labels.length).to.equal(1);
      expect(vectorContext.labels.get(0)).to.have.property('text', 'foo3');
    });
  });

  describe('updateSplitDirection', () => {
    let context: VectorContext;
    let pCollection: PrimitiveCollection;
    let feature: Feature;

    before(async () => {
      feature = new Feature({
        geometry: new Point([0, 0, 1]),
        olcs_modelUrl: 'data:model/vnd.gltf+json,{}',
      });
      pCollection = new PrimitiveCollection({ destroyPrimitives: true });
      context = new VectorContext(map, pCollection, SplitDirection.NONE);
      await context.addFeature(
        feature,
        new Style({ image: new RegularShape({ points: 0, radius: 1 }) }),
        new VectorProperties({}),
        scene,
      );
    });

    after(() => {
      context.destroy();
      pCollection.destroy();
    });

    it('should update split direction on context and set split direction on Models', () => {
      context.updateSplitDirection(SplitDirection.LEFT);
      expect(context.splitDirection).to.equal(SplitDirection.LEFT);
      expect(context.primitives.get(0)).to.have.property(
        'splitDirection',
        SplitDirection.LEFT,
      );
    });
  });

  describe('setting up an auto scaled primitive collection', () => {
    let primitiveCollection: PrimitiveCollection;
    let scaledListener: () => void;
    let dirtyRef: { value: boolean };
    let addPrimitive: () => Primitive;
    let getCurrentResolutionFromCartesian: SinonStub;

    beforeEach(() => {
      dirtyRef = { value: false };
      primitiveCollection = new PrimitiveCollection();
      addPrimitive = (): Primitive => {
        const primitive = new Primitive();
        primitiveCollection.add(primitive);
        return primitive;
      };
      scaledListener = setupScalingPrimitiveCollection(
        map,
        primitiveCollection,
        dirtyRef,
      );
      getCurrentResolutionFromCartesian = sinon
        .stub(map, 'getCurrentResolutionFromCartesian')
        .returns(2);
    });

    afterEach(() => {
      scaledListener();
      primitiveCollection.destroy();
      getCurrentResolutionFromCartesian.restore();
    });

    it('should scale a primitive post render', () => {
      const primitive = addPrimitive();
      scene.postRender.raiseEvent();
      const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
      expect(scale.equals(new Cartesian3(2, 2, 2))).to.be.true;
    });

    it('should set dirty to false post render', () => {
      addPrimitive();
      scene.postRender.raiseEvent();
      expect(dirtyRef.value).to.be.false;
    });

    it('should scale a primitive post render, if the viewpoint changes', async () => {
      const primitive = addPrimitive();
      scene.postRender.raiseEvent();
      const { modelMatrix } = primitive;
      const vp = map.getViewpointSync()!;
      vp.cameraPosition = [0, 0, 1];
      await map.gotoViewpoint(vp);
      getCurrentResolutionFromCartesian.returns(3);
      scene.postRender.raiseEvent();
      const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
      expect(scale.equals(new Cartesian3(3, 3, 3))).to.be.true;
    });

    it('should not scale a primitive post render, if the viewpoint doesnt change', () => {
      const primitive = addPrimitive();
      scene.postRender.raiseEvent();
      const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
      scene.postRender.raiseEvent();
      expect(Matrix4.getScale(primitive.modelMatrix, new Cartesian3())).to.eql(
        scale,
      );
    });

    it('should not scale a primitive post render, if the viewpoint changes, but the resolution does not', async () => {
      const primitive = addPrimitive();
      scene.postRender.raiseEvent();
      const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
      const vp = map.getViewpointSync()!;
      vp.cameraPosition = [0, 0, 1];
      await map.gotoViewpoint(vp);
      scene.postRender.raiseEvent();
      expect(Matrix4.getScale(primitive.modelMatrix, new Cartesian3())).to.eql(
        scale,
      );
    });

    it('should scale a primitive post render, if the viewpoint doesnt change, but the collection is dirty', () => {
      const primitive = addPrimitive();
      scene.postRender.raiseEvent();
      const { modelMatrix } = primitive;
      dirtyRef.value = true;
      getCurrentResolutionFromCartesian.returns(3);
      scene.postRender.raiseEvent();
      const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
      expect(scale.equals(new Cartesian3(3, 3, 3))).to.be.true;
    });
  });

  describe('maintaining drawing order', () => {
    let vectorContext: VectorContext;
    let features: Feature[];

    beforeEach(async () => {
      const collection = new PrimitiveCollection();
      vectorContext = new VectorContext(map, collection, SplitDirection.NONE);
      features = [];
      for (let i = 0; i < 5; i++) {
        features.push(
          new Feature({
            geometry: new LineString([
              [1, 1, 1],
              [2, 2, 1],
            ]),
          }),
        );
      }

      await Promise.all(
        features.map((feature) =>
          vectorContext.addFeature(
            feature,
            new Style({
              stroke: new Stroke({
                color: '#ff0000',
                width: 1,
              }),
            }),
            new VectorProperties({}),
            scene,
          ),
        ),
      );
    });

    afterEach(() => {
      vectorContext.destroy();
    });

    it('should maintain index, if adding the same feature again', async () => {
      const indices = [3, 0, 1, 2];
      const promises = indices.map(async (index) => {
        const feature = features[index];
        await vectorContext.addFeature(
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
        const primitiveAtIndex = vectorContext.primitives.get(
          index,
        ) as Primitive;
        expect(primitiveAtIndex).to.have.property('olFeature', feature);
      });

      await Promise.all(promises);
    });

    it('should maintain the index, even when adding fast in succession', async () => {
      const index = 2;
      const feature = features[index];

      const p1 = vectorContext.addFeature(
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
      const p2 = vectorContext.addFeature(
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
      await Promise.all([p1, p2]);

      const primitiveAtIndex = vectorContext.primitives.get(index) as Primitive;
      expect(primitiveAtIndex).to.have.property('olFeature', feature);
    });
  });
});

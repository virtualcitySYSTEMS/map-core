import Feature from 'ol/Feature.js';
import {
  Primitive, PrimitiveCollection, Cartesian3, Matrix4, Model, SplitDirection,
} from '@vcmap/cesium';
import VectorContext, {
  addPrimitiveToContext,
  setReferenceForPicking,
  setupScalingPrimitiveCollection,
} from '../../../../src/layer/cesium/vectorContext.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';

describe('VectorContext', () => {
  /** @type {import("@vcmap/core").VectorContext} */
  let vectorContext;
  let collection;
  let map;

  before(() => {
    map = getCesiumMap();
  });

  beforeEach(() => {
    collection = new PrimitiveCollection({ destroyPrimitives: true });
    vectorContext = new VectorContext(map, collection, SplitDirection.NONE);
  });

  afterEach(() => {
    vectorContext.clear();
    collection.destroy();
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

  describe('addPrimitiveToContext', () => {
    let feature;
    let featureMap;

    before(() => {
      feature = new Feature({});
      featureMap = new Map();
    });

    afterEach(() => {
      featureMap.clear();
    });

    it('should add all primitives to the collection', () => {
      const primitive = new Primitive({});
      addPrimitiveToContext([primitive], feature, true, collection, featureMap);
      expect(collection.contains(primitive)).to.be.true;
    });

    it('should create an array in the map', () => {
      const primitive = new Primitive({});
      addPrimitiveToContext([primitive], feature, true, collection, featureMap);
      expect(featureMap.has(feature)).to.be.true;
      expect(featureMap.get(feature)).to.have.members([primitive]);
    });

    it('should push to an existing array in the map', () => {
      const primitive = new Primitive({});
      const array = [];
      featureMap.set(feature, array);
      addPrimitiveToContext([primitive], feature, true, collection, featureMap);
      expect(array).to.have.members([primitive]);
    });

    it('should set the picking reference if allowPicking', () => {
      const primitive = new Primitive({});
      addPrimitiveToContext([primitive], feature, true, collection, featureMap);
      expect(primitive.olFeature).to.equal(feature);
    });

    it('should not set the picking reference if not allowPicking', () => {
      const primitive = new Primitive({});
      addPrimitiveToContext([primitive], feature, false, collection, featureMap);
      expect(primitive.olFeature).to.be.undefined;
    });
  });

  describe('constructor', () => {
    it('should add primitives, labels and billboards to the root collection', () => {
      expect(collection.length).to.equal(4);
      expect(collection.contains(vectorContext.primitives)).to.be.true;
      expect(collection.contains(vectorContext.scaledPrimitives)).to.be.true;
      expect(collection.contains(vectorContext.billboards)).to.be.true;
      expect(collection.contains(vectorContext.labels)).to.be.true;
    });
  });

  describe('primitives', () => {
    let primitive;
    let feature;

    beforeEach(() => {
      primitive = new Primitive({});
      feature = new Feature({});
    });

    it('should add the feature to the primitives & the featureToPrimitiveMap', () => {
      vectorContext.addPrimitives([primitive], feature, true);
      expect(vectorContext.featureToPrimitiveMap.get(feature)).to.have.members([primitive]);
      expect(vectorContext.primitives.contains(primitive)).to.be.true;
    });

    it('should set the reference for picking, if allowPicking is true', () => {
      vectorContext.addPrimitives([primitive], feature, true);
      expect(primitive).to.have.property('olFeature', feature);
    });

    it('should not set the reference for picking, if allowPicking is false', () => {
      vectorContext.addPrimitives([primitive], feature, false);
      expect(primitive).to.not.have.property('olFeature');
    });

    it('should remove primitives based on the feature', () => {
      vectorContext.addPrimitives([primitive], feature, true);
      expect(vectorContext.primitives.contains(primitive)).to.be.true;
      vectorContext.removeFeature(feature);
      expect(vectorContext.primitives.contains(primitive)).to.be.false;
      expect(vectorContext.featureToPrimitiveMap).to.be.empty;
    });
  });

  describe('scaled primitives', () => {
    let primitive;
    let feature;

    beforeEach(() => {
      primitive = new Primitive({});
      feature = new Feature({});
    });

    it('should add the feature to the primitives & the featureToPrimitiveMap', () => {
      vectorContext.addScaledPrimitives([primitive], feature, true);
      expect(vectorContext.featureToScaledPrimitiveMap.get(feature)).to.have.members([primitive]);
      expect(vectorContext.scaledPrimitives.contains(primitive)).to.be.true;
    });

    it('should set the reference for picking, if allowPicking is true', () => {
      vectorContext.addScaledPrimitives([primitive], feature, true);
      expect(primitive).to.have.property('olFeature', feature);
    });

    it('should not set the reference for picking, if allowPicking is false', () => {
      vectorContext.addScaledPrimitives([primitive], feature, false);
      expect(primitive).to.not.have.property('olFeature');
    });

    it('should remove primitives based on the feature', () => {
      vectorContext.addScaledPrimitives([primitive], feature, true);
      expect(vectorContext.scaledPrimitives.contains(primitive)).to.be.true;
      vectorContext.removeFeature(feature);
      expect(vectorContext.scaledPrimitives.contains(primitive)).to.be.false;
      expect(vectorContext.featureToScaledPrimitiveMap).to.be.empty;
    });
  });

  describe('billboards', () => {
    let billboardOptions;
    let feature;

    beforeEach(() => {
      billboardOptions = {};
      feature = new Feature({});
    });

    it('should add the feature to the billboards and the featureToBillboardMap', () => {
      vectorContext.addBillboards([billboardOptions], feature, true);
      const billboards = vectorContext.featureToBillboardMap.get(feature);
      expect(billboards).to.have.lengthOf(1);
      expect(vectorContext.billboards.contains(billboards[0])).to.be.true;
    });

    it('should set the reference for picking, if allowPicking is true', () => {
      vectorContext.addBillboards([billboardOptions], feature, true);
      const billboard = vectorContext.featureToBillboardMap.get(feature)[0];
      expect(billboard).to.have.property('olFeature', feature);
    });

    it('should not set the reference for picking, if allowPicking is false', () => {
      vectorContext.addBillboards([billboardOptions], feature, false);
      const billboard = vectorContext.featureToBillboardMap.get(feature)[0];
      expect(billboard).to.not.have.property('olFeature');
    });

    it('should remove billboards based on the feature', () => {
      vectorContext.addBillboards([billboardOptions], feature, true);
      const billboard = vectorContext.featureToBillboardMap.get(feature)[0];
      expect(vectorContext.billboards.contains(billboard)).to.be.true;
      vectorContext.removeFeature(feature);
      expect(vectorContext.billboards.contains(billboard)).to.be.false;
      expect(vectorContext.featureToBillboardMap).to.be.empty;
    });
  });

  describe('labels', () => {
    let labelOptions;
    let feature;

    beforeEach(() => {
      labelOptions = {};
      feature = new Feature({});
    });

    it('should add the feature to the labels and the featureToLabelMap', () => {
      vectorContext.addLabels([labelOptions], feature, true);
      const labels = vectorContext.featureToLabelMap.get(feature);
      expect(labels).to.have.lengthOf(1);
      expect(vectorContext.labels.contains(labels[0])).to.be.true;
    });

    it('should set the reference for picking, if allowPicking is true', () => {
      vectorContext.addLabels([labelOptions], feature, true);
      const label = vectorContext.featureToLabelMap.get(feature)[0];
      expect(label).to.have.property('olFeature', feature);
    });

    it('should not set the reference for picking, if allowPicking is false', () => {
      vectorContext.addLabels([labelOptions], feature, false);
      const label = vectorContext.featureToLabelMap.get(feature)[0];
      expect(label).to.not.have.property('olFeature');
    });

    it('should remove labels based on the feature', () => {
      vectorContext.addLabels([labelOptions], feature, true);
      const label = vectorContext.featureToLabelMap.get(feature)[0];
      expect(vectorContext.labels.contains(label)).to.be.true;
      vectorContext.removeFeature(feature);
      expect(vectorContext.labels.contains(label)).to.be.false;
      expect(vectorContext.featureToLabelMap).to.be.empty;
    });
  });

  describe('caching feature resources', () => {
    let feature;

    before(() => {
      feature = new Feature({});
    });

    describe('creating a cache', () => {
      let context;
      let cache;
      let pCollection;
      let primitive;
      let scaled;

      before(() => {
        primitive = new Primitive({});
        scaled = new Primitive({});
        pCollection = new PrimitiveCollection({ destroyPrimitives: true });
        context = new VectorContext(map, pCollection, SplitDirection.NONE);
        context.addPrimitives([primitive], feature, true);
        context.addScaledPrimitives([scaled], feature, true);
        context.addBillboards([{}], feature, true);
        context.addLabels([{}], feature, true);
        cache = context.createFeatureCache(feature);
      });

      after(() => {
        context.clear();
        pCollection.destroy();
      });

      it('should cache all primitives', () => {
        expect(cache).to.have.property('primitives').and.to.have.members([primitive]);
      });

      it('should cache all scaled primitives', () => {
        expect(cache).to.have.property('scaledPrimitives').and.to.have.members([scaled]);
      });

      it('should cache all billboards', () => {
        expect(cache).to.have.property('billboards').and.to.have.lengthOf(1);
      });

      it('should cache all labels', () => {
        expect(cache).to.have.property('labels').and.to.have.lengthOf(1);
      });
    });

    describe('clearing of a cache', () => {
      let context;
      let pCollection;
      let primitive;
      let scaled;
      let billboard;
      let lablel;

      before(() => {
        primitive = new Primitive({});
        scaled = new Primitive({});
        pCollection = new PrimitiveCollection({ destroyPrimitives: true });
        context = new VectorContext(map, pCollection, SplitDirection.NONE);
        context.addPrimitives([primitive], feature, true);
        context.addScaledPrimitives([scaled], feature, true);
        context.addBillboards([{}], feature, true);
        context.addLabels([{}], feature, true);
        const cache = context.createFeatureCache(feature);
        [billboard] = cache.billboards;
        [lablel] = cache.labels;
        context.clearFeatureCache(cache);
      });

      after(() => {
        context.destroy();
        pCollection.destroy();
      });

      it('should clear all primitives', () => {
        expect(pCollection.contains(primitive)).to.be.false;
      });

      it('should clear all scaled primitives', () => {
        expect(pCollection.contains(scaled)).to.be.false;
      });

      it('should clear all billboards', () => {
        expect(pCollection.contains(billboard)).to.be.false;
      });

      it('should clear all lablel', () => {
        expect(pCollection.contains(lablel)).to.be.false;
      });
    });
  });

  describe('updateSplitDirection', () => {
    let context;
    let pCollection;
    let feature;
    let primitive;
    let scaled;

    before(() => {
      feature = new Feature({});
      primitive = Model.fromGltf({ url: 'test' });
      scaled = Model.fromGltf({ url: 'test' });
      pCollection = new PrimitiveCollection({ destroyPrimitives: true });
      context = new VectorContext(map, pCollection, SplitDirection.NONE);
      context.addPrimitives([primitive], feature, true);
      context.addScaledPrimitives([scaled], feature, true);
    });

    after(() => {
      context.destroy();
      pCollection.destroy();
    });

    it('should update split direction on context and set split direction on Models', () => {
      context.updateSplitDirection(SplitDirection.LEFT);
      expect(context.splitDirection).to.equal(SplitDirection.LEFT);
      expect(primitive.splitDirection).to.equal(SplitDirection.LEFT);
      expect(scaled.splitDirection).to.equal(SplitDirection.LEFT);
    });
  });

  describe('clear', () => {
    it('should remove all primitives, billboards, labels and features', () => {
      const feature = new Feature({});
      const primitive = new Primitive({});
      const scaled = new Primitive({});
      vectorContext.addPrimitives([primitive], feature, true);
      vectorContext.addScaledPrimitives([scaled], feature, true);
      vectorContext.addBillboards([{}], feature, true);
      vectorContext.addLabels([{}], feature, true);

      vectorContext.clear();
      expect(vectorContext.primitives.length).to.equal(0);
      expect(vectorContext.scaledPrimitives.length).to.equal(0);
      expect(vectorContext.billboards.length).to.equal(0);
      expect(vectorContext.labels.length).to.equal(0);
      expect(vectorContext.featureToPrimitiveMap).to.be.empty;
      expect(vectorContext.featureToScaledPrimitiveMap).to.be.empty;
      expect(vectorContext.featureToBillboardMap).to.be.empty;
      expect(vectorContext.featureToLabelMap).to.be.empty;
    });
  });

  describe('setting up an auto scaled primitive collection', () => {
    let primitiveCollection;
    let scaledListener;
    let dirtyRef;
    let addPrimitive;
    let getCurrentResolutionFromCartesian;

    beforeEach(() => {
      dirtyRef = { value: false };
      primitiveCollection = new PrimitiveCollection();
      addPrimitive = () => {
        const primitive = new Primitive();
        primitiveCollection.add(primitive);
        return primitive;
      };
      scaledListener = setupScalingPrimitiveCollection(map, primitiveCollection, dirtyRef);
      getCurrentResolutionFromCartesian = sinon.stub(map, 'getCurrentResolutionFromCartesian')
        .returns(2);
    });

    afterEach(() => {
      scaledListener();
      primitiveCollection.destroy();
      getCurrentResolutionFromCartesian.restore();
    });

    it('should scale a primitive post render', () => {
      const primitive = addPrimitive();
      map.getScene().postRender.raiseEvent();
      const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
      expect(scale.equals(new Cartesian3(2, 2, 2))).to.be.true;
    });

    it('should set dirty to false post render', () => {
      addPrimitive();
      map.getScene().postRender.raiseEvent();
      expect(dirtyRef.value).to.be.false;
    });

    it('should scale a primitive post render, if the viewpoint changes', async () => {
      const primitive = addPrimitive();
      map.getScene().postRender.raiseEvent();
      const { modelMatrix } = primitive;
      const vp = map.getViewpointSync();
      vp.cameraPosition = [0, 0, 1];
      await map.gotoViewpoint(vp);
      getCurrentResolutionFromCartesian.returns(3);
      map.getScene().postRender.raiseEvent();
      const scale = Matrix4.getScale(primitive.modelMatrix, new Cartesian3());
      expect(scale.equals(new Cartesian3(3, 3, 3))).to.be.true;
      expect(primitive.modelMatrix).to.not.equal(modelMatrix);
    });

    it('should not scale a primitive post render, if the viewpoint doesnt change', () => {
      const primitive = addPrimitive();
      map.getScene().postRender.raiseEvent();
      const { modelMatrix } = primitive;
      map.getScene().postRender.raiseEvent();
      expect(primitive.modelMatrix).to.equal(modelMatrix);
    });

    it('should not scale a primitive post render, if the viewpoint changes, but the resolution does not', async () => {
      const primitive = addPrimitive();
      map.getScene().postRender.raiseEvent();
      const { modelMatrix } = primitive;
      const vp = map.getViewpointSync();
      vp.cameraPosition = [0, 0, 1];
      await map.gotoViewpoint(vp);
      map.getScene().postRender.raiseEvent();
      expect(primitive.modelMatrix).to.equal(modelMatrix);
    });

    it('should scale a primitive post render, if the viewpoint doesnt change, but the collection is dirty', () => {
      const primitive = addPrimitive();
      map.getScene().postRender.raiseEvent();
      const { modelMatrix } = primitive;
      dirtyRef.value = true;
      getCurrentResolutionFromCartesian.returns(3);
      map.getScene().postRender.raiseEvent();
      expect(primitive.modelMatrix).to.not.equal(modelMatrix);
    });
  });
});

import { unByKey } from 'ol/Observable.js';
import Polygon from 'ol/geom/Polygon.js';
import Circle from 'ol/geom/Circle.js';
import Point from 'ol/geom/Point.js';
import Feature from 'ol/Feature.js';
import Fill from 'ol/style/Fill.js';
import Style from 'ol/style/Style.js';
import { v4 as uuidv4 } from 'uuid';
import { setObliqueMap } from '../../../helpers/obliqueHelpers.js';
import Vector from '../../../../../src/vcs/vcm/layer/vector.js';
import { getFramework } from '../../../helpers/framework.js';
import resetFramework from '../../../helpers/resetFramework.js';
import {
  actuallyIsCircle,
  alreadyTransformedToImage,
  obliqueGeometry,
  originalFeatureSymbol,
} from '../../../../../src/vcs/vcm/layer/vectorSymbols.js';

describe('vcs.vcm.layer.oblique.VectorOblique', () => {
  let sandbox;
  /** @type {import("@vcmap/core").Vector} */
  let VL;
  /** @type {import("@vcmap/core").VectorOblique} */
  let OVL;
  /** @type {import("@vcmap/core").Oblique} */
  let map;
  let debounceTimeout;

  before(async () => {
    sandbox = sinon.createSandbox();
    map = await setObliqueMap(getFramework());
    VL = new Vector({});
    getFramework().addLayer(VL);
    [OVL] = /** @type {Array<vcs.vcm.layer.oblique.VectorOblique>} */ (VL.getImplementationsForMap(map));
    debounceTimeout = 200;
  });

  after(() => {
    resetFramework();
  });

  describe('activating the implementation', () => {
    it('should fetch features withing the current image', async () => {
      const addedFeature = new Feature({
        geometry: new Point([
          1489084,
          6892790,
          0,
        ]),
      });
      VL.addFeatures([addedFeature]);
      await OVL.activate();
      expect(OVL.obliqueSource.getFeatureById(addedFeature.getId())).to.be.an.instanceof(Feature);
    });

    describe('setting up of source listeners', () => {
      let addedFeature;

      before(async () => {
        addedFeature = new Feature({
          geometry: new Point([1489084, 6892790, 0]),
        });
        VL.addFeatures([addedFeature]);
        await OVL.activate();
      });

      it('should remove a feature, if removed from the original source', () => {
        expect(OVL.obliqueSource.getFeatureById(addedFeature.getId())).to.be.an.instanceof(Feature);
        VL.removeFeaturesById([addedFeature.getId()]);
        expect(OVL.obliqueSource.getFeatureById(addedFeature.getId())).to.be.null;
      });

      describe('adding of features', () => {
        it('should add a feature, if added to the original source and intersects the current extent', () => {
          const newFeature = new Feature({
            geometry: new Point([1489084, 6892790, 0]),
          });
          VL.addFeatures([newFeature]);
          expect(newFeature).to.have.property(obliqueGeometry)
            .and.to.be.an.instanceof(Point);
        });

        it('should not add a feature, if it doesnt intersect the extent', () => {
          const newFeature = new Feature({
            geometry: new Point([1, 1, 0]),
          });
          VL.addFeatures([newFeature]);
          expect(newFeature).to.not.have.property(obliqueGeometry);
        });

        it('should add a geometry, if its already transformed to image coordinates', () => {
          const geometry = new Point([1, 1, 0]);
          geometry[alreadyTransformedToImage] = true;
          const newFeature = new Feature({ geometry });
          VL.addFeatures([newFeature]);
          expect(newFeature).to.have.property(obliqueGeometry)
            .and.to.be.an.instanceof(Point);
        });

        it('should add a feature, if the feature changes and is not part of the source yet, but satisfies after change', () => {
          const newFeature = new Feature();
          VL.addFeatures([newFeature]);
          expect(newFeature).to.not.have.property(obliqueGeometry);
          newFeature.setGeometry(new Point([1489084, 6892790, 0]));
          expect(newFeature).to.have.property(obliqueGeometry)
            .and.to.be.an.instanceof(Point);
        });
      });
    });
  });

  describe('deactivating the implementation', () => {
    describe('removing of source listeners', () => {
      before(async () => {
        await OVL.activate();
        OVL.deactivate();
      });

      it('should not add a feature, if added to the original source and intersects the current extent', () => {
        const newFeature = new Feature({
          geometry: new Point([1489084, 6892790, 0]),
        });
        VL.addFeatures([newFeature]);
        expect(newFeature).to.not.have.property(obliqueGeometry);
      });

      it('should not add a geometry, if its already transformed to image coordinates', () => {
        const geometry = new Point([1, 1, 0]);
        geometry[alreadyTransformedToImage] = true;
        const newFeature = new Feature({ geometry });
        VL.addFeatures([newFeature]);
        expect(newFeature).to.not.have.property(obliqueGeometry);
      });

      it('should not add a feature, if the feature changes and is not part of the source yet, but satisfies after change', () => {
        const newFeature = new Feature();
        VL.addFeatures([newFeature]);
        expect(newFeature).to.not.have.property(obliqueGeometry);
        newFeature.setGeometry(new Point([1489084, 6892790, 0]));
        expect(newFeature).to.not.have.property(obliqueGeometry);
      });
    });

    describe('handling of features', () => {
      let originalFeature;
      let obliqueFeature;

      before(async () => {
        originalFeature = new Feature({
          geometry: new Point([
            1489084,
            6892790,
            0,
          ]),
        });
        VL.addFeatures([originalFeature]);
        await OVL.activate();
        obliqueFeature = OVL.obliqueSource.getFeatureById(originalFeature.getId());
        OVL.deactivate();
      });

      it('should no longer update on changes to the mercator geometry', () => {
        originalFeature.getGeometry().translate(1, 1);
        expect(OVL._updatingOblique).to.not.have.property(originalFeature.getId()); // XXX not too happy with this
      });

      it('should not longer update on changes to the oblique geometry', () => {
        obliqueFeature.getGeometry().translate(1, 1);
        expect(OVL._updatingMercator).to.not.have.property(originalFeature.getId());
      });

      it('should not reset oblique geometry on changes to the geometry', () => {
        const obliqueGeom = obliqueFeature.getGeometry();
        originalFeature.setGeometry(new Point([1, 1, 10]));
        expect(obliqueFeature.getGeometry()).to.equal(obliqueGeom);
      });

      it('should remove an reference to obliqueGeometry', () => {
        expect(originalFeature).to.not.have.property(obliqueGeometry);
      });
    });
  });

  describe('adding features to the implementation', () => {
    let originalFeature;
    let style;
    let obliqueFeature;

    before(async () => {
      await VL.activate();
      originalFeature = new Feature({
        geometry: new Point([
          1489084,
          6892790,
          0,
        ]),
      });
      const id = uuidv4();
      originalFeature.setId(id);
      style = new Style({ fill: new Fill({ color: '#ff0000' }) });
      originalFeature.setStyle(style);
      await OVL.addFeature(originalFeature);
      obliqueFeature = OVL.obliqueSource.getFeatureById(id);
    });

    it('should add a shadow feature to the oblique source', () => {
      expect(obliqueFeature[originalFeatureSymbol]).to.equal(originalFeature);
    });

    it('should copy the original features style', () => {
      expect(obliqueFeature.getStyle()).to.equal(style);
    });

    it('should not add a feature with the same id twice', async () => {
      const clone = originalFeature.clone();
      clone.setId(originalFeature.getId());
      await OVL.addFeature(clone);
      expect(OVL.obliqueSource.getFeatureById(clone.getId())).to.equal(obliqueFeature);
    });

    it('should add the actual feature to the oblique source, if it is do not transform', async () => {
      const doNotTransformFeature = new Feature({
        geometry: new Point([
          1489084,
          6892790,
          0,
        ]),
      });
      doNotTransformFeature[Vector.doNotTransform] = true;
      const id = uuidv4();
      doNotTransformFeature.setId(id);
      doNotTransformFeature.getGeometry()[Vector.alreadyTransformedToImage] = true;
      await OVL.addFeature(doNotTransformFeature);
      const shadowFeature = OVL.obliqueSource.getFeatureById(id);
      expect(shadowFeature).to.equal(doNotTransformFeature);
    });
  });

  describe('removing a feature from the implementation', () => {
    let originalFeature;
    let obliqueFeature;
    let style;
    let id;

    before(async () => {
      await VL.activate();
      originalFeature = new Feature({
        geometry: new Point([
          1489084,
          6892790,
          0,
        ]),
      });
      id = uuidv4();
      originalFeature.setId(id);
      style = new Style({ fill: new Fill({ color: '#ff0000' }) });
      originalFeature.setStyle(style);
      await OVL.addFeature(originalFeature);
      obliqueFeature = OVL.obliqueSource.getFeatureById(id);
      OVL.removeFeature(originalFeature);
    });

    it('should remove the feature from the oblique source', () => {
      expect(OVL.obliqueSource.getFeatureById(id)).to.be.null;
    });

    describe('removing of listeners', () => {
      it('should no longer update on changes to the mercator geometry', () => {
        originalFeature.getGeometry().translate(1, 1);
        expect(OVL._updatingOblique).to.have.property(id, null); // XXX not too happy with this
      });

      it('should no longer update on changes to the oblique geometry', () => {
        obliqueFeature.getGeometry().translate(1, 1);
        expect(OVL._updatingMercator).to.not.have.property(id);
      });

      it('should not reset oblique geometry on changes to the geometry', () => {
        const obliqueGeom = obliqueFeature.getGeometry();
        originalFeature.setGeometry(new Point([1, 1, 10]));
        expect(obliqueFeature.getGeometry()).to.equal(obliqueGeom);
      });
    });
  });

  describe('feature listeners of added features', () => {
    let originalFeature;
    let obliqueFeature;
    let id;
    let clock;

    before(async () => {
      await VL.activate();
    });

    beforeEach(async () => {
      originalFeature = new Feature({
        geometry: new Point([
          1489084,
          6892790,
          0,
        ]),
      });
      id = uuidv4();
      originalFeature.setId(id);
      await OVL.addFeature(originalFeature);
      obliqueFeature = OVL.obliqueSource.getFeatureById(id);
      clock = sandbox.useFakeTimers(1);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should add a change listener, updating the style on the shadow feature, if the original features changes', () => {
      const style = new Style({ fill: new Fill({ color: '#FF0000' }) });
      originalFeature.setStyle(style);
      expect(obliqueFeature.getStyle()).to.equal(style);
    });

    it('should add a change listener to the original geometry, updating the oblique geometry when called', (done) => {
      obliqueFeature.getGeometry().on('change', () => { done(); });
      originalFeature.getGeometry().translate(1, 1);
      clock.tick(debounceTimeout);
    });

    it('should add a change listener to the oblique geometry, updating the original geometry when called', (done) => {
      originalFeature.getGeometry().on('change', () => { done(); });
      obliqueFeature.getGeometry().translate(1, 1);
      clock.tick(debounceTimeout);
    });

    describe('original geometry change listener', () => {
      it('should update the geometry', (done) => {
        obliqueFeature.on('change:geometry', () => { done(); });
        originalFeature.setGeometry(new Point([1489084, 6892790, 0]));
        clock.tick(debounceTimeout);
      });

      it('should remove the previous geometry listener', (done) => {
        const oldGeometry = originalFeature.getGeometry();
        obliqueFeature.on('change:geometry', () => {
          const spy = sandbox.spy();
          obliqueFeature.getGeometry().on('change', spy);
          oldGeometry.setCoordinates([2, 2, 1]);
          clock.tick(debounceTimeout);
          expect(spy).to.not.have.been.called;
          done();
        });
        originalFeature.setGeometry(new Point([1489084, 6892790, 0]));
        clock.tick(debounceTimeout);
      });

      it('should add a geometry change listener to the new geometry', (done) => {
        const newGeometry = new Point([1489084, 6892790, 0]);
        obliqueFeature.on('change:geometry', () => {
          obliqueFeature.getGeometry().on('change', () => { done(); });
          newGeometry.translate(1, 1);
          clock.tick(debounceTimeout);
        });
        originalFeature.setGeometry(newGeometry);
        clock.tick(debounceTimeout);
      });

      describe('handling of circles', () => {
        let actuallyCircle;

        beforeEach(() => {
          actuallyCircle = new Polygon([[[1, 1, 0], [0, 1, 0], [0, 0, 0]]]);
          actuallyCircle[actuallyIsCircle] = true;
        });

        it('should not reset the geometry, if its actually a circle', () => {
          const spy = sandbox.spy();
          obliqueFeature.on('change:geometry', spy);
          originalFeature.setGeometry(actuallyCircle);
          expect(spy).to.not.have.been.called;
        });

        it('should add a change listener, resetting the oblique geometry and removing actuallyIsCircle, if the polygonized circle changes', (done) => {
          obliqueFeature.setGeometry(new Circle([1, 1, 0], 20));
          obliqueFeature.on('change:geometry', () => {
            expect(obliqueFeature.getGeometry()).to.be.an.instanceof(Polygon);
            done();
          });
          originalFeature.setGeometry(actuallyCircle);
          actuallyCircle.translate(1, 1);
          clock.tick(debounceTimeout);
          expect(actuallyCircle).to.not.have.property(actuallyIsCircle);
        });

        it('should not resetting the oblique geometry and keep actuallyIsCircle, if the polygonized circle changes due to an update', () => {
          const circle = new Circle([1, 1, 0], 20);
          obliqueFeature.setGeometry(circle);
          const spy = sandbox.spy();
          obliqueFeature.on('change:geometry', spy);
          circle.translate(1, 1);
          clock.tick(debounceTimeout);
          expect(actuallyCircle).to.have.property(actuallyIsCircle);
          expect(spy).to.not.have.been.called;
        });
      });
    });
  });

  describe('updating oblique geometry', () => {
    let originalFeature;
    let obliqueFeature;
    let id;
    let clock;

    before(async () => {
      await VL.activate();
    });

    beforeEach(async () => {
      const geometry = new Point([
        100,
        100,
        0,
      ]);
      geometry[alreadyTransformedToImage] = true; // makes testing easier
      originalFeature = new Feature({
        geometry,
      });
      id = uuidv4();
      originalFeature.setId(id);
      await OVL.addFeature(originalFeature);
      obliqueFeature = OVL.obliqueSource.getFeatureById(id);
      unByKey(Object.values(OVL._featureListeners[id])); // otherwise feature listeners are triggered
      clock = sandbox.useFakeTimers(1);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should update the oblique geometry after 200ms', () => {
      originalFeature.getGeometry().translate(1, 1);
      OVL.updateObliqueGeometry(originalFeature, obliqueFeature);
      clock.tick(debounceTimeout);
      expect(obliqueFeature.getGeometry().getCoordinates()).to.have.members([101, 101, 0]);
    });

    it('should clear a previously updating geometry call, resetting the debounce timer, if called again', () => {
      const spy = sandbox.spy();
      obliqueFeature.getGeometry().on('change', spy);
      originalFeature.getGeometry().translate(1, 1);
      OVL.updateObliqueGeometry(originalFeature, obliqueFeature);
      clock.tick(debounceTimeout / 2);
      originalFeature.getGeometry().translate(1, 1);
      OVL.updateObliqueGeometry(originalFeature, obliqueFeature);
      clock.tick(debounceTimeout);
      expect(obliqueFeature.getGeometry().getCoordinates()).to.have.members([102, 102, 0]);
      expect(spy).to.have.been.calledOnce;
    });

    it('should not update oblique, if updating mercator', () => {
      OVL._updatingMercator[id] = true;
      const spy = sandbox.spy();
      obliqueFeature.getGeometry().on('change', spy);
      originalFeature.getGeometry().translate(1, 1);
      OVL.updateObliqueGeometry(originalFeature, obliqueFeature);
      clock.tick(debounceTimeout);
      expect(spy).to.not.have.been.called;
    });
  });

  describe('updating mercator geometry', () => {
    let originalFeature;
    let obliqueFeature;
    let id;
    let clock;

    before(async () => {
      await VL.activate();
    });

    beforeEach(async () => {
      originalFeature = new Feature({
        geometry: new Point([
          1489084,
          6892790,
          0,
        ]),
      });
      id = uuidv4();
      originalFeature.setId(id);
      await OVL.addFeature(originalFeature);
      obliqueFeature = OVL.obliqueSource.getFeatureById(id);
      unByKey(Object.values(OVL._featureListeners[id])); // otherwise feature listeners are triggered
      clock = sandbox.useFakeTimers(1);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should update the oblique geometry after 200ms', (done) => {
      const spy = sandbox.spy();
      originalFeature.getGeometry().on('change', spy);
      obliqueFeature.getGeometry().translate(1, 1);
      OVL.updateMercatorGeometry(originalFeature, obliqueFeature);
      clock.tick(debounceTimeout);
      clock.restore();
      setTimeout(() => {
        expect(spy).to.have.been.calledOnce;
        done();
      });
    });

    it('should clear a previously updating geometry call, resetting the debounce timer, if called again', (done) => {
      const spy = sandbox.spy();
      originalFeature.getGeometry().on('change', spy);
      obliqueFeature.getGeometry().translate(1, 1);
      OVL.updateMercatorGeometry(originalFeature, obliqueFeature);
      clock.tick(debounceTimeout / 2);
      obliqueFeature.getGeometry().translate(1, 1);
      OVL.updateMercatorGeometry(originalFeature, obliqueFeature);
      clock.tick(debounceTimeout);
      clock.restore();
      setTimeout(() => {
        expect(spy).to.have.been.calledOnce;
        done();
      });
    });

    it('should not update oblique, if updating mercator', (done) => {
      OVL._updatingOblique[id] = true;
      const spy = sandbox.spy();
      originalFeature.getGeometry().on('change', spy);
      obliqueFeature.getGeometry().translate(1, 1);
      OVL.updateMercatorGeometry(originalFeature, obliqueFeature);
      clock.tick(debounceTimeout);
      clock.restore();
      setTimeout(() => {
        expect(spy).to.not.have.been.called;
        done();
      });
    });

    it('should reset the original geometry, if its actually a circle', (done) => {
      originalFeature.setGeometry(new Circle([1489084, 6892790, 0], 20));
      obliqueFeature.setGeometry(new Polygon([[[1, 1, 0], [1, 0, 0], [0, 0, 0]]]));
      OVL.updateMercatorGeometry(originalFeature, obliqueFeature);
      clock.tick(debounceTimeout);
      clock.restore();
      setTimeout(() => {
        const geometry = originalFeature.getGeometry();
        expect(geometry).to.have.property(actuallyIsCircle);
        expect(geometry).to.be.an.instanceof(Polygon);
        done();
      });
    });
  });

  describe('handling of image changes', () => {
    describe('while the implementation is active', () => {
      let startingFeature;
      let targetFeature;
      let originalImageName;

      before(async () => {
        originalImageName = map.currentImage.name;
        startingFeature = new Feature({
          geometry: new Point([1487990.7668274378, 6891525.38699331, 0]),
        });

        targetFeature = new Feature({
          geometry: new Point([1490224.677816213, 6894132.787239241, 0]),
        });

        VL.addFeatures([startingFeature, targetFeature]);
        await OVL.activate();
        await map.setImageByName('034_070_110005034');
      });

      after(async () => {
        await map.setImageByName(originalImageName);
      });

      it('should remove previous features', () => {
        expect(OVL.obliqueSource.getFeatureById(startingFeature.getId())).to.be.null;
      });

      it('should remove the oblique geometry symbol from previous features', () => {
        expect(startingFeature).to.not.have.property(obliqueGeometry);
      });

      it('should no longer update on changes to the mercator geometry', () => {
        startingFeature.getGeometry().translate(1, 1);
        expect(OVL._updatingOblique).to.not.have.property(startingFeature.getId()); // XXX not too happy with this
      });

      it('should add the features within the new image', () => {
        expect(OVL.obliqueSource.getFeatureById(targetFeature.getId())).to.be.an.instanceof(Feature);
      });
    });

    describe('while the implementation is not active', () => {
      let startingFeature;
      let targetFeature;
      let originalImageName;

      before(async () => {
        OVL.deactivate();
        originalImageName = map.currentImage.name;
        startingFeature = new Feature({
          geometry: new Point([1487990.7668274378, 6891525.38699331, 0]),
        });

        targetFeature = new Feature({
          geometry: new Point([1490224.677816213, 6894132.787239241, 0]),
        });

        VL.addFeatures([startingFeature, targetFeature]);
        await map.setImageByName('034_070_110005034');
      });

      after(async () => {
        await map.setImageByName(originalImageName);
      });

      it('should not fetch features within the new view', () => {
        expect(OVL.obliqueSource.getFeatures()).to.be.empty;
      });
    });
  });
});

import { expect } from 'chai';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import { Circle, Point, Polygon } from 'ol/geom.js';
import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import { v4 as uuidv4, v4 as uuid } from 'uuid';
import sinon from 'sinon';
import { timeout } from '../../helpers/helpers.js';
import {
  actuallyIsCircle,
  alreadyTransformedToImage,
  doNotTransform,
  obliqueGeometry,
  originalFeatureSymbol,
} from '../../../../src/layer/vectorSymbols.js';
import type { ObliqueMap } from '../../../../index.js';
import { VcsApp } from '../../../../index.js';
import { setObliqueMap } from '../../helpers/obliqueHelpers.js';
import type { SourceObliqueSync } from '../../../../src/layer/oblique/sourceObliqueSync.js';
import { createSourceObliqueSync } from '../../../../src/layer/oblique/sourceObliqueSync.js';

function createFeature(): Feature {
  const f = new Feature({
    geometry: new Point([1489084, 6892790, 0]),
  });
  f.setId(uuid());
  return f;
}

function createAlreadyTransformedToImageFeature(): Feature {
  const geometry = new Point([2682.558409466228, 6487.261329634799, 0]);
  geometry[alreadyTransformedToImage] = true;
  const f = new Feature({
    geometry,
  });
  f.setId(uuid());
  return f;
}

const debounceTimeout = 200;

describe('sourceObliqueSync', () => {
  let app: VcsApp;
  let map: ObliqueMap;
  let sandbox: sinon.SinonSandbox;

  before(async () => {
    app = new VcsApp();
    map = await setObliqueMap(app);
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  describe('activating the sync', () => {
    let vectorSource: VectorSource;
    let sourceSync: SourceObliqueSync;

    beforeEach(() => {
      vectorSource = new VectorSource();
      sourceSync = createSourceObliqueSync(vectorSource, map);
    });

    afterEach(() => {
      vectorSource.dispose();
      sourceSync.destroy();
    });

    it('should fetch features withing the current image', async () => {
      const addedFeature = createFeature();
      vectorSource.addFeature(addedFeature);
      sourceSync.activate();
      await timeout(0);
      expect(
        sourceSync.obliqueSource.getFeatureById(addedFeature.getId()!),
      ).to.be.an.instanceof(Feature);
    });

    describe('setting up of source listeners', () => {
      let addedFeature: Feature;

      beforeEach(async () => {
        addedFeature = createFeature();
        vectorSource.addFeatures([addedFeature]);
        sourceSync.activate();
        await timeout(0);
      });

      it('should remove a feature, if removed from the original source', () => {
        expect(
          sourceSync.obliqueSource.getFeatureById(addedFeature.getId()!),
        ).to.be.an.instanceof(Feature);
        vectorSource.removeFeature(addedFeature);
        expect(sourceSync.obliqueSource.getFeatureById(addedFeature.getId()!))
          .to.be.null;
      });

      describe('adding of features', () => {
        it('should add a feature, if added to the original source and intersects the current extent', () => {
          const newFeature = createFeature();
          vectorSource.addFeatures([newFeature]);
          expect(newFeature)
            .to.have.property(obliqueGeometry)
            .and.to.be.an.instanceof(Point);
        });

        it('should not add a feature, if it doesnt intersect the extent', () => {
          const newFeature = new Feature({
            geometry: new Point([1, 1, 0]),
          });
          newFeature.setId(uuid());
          vectorSource.addFeatures([newFeature]);
          expect(newFeature).to.not.have.property(obliqueGeometry);
        });

        it('should add a geometry, if its already transformed to image coordinates', () => {
          const geometry = new Point([1, 1, 0]);
          geometry[alreadyTransformedToImage] = true;
          const newFeature = new Feature({ geometry });
          newFeature.setId(uuid());
          vectorSource.addFeatures([newFeature]);
          expect(newFeature)
            .to.have.property(obliqueGeometry)
            .and.to.be.an.instanceof(Point);
        });

        it('should add a feature, if the feature changes and is not part of the source yet, but satisfies after change', () => {
          const newFeature = new Feature();
          newFeature.setId(uuid());
          vectorSource.addFeatures([newFeature]);
          expect(newFeature).to.not.have.property(obliqueGeometry);
          newFeature.setGeometry(new Point([1489084, 6892790, 0]));
          expect(newFeature)
            .to.have.property(obliqueGeometry)
            .and.to.be.an.instanceof(Point);
        });
      });
    });
  });

  describe('deactivating the implementation', () => {
    let vectorSource: VectorSource;
    let sourceSync: SourceObliqueSync;

    beforeEach(() => {
      vectorSource = new VectorSource();
      sourceSync = createSourceObliqueSync(vectorSource, map);
    });

    afterEach(() => {
      vectorSource.dispose();
      sourceSync.destroy();
    });

    describe('removing of source listeners', () => {
      beforeEach(() => {
        sourceSync.activate();
        sourceSync.deactivate();
      });

      it('should not add a feature, if added to the original source and intersects the current extent', () => {
        const newFeature = createFeature();
        vectorSource.addFeatures([newFeature]);
        expect(newFeature).to.not.have.property(obliqueGeometry);
      });

      it('should not add a geometry, if its already transformed to image coordinates', () => {
        const geometry = new Point([1, 1, 0]);
        geometry[alreadyTransformedToImage] = true;
        const newFeature = new Feature({ geometry });
        newFeature.setId(uuid());
        vectorSource.addFeatures([newFeature]);
        expect(newFeature).to.not.have.property(obliqueGeometry);
      });

      it('should not add a feature, if the feature changes and is not part of the source yet, but satisfies after change', () => {
        const newFeature = new Feature();
        newFeature.setId(uuid());
        vectorSource.addFeatures([newFeature]);
        expect(newFeature).to.not.have.property(obliqueGeometry);
        newFeature.setGeometry(new Point([1489084, 6892790, 0]));
        expect(newFeature).to.not.have.property(obliqueGeometry);
      });
    });

    describe('handling of features', () => {
      let originalFeature: Feature;
      let obliqueFeature: Feature;

      beforeEach(async () => {
        originalFeature = createFeature();
        vectorSource.addFeatures([originalFeature]);
        sourceSync.activate();
        await timeout(0);
        obliqueFeature = sourceSync.obliqueSource.getFeatureById(
          originalFeature.getId()!,
        )!;
        sourceSync.deactivate();
      });

      it('should no longer update on changes to the mercator geometry', async () => {
        const geom = obliqueFeature.getGeometry()!;
        const spy = sandbox.spy();
        geom.on('change', spy);
        originalFeature.getGeometry()!.translate(1, 1);
        await timeout(debounceTimeout);
        expect(spy).to.not.have.been.called;
      });

      it('should not longer update on changes to the oblique geometry', async () => {
        const geom = originalFeature.getGeometry()!;
        const spy = sandbox.spy();
        geom.on('change', spy);
        obliqueFeature.getGeometry()!.translate(1, 1);
        await timeout(debounceTimeout);
        expect(spy).to.not.have.been.called;
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
    let vectorSource: VectorSource;
    let sourceSync: SourceObliqueSync;
    let originalFeature: Feature;
    let style: Style;
    let obliqueFeature: Feature;

    before(async () => {
      vectorSource = new VectorSource();
      sourceSync = createSourceObliqueSync(vectorSource, map);
      sourceSync.activate();
      originalFeature = createFeature();
      const id = originalFeature.getId()!;
      style = new Style({ fill: new Fill({ color: '#ff0000' }) });
      originalFeature.setStyle(style);
      vectorSource.addFeatures([originalFeature]);
      await timeout(debounceTimeout);
      obliqueFeature = sourceSync.obliqueSource.getFeatureById(id)!;
    });

    after(() => {
      vectorSource.dispose();
      sourceSync.destroy();
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
      vectorSource.addFeatures([clone]);
      await timeout(1);
      expect(sourceSync.obliqueSource.getFeatureById(clone.getId()!)).to.equal(
        obliqueFeature,
      );
    });

    it('should add the actual feature to the oblique source, if it is do not transform', async () => {
      const doNotTransformFeature = new Feature({
        geometry: new Point([1489084, 6892790, 0]),
      });
      doNotTransformFeature[doNotTransform] = true;
      const id = uuidv4();
      doNotTransformFeature.setId(id);
      doNotTransformFeature.getGeometry()![alreadyTransformedToImage] = true;
      vectorSource.addFeatures([doNotTransformFeature]);
      await timeout(1);
      const shadowFeature = sourceSync.obliqueSource.getFeatureById(id);
      expect(shadowFeature).to.equal(doNotTransformFeature);
    });

    it('should not add a feature with the same id twice, even if calling addFeature sync', async () => {
      const clone = originalFeature.clone();
      clone.setId(uuidv4());
      vectorSource.addFeatures([clone]);
      await timeout(1);
      expect(clone[obliqueGeometry]).to.equal(
        sourceSync.obliqueSource.getFeatureById(clone.getId()!)?.getGeometry(),
      );
    });

    it('should not add a feature with the same id twice, even if calling addFeature sync & the feature is already transformed to image', async () => {
      const clone = originalFeature.clone();
      clone.setId(uuidv4());
      const geom = new Point([0, 0, 0]);
      geom[alreadyTransformedToImage] = true;
      clone.setGeometry(geom);
      vectorSource.addFeatures([clone]);
      vectorSource.addFeatures([clone]);
      await timeout(1);
      expect(clone[obliqueGeometry]).to.equal(
        sourceSync.obliqueSource.getFeatureById(clone.getId()!)?.getGeometry(),
      );
    });
  });

  describe('adding and directly removing a feature from the implementation', () => {
    let vectorSource: VectorSource;
    let sourceSync: SourceObliqueSync;
    let originalFeature: Feature;
    let style: Style;

    beforeEach(() => {
      vectorSource = new VectorSource();
      sourceSync = createSourceObliqueSync(vectorSource, map);
      sourceSync.activate();
      originalFeature = createFeature();
      style = new Style({ fill: new Fill({ color: '#ff0000' }) });
      originalFeature.setStyle(style);
    });

    afterEach(() => {
      vectorSource.dispose();
      sourceSync.destroy();
    });

    it('should only add the obliqueFeature after the conversion is done', async () => {
      vectorSource.addFeatures([originalFeature]);
      let obliqueFeature = sourceSync.obliqueSource.getFeatureById(
        originalFeature.getId()!,
      );
      expect(obliqueFeature).to.be.null;
      await timeout(1);
      obliqueFeature = sourceSync.obliqueSource.getFeatureById(
        originalFeature.getId()!,
      );
      expect(obliqueFeature).to.not.be.null;
      await timeout(1);
    });

    it('should not add the obliqueFeature after the conversion is done, if the original feature was removed', async () => {
      vectorSource.addFeatures([originalFeature]);
      let obliqueFeature = sourceSync.obliqueSource.getFeatureById(
        originalFeature.getId()!,
      );
      expect(obliqueFeature).to.be.null;
      vectorSource.removeFeature(originalFeature);
      await timeout(1);
      obliqueFeature = sourceSync.obliqueSource.getFeatureById(
        originalFeature.getId()!,
      );
      expect(obliqueFeature).to.be.null;
    });
  });

  describe('removing a feature from the implementation', () => {
    let vectorSource: VectorSource;
    let sourceSync: SourceObliqueSync;
    let originalFeature: Feature;
    let style: Style;
    let obliqueFeature: Feature;
    let id: string | number;

    beforeEach(async () => {
      vectorSource = new VectorSource();
      sourceSync = createSourceObliqueSync(vectorSource, map);
      sourceSync.activate();
      originalFeature = createFeature();
      id = originalFeature.getId()!;
      style = new Style({ fill: new Fill({ color: '#ff0000' }) });
      originalFeature.setStyle(style);
      vectorSource.addFeatures([originalFeature]);
      await timeout(debounceTimeout);
      obliqueFeature = sourceSync.obliqueSource.getFeatureById(id)!;
      vectorSource.removeFeature(originalFeature);
    });

    afterEach(() => {
      vectorSource.dispose();
      sourceSync.destroy();
    });

    it('should remove the feature from the oblique source', () => {
      expect(sourceSync.obliqueSource.getFeatureById(id)).to.be.null;
    });

    describe('removing of listeners', () => {
      it('should no longer update on changes to the mercator geometry', async () => {
        const geom = obliqueFeature.getGeometry()!;
        const spy = sandbox.spy();
        geom.on('change', spy);
        originalFeature.getGeometry()!.translate(1, 1);
        await timeout(debounceTimeout);
        expect(spy).to.not.have.been.called;
      });

      it('should not longer update on changes to the oblique geometry', async () => {
        const geom = originalFeature.getGeometry()!;
        const spy = sandbox.spy();
        geom.on('change', spy);
        obliqueFeature.getGeometry()!.translate(1, 1);
        await timeout(debounceTimeout);
        expect(spy).to.not.have.been.called;
      });

      it('should not reset oblique geometry on changes to the geometry', () => {
        const obliqueGeom = obliqueFeature.getGeometry();
        originalFeature.setGeometry(new Point([1, 1, 10]));
        expect(obliqueFeature.getGeometry()).to.equal(obliqueGeom);
      });
    });
  });

  describe('feature listeners of added features', () => {
    let vectorSource: VectorSource;
    let sourceSync: SourceObliqueSync;
    let originalFeature: Feature;
    let obliqueFeature: Feature;
    let id: string | number;
    let clock: sinon.SinonFakeTimers;

    beforeEach(async () => {
      vectorSource = new VectorSource();
      sourceSync = createSourceObliqueSync(vectorSource, map);
      sourceSync.activate();
      originalFeature = createFeature();
      id = originalFeature.getId()!;
      vectorSource.addFeatures([originalFeature]);
      await timeout(debounceTimeout);
      obliqueFeature = sourceSync.obliqueSource.getFeatureById(id)!;
      clock = sandbox.useFakeTimers(1);
    });

    afterEach(() => {
      sandbox.restore();
      sourceSync.destroy();
      vectorSource.dispose();
    });

    it('should add a change listener, updating the style on the shadow feature, if the original features changes', () => {
      const style = new Style({ fill: new Fill({ color: '#FF0000' }) });
      originalFeature.setStyle(style);
      expect(obliqueFeature.getStyle()).to.equal(style);
    });

    it('should add a change listener to the original geometry, updating the oblique geometry when called', (done) => {
      obliqueFeature.getGeometry()!.on('change', () => {
        done();
      });
      originalFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout);
    });

    it('should add a change listener to the oblique geometry, updating the original geometry when called', (done) => {
      originalFeature.getGeometry()!.on('change', () => {
        done();
      });
      obliqueFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout);
    });

    describe('original geometry change listener', () => {
      it('should update the geometry', (done) => {
        obliqueFeature.on('change:geometry', () => {
          done();
        });
        originalFeature.setGeometry(new Point([1489084, 6892790, 0]));
        clock.tick(debounceTimeout);
      });

      it('should remove the previous geometry listener', (done) => {
        const oldGeometry = originalFeature.getGeometry();
        obliqueFeature.on('change:geometry', () => {
          const spy = sandbox.spy();
          obliqueFeature.getGeometry()!.on('change', spy);
          oldGeometry!.setCoordinates([2, 2, 1]);
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
          obliqueFeature.getGeometry()!.on('change', () => {
            done();
          });
          newGeometry.translate(1, 1);
          clock.tick(debounceTimeout);
        });
        originalFeature.setGeometry(newGeometry);
        clock.tick(debounceTimeout);
      });

      describe('handling of circles', () => {
        let actuallyCircle: Polygon;

        beforeEach(() => {
          actuallyCircle = new Polygon([
            [
              [1, 1, 0],
              [0, 1, 0],
              [0, 0, 0],
            ],
          ]);
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
    let vectorSource: VectorSource;
    let sourceSync: SourceObliqueSync;
    let originalFeature: Feature;
    let obliqueFeature: Feature;
    let id: string | number;
    let clock: sinon.SinonFakeTimers;

    beforeEach(async () => {
      vectorSource = new VectorSource();
      sourceSync = createSourceObliqueSync(vectorSource, map);
      sourceSync.activate();
      originalFeature = createFeature();
      id = originalFeature.getId()!;
      vectorSource.addFeatures([originalFeature]);
      await timeout(debounceTimeout);
      obliqueFeature = sourceSync.obliqueSource.getFeatureById(id)!;
      clock = sandbox.useFakeTimers(1);
    });

    afterEach(() => {
      sandbox.restore();
      sourceSync.destroy();
      vectorSource.dispose();
    });

    it('should update the oblique geometry after 200ms', () => {
      originalFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout);
      expect(obliqueFeature.getGeometry()!.getCoordinates()).to.have.members([
        2676.7210834316597, 6483.7722926452625, 0,
      ]);
    });

    it('should clear a previously updating geometry call, resetting the debounce timer, if called again', () => {
      const spy = sandbox.spy();
      obliqueFeature.getGeometry()!.on('change', spy);
      originalFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout / 2);
      originalFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout);
      expect(obliqueFeature.getGeometry()!.getCoordinates()).to.have.members([
        2682.558409466228, 6487.261329634799, 0,
      ]);
      expect(spy).to.have.been.calledOnce;
    });

    it('should not update oblique, if updating mercator', () => {
      const spy = sandbox.spy();
      obliqueFeature.getGeometry()!.translate(1, 1);
      obliqueFeature.getGeometry()!.on('change', spy);
      originalFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout);
      expect(spy).to.not.have.been.called;
    });

    it('should update instantly, if the geometry is already transformed to image', () => {
      originalFeature.getGeometry()![alreadyTransformedToImage] = true;
      originalFeature.getGeometry()!.setCoordinates([1, 1, 0]);
      expect(obliqueFeature.getGeometry()!.getCoordinates()).to.have.members([
        1, 1, 0,
      ]);
    });
  });

  describe('updating mercator geometry', () => {
    let vectorSource: VectorSource;
    let sourceSync: SourceObliqueSync;
    let originalFeature: Feature;
    let obliqueFeature: Feature;
    let id: string | number;
    let clock: sinon.SinonFakeTimers;

    beforeEach(async () => {
      vectorSource = new VectorSource();
      sourceSync = createSourceObliqueSync(vectorSource, map);
      sourceSync.activate();
      originalFeature = createFeature();
      id = originalFeature.getId()!;
      vectorSource.addFeatures([originalFeature]);
      await timeout(debounceTimeout);
      obliqueFeature = sourceSync.obliqueSource.getFeatureById(id)!;
      clock = sandbox.useFakeTimers(1);
    });

    afterEach(() => {
      sandbox.restore();
      sourceSync.destroy();
      vectorSource.dispose();
    });

    it('should update the oblique geometry after 200ms', (done) => {
      const spy = sandbox.spy();
      originalFeature.getGeometry()!.on('change', spy);
      obliqueFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout);
      clock.restore();
      setTimeout(() => {
        expect(spy).to.have.been.calledOnce;
        done();
      });
    });

    it('should clear a previously updating geometry call, resetting the debounce timer, if called again', (done) => {
      const spy = sandbox.spy();
      originalFeature.getGeometry()!.on('change', spy);
      obliqueFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout / 2);
      obliqueFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout);
      clock.restore();
      setTimeout(() => {
        expect(spy).to.have.been.calledOnce;
        done();
      });
    });

    it('should not update oblique, if updating mercator', (done) => {
      originalFeature.getGeometry()!.translate(1, 1);
      const spy = sandbox.spy();
      originalFeature.getGeometry()!.on('change', spy);
      obliqueFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout);
      clock.restore();
      setTimeout(() => {
        expect(spy).to.not.have.been.called;
        done();
      });
    });

    it('should reset the original geometry, if its actually a circle', async () => {
      clock.restore();
      originalFeature.setGeometry(new Circle([1489084, 6892790, 0], 20));
      await timeout(debounceTimeout);
      obliqueFeature.getGeometry()!.setCoordinates([
        [
          [1, 1, 0],
          [1, 0, 0],
          [0, 0, 0],
        ],
      ]);
      await timeout(debounceTimeout);
      const geometry = originalFeature.getGeometry();
      expect(geometry).to.have.property(actuallyIsCircle);
      expect(geometry).to.be.an.instanceof(Polygon);
    });
  });

  describe('updating original geometry which already transformed to image', () => {
    let vectorSource: VectorSource;
    let sourceSync: SourceObliqueSync;
    let originalFeature: Feature;
    let obliqueFeature: Feature;
    let id: string | number;
    let clock: sinon.SinonFakeTimers;

    beforeEach(async () => {
      vectorSource = new VectorSource();
      sourceSync = createSourceObliqueSync(vectorSource, map);
      sourceSync.activate();
      originalFeature = createAlreadyTransformedToImageFeature();
      id = originalFeature.getId()!;
      vectorSource.addFeatures([originalFeature]);
      await timeout(debounceTimeout);
      obliqueFeature = sourceSync.obliqueSource.getFeatureById(id)!;
      clock = sandbox.useFakeTimers(1);
    });

    afterEach(() => {
      sandbox.restore();
      sourceSync.destroy();
      vectorSource.dispose();
    });

    it('should update the oblique geometry after 200ms', (done) => {
      const spy = sandbox.spy();
      originalFeature.getGeometry()!.on('change', spy);
      obliqueFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout);
      clock.restore();
      setTimeout(() => {
        expect(spy).to.have.been.calledOnce;
        done();
      });
    });

    it('after updating, the geometry should no longer be already transformed to image', (done) => {
      const spy = sandbox.spy();
      originalFeature.getGeometry()!.on('change', spy);
      obliqueFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout);
      clock.restore();
      setTimeout(() => {
        expect(originalFeature.getGeometry()).to.not.have.property(
          alreadyTransformedToImage,
        );
        done();
      });
    });

    it('should clear a previously updating geometry call, resetting the debounce timer, if called again', (done) => {
      const spy = sandbox.spy();
      originalFeature.getGeometry()!.on('change', spy);
      obliqueFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout / 2);
      obliqueFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout);
      clock.restore();
      setTimeout(() => {
        expect(spy).to.have.been.calledOnce;
        done();
      });
    });

    it('should not update oblique, if updating mercator', (done) => {
      originalFeature.getGeometry()!.translate(1, 1);
      const spy = sandbox.spy();
      originalFeature.getGeometry()!.on('change', spy);
      obliqueFeature.getGeometry()!.translate(1, 1);
      clock.tick(debounceTimeout);
      clock.restore();
      setTimeout(() => {
        expect(spy).to.not.have.been.called;
        done();
      });
    });
  });

  describe('handling of image changes', () => {
    describe('while the implementation is active', () => {
      let startingFeature: Feature;
      let targetFeature: Feature;
      let obliqueFeature: Feature;
      let originalImageName: string;
      let vectorSource: VectorSource;
      let sourceSync: SourceObliqueSync;

      before(async () => {
        vectorSource = new VectorSource();
        sourceSync = createSourceObliqueSync(vectorSource, map);
        sourceSync.activate();
        originalImageName = map.currentImage!.name;
        startingFeature = new Feature({
          geometry: new Point([1488482, 6891312, 0]),
        });
        startingFeature.setId(uuid());

        targetFeature = new Feature({
          geometry: new Point([1490224.677816213, 6894132.787239241, 0]),
        });
        targetFeature.setId(uuid());

        vectorSource.addFeatures([startingFeature, targetFeature]);
        await timeout(debounceTimeout);
        obliqueFeature = sourceSync.obliqueSource.getFeatureById(
          startingFeature.getId()!,
        )!;
        await map.setImageByName('034_070_110005034');
      });

      after(async () => {
        vectorSource.dispose();
        sourceSync.destroy();
        await map.setImageByName(originalImageName);
      });

      it('should remove previous features', () => {
        expect(
          sourceSync.obliqueSource.getFeatureById(startingFeature.getId()!),
        ).to.be.null;
      });

      it('should remove the oblique geometry symbol from previous features', () => {
        expect(startingFeature).to.not.have.property(obliqueGeometry);
      });

      it('should no longer update on changes to the mercator geometry', async () => {
        const geom = obliqueFeature.getGeometry()!;
        const spy = sandbox.spy();
        geom.on('change', spy);
        startingFeature.getGeometry()!.translate(1, 1);
        await timeout(debounceTimeout);
        expect(spy).to.not.have.been.called;
      });

      it('should add the features within the new image', () => {
        expect(
          sourceSync.obliqueSource.getFeatureById(targetFeature.getId()!),
        ).to.be.an.instanceof(Feature);
      });
    });

    describe('while the implementation is not active', () => {
      let startingFeature: Feature;
      let targetFeature: Feature;
      let originalImageName: string;
      let vectorSource: VectorSource;
      let sourceSync: SourceObliqueSync;

      before(async () => {
        vectorSource = new VectorSource();
        sourceSync = createSourceObliqueSync(vectorSource, map);
        sourceSync.deactivate();
        originalImageName = map.currentImage!.name;
        startingFeature = new Feature({
          geometry: new Point([1488482, 6891312, 0]),
        });

        targetFeature = new Feature({
          geometry: new Point([1490224.677816213, 6894132.787239241, 0]),
        });

        vectorSource.addFeatures([startingFeature, targetFeature]);
        await map.setImageByName('034_070_110005034');
      });

      after(async () => {
        vectorSource.dispose();
        sourceSync.destroy();
        await map.setImageByName(originalImageName);
      });

      it('should not fetch features within the new view', () => {
        expect(sourceSync.obliqueSource.getFeatures()).to.be.empty;
      });
    });
  });

  describe('destroying the implementation', () => {
    let vectorSource: VectorSource;
    let sourceSync: SourceObliqueSync;

    beforeEach(() => {
      vectorSource = new VectorSource();
      sourceSync = createSourceObliqueSync(vectorSource, map);
      sourceSync.activate();
    });

    afterEach(() => {
      vectorSource.dispose();
    });

    it('should not update the oblique geometry after destruction', async () => {
      const newFeature = createFeature();
      vectorSource.addFeatures([newFeature]);
      const obliqueGeom = newFeature[obliqueGeometry];
      expect(obliqueGeom).to.exist;
      await timeout(1);
      const coords = obliqueGeom!.getCoordinates() as number[];
      expect(coords).to.not.deep.equal(
        newFeature.getGeometry()!.getCoordinates(),
      );
      newFeature.getGeometry()!.translate(1, 1);
      sourceSync.destroy();
      await timeout(debounceTimeout);
      expect(obliqueGeom!.getCoordinates()).to.deep.equal(coords);
    });
  });
});

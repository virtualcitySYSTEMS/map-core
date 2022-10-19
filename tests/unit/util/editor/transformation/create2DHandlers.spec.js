import { LineString, Polygon } from 'ol/geom.js';
import { getOpenlayersMap } from '../../../helpers/openlayersHelpers.js';
import {
  AXIS_AND_PLANES,
  create2DHandlers,
  handlerSymbol,
  mercatorProjection,
  TransformationMode,
  VectorLayer,
} from '../../../../../index.js';

describe('create2DHandlers', () => {
  describe('showing handlers', () => {
    let map;
    let scratchLayer;
    let handlers;

    before(async () => {
      map = await getOpenlayersMap({});
      scratchLayer = new VectorLayer({
        projection: mercatorProjection.toJSON(),
      });
      handlers = create2DHandlers(map, scratchLayer, TransformationMode.TRANSLATE);
      handlers.show = true;
    });

    after(() => {
      map.destroy();
      scratchLayer.destroy();
      handlers.destroy();
    });

    it('should create an X axis handler', () => {
      const features = scratchLayer.getFeatures().filter(f => f[handlerSymbol] === AXIS_AND_PLANES.X);
      expect(features).to.have.lengthOf(2);
    });

    it('should create an Y axis handler', () => {
      const features = scratchLayer.getFeatures().filter(f => f[handlerSymbol] === AXIS_AND_PLANES.Y);
      expect(features).to.have.lengthOf(2);
    });

    it('should create an XY plane handler', () => {
      const features = scratchLayer.getFeatures().filter(f => f[handlerSymbol] === AXIS_AND_PLANES.XY);
      expect(features).to.have.lengthOf(1);
      expect(features[0].getGeometry()).to.be.an.instanceOf(Polygon);
    });
  });

  describe('hiding handlers', () => {
    let map;
    let scratchLayer;
    let handlers;

    before(async () => {
      map = await getOpenlayersMap({});
      scratchLayer = new VectorLayer({
        projection: mercatorProjection.toJSON(),
      });
      handlers = create2DHandlers(map, scratchLayer, TransformationMode.TRANSLATE);
      handlers.show = true;
      handlers.show = false;
    });

    after(() => {
      map.destroy();
      scratchLayer.destroy();
      handlers.destroy();
    });

    it('should remove all previously added features', () => {
      expect(scratchLayer.getFeatures()).to.be.empty;
    });
  });

  describe('setting the center', () => {
    let map;
    let scratchLayer;
    let handlers;

    before(async () => {
      map = await getOpenlayersMap({});
      sinon.stub(map, 'getCurrentResolution').returns(1 / 60); // prevent scaling
      scratchLayer = new VectorLayer({
        projection: mercatorProjection.toJSON(),
      });
      handlers = create2DHandlers(map, scratchLayer, TransformationMode.TRANSLATE);
      handlers.show = true;
      handlers.setCenter([1, 1, 0]);
    });

    after(() => {
      map.destroy();
      scratchLayer.destroy();
      handlers.destroy();
    });

    it('should set the X axis handler to the new center', () => {
      const handler = scratchLayer.getFeatures().find(f => f[handlerSymbol] === AXIS_AND_PLANES.X &&
        f.getGeometry() instanceof LineString);
      expect(handler).to.exist;
      expect(handler.getGeometry().getFirstCoordinate()).to.have.members([1, 1, 0]);
    });

    it('should create an Y axis handler', () => {
      const handler = scratchLayer.getFeatures().find(f => f[handlerSymbol] === AXIS_AND_PLANES.Y &&
        f.getGeometry() instanceof LineString);
      expect(handler).to.exist;
      expect(handler.getGeometry().getFirstCoordinate()).to.have.members([1, 1, 0]);
    });

    it('should create an XY plane handler', () => {
      const handler = scratchLayer.getFeatures().find(f => f[handlerSymbol] === AXIS_AND_PLANES.XY);
      const extent = handler.getGeometry().getExtent();
      expect(extent[0]).to.equal(1.2);
      expect(extent[1]).to.equal(1.2);
    });
  });

  describe('post render scaling', () => {
    let map;
    let scratchLayer;
    let handlers;

    before(async () => {
      map = await getOpenlayersMap({});
      scratchLayer = new VectorLayer({
        projection: mercatorProjection.toJSON(),
      });
      handlers = create2DHandlers(map, scratchLayer, TransformationMode.TRANSLATE);
      handlers.show = true;
      handlers.setCenter([1, 1, 0]);
      sinon.stub(map, 'getCurrentResolution').returns(1 / 30);
      map.olMap.renderSync();
    });

    after(() => {
      map.destroy();
      scratchLayer.destroy();
      handlers.destroy();
    });

    it('should set the X axis handler to the new center', () => {
      const handler = scratchLayer.getFeatures().find(f => f[handlerSymbol] === AXIS_AND_PLANES.X &&
        f.getGeometry() instanceof LineString);
      expect(handler).to.exist;
      expect(handler.getGeometry().getLastCoordinate()).to.have.members([3, 1, 0]);
    });

    it('should create an Y axis handler', () => {
      const handler = scratchLayer.getFeatures().find(f => f[handlerSymbol] === AXIS_AND_PLANES.Y &&
        f.getGeometry() instanceof LineString);
      expect(handler).to.exist;
      expect(handler.getGeometry().getLastCoordinate()).to.have.members([1, 3, 0]);
    });

    it('should create an XY plane handler', () => {
      const handler = scratchLayer.getFeatures().find(f => f[handlerSymbol] === AXIS_AND_PLANES.XY);
      const extent = handler.getGeometry().getExtent();
      expect(extent[2]).to.be.closeTo(1.8, 0.0001);
      expect(extent[3]).to.be.closeTo(1.8, 0.0001);
    });
  });

  describe('creating shadows', () => {
    let mercatorExtent;

    before(() => {
      mercatorExtent = mercatorProjection.proj.getExtent();
    });

    describe('creating X axis shadows', () => {
      let map;
      let scratchLayer;
      let handlers;

      before(async () => {
        map = await getOpenlayersMap({});
        scratchLayer = new VectorLayer({
          projection: mercatorProjection.toJSON(),
        });
        handlers = create2DHandlers(map, scratchLayer, TransformationMode.TRANSLATE);
        handlers.show = true;
        handlers.showAxis = AXIS_AND_PLANES.X;
        handlers.setCenter([1, 1, 0]);
      });

      after(() => {
        map.destroy();
        scratchLayer.destroy();
        handlers.destroy();
      });

      it('should add the X axis feature & X shadow', () => {
        const features = scratchLayer.getFeatures().filter(f => !f[handlerSymbol]);
        expect(features).to.have.lengthOf(3);
      });

      it('should highlight the X axis', () => {
        const axis = scratchLayer.getFeatures().find(f => !f[handlerSymbol]);
        expect(axis.getGeometry().getFirstCoordinate()).to.have.ordered.members([mercatorExtent[0], 0, 0]);
        expect(axis.getGeometry().getLastCoordinate()).to.have.ordered.members([mercatorExtent[2], 0, 0]);
      });

      it('should set the X axis shadow to the original center center', () => {
        const handler = scratchLayer.getFeatures().reverse().find(f => !f[handlerSymbol]);
        expect(handler.getGeometry().getFirstCoordinate()).to.have.members([0, 0, 0]);
      });
    });

    describe('creating Y axis shadows', () => {
      let map;
      let scratchLayer;
      let handlers;

      before(async () => {
        map = await getOpenlayersMap({});
        scratchLayer = new VectorLayer({
          projection: mercatorProjection.toJSON(),
        });
        handlers = create2DHandlers(map, scratchLayer, TransformationMode.TRANSLATE);
        handlers.show = true;
        handlers.showAxis = AXIS_AND_PLANES.Y;
        handlers.setCenter([1, 1, 0]);
      });

      after(() => {
        map.destroy();
        scratchLayer.destroy();
        handlers.destroy();
      });

      it('should add the Y axis feature & Y shadow', () => {
        const features = scratchLayer.getFeatures().filter(f => !f[handlerSymbol]);
        expect(features).to.have.lengthOf(3);
      });

      it('should highlight the Y axis', () => {
        const axis = scratchLayer.getFeatures().find(f => !f[handlerSymbol]);
        expect(axis.getGeometry().getFirstCoordinate()).to.have.ordered.members([0, mercatorExtent[1], 0]);
        expect(axis.getGeometry().getLastCoordinate()).to.have.ordered.members([0, mercatorExtent[3], 0]);
      });

      it('should set the Y axis shadow to the original center center', () => {
        const handler = scratchLayer.getFeatures()
          .find(f => !f[handlerSymbol] && f.getGeometry().getFirstCoordinate().every(c => c === 0));
        expect(handler).to.exist;
      });
    });

    describe('creating XY axis shadows', () => {
      let map;
      let scratchLayer;
      let handlers;

      before(async () => {
        map = await getOpenlayersMap({});
        scratchLayer = new VectorLayer({
          projection: mercatorProjection.toJSON(),
        });
        handlers = create2DHandlers(map, scratchLayer, TransformationMode.TRANSLATE);
        handlers.show = true;
        handlers.showAxis = AXIS_AND_PLANES.XY;
        handlers.setCenter([1, 1, 0]);
      });

      after(() => {
        map.destroy();
        scratchLayer.destroy();
        handlers.destroy();
      });

      it('should add the X & Y axis feature & XY shadow', () => {
        const features = scratchLayer.getFeatures().filter(f => !f[handlerSymbol]);
        expect(features).to.have.lengthOf(3);
      });

      it('should set the XY axis shadow to the original center center', () => {
        const handler = scratchLayer.getFeatures().reverse().find(f => !f[handlerSymbol]);
        expect(handler).to.exist;
        const extent = handler.getGeometry().getExtent();
        expect(extent[0]).to.equal(0.2);
        expect(extent[1]).to.equal(0.2);
      });
    });

    describe('creating axis shadows on a scaled map', () => {
      let map;
      let scratchLayer;
      let handlers;

      before(async () => {
        map = await getOpenlayersMap({});
        scratchLayer = new VectorLayer({
          projection: mercatorProjection.toJSON(),
        });
        handlers = create2DHandlers(map, scratchLayer, TransformationMode.TRANSLATE);
        handlers.show = true;
        handlers.setCenter([1, 1, 0]);
        sinon.stub(map, 'getCurrentResolution').returns(1 / 30);
        map.olMap.renderSync();

        handlers.showAxis = AXIS_AND_PLANES.X;
        handlers.setCenter([2, 2, 0]);
      });

      after(() => {
        map.destroy();
        scratchLayer.destroy();
        handlers.destroy();
      });

      it('should add the X axis feature & X shadow', () => {
        const features = scratchLayer.getFeatures().filter(f => !f[handlerSymbol]);
        expect(features).to.have.lengthOf(3);
      });

      it('should set the X axis shadow to the original center center', () => {
        const handler = scratchLayer.getFeatures()
          .find((f) => {
            if (!f[handlerSymbol]) {
              const coordinate = f.getGeometry().getFirstCoordinate();
              return coordinate[0] === 1 &&
                coordinate[1] === 1 &&
                coordinate[2] === 0;
            }
            return false;
          });
        expect(handler).to.exist;
      });

      it('should properly apply scaling', () => {
        const handler = scratchLayer.getFeatures()
          .find((f) => {
            if (!f[handlerSymbol]) {
              const coordinate = f.getGeometry().getLastCoordinate();
              return coordinate[0] === 3 &&
                coordinate[1] === 1 &&
                coordinate[2] === 0;
            }
            return false;
          });
        expect(handler).to.exist;
      });
    });
  });
});

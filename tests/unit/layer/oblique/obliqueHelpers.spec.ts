import { expect } from 'chai';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Circle from 'ol/geom/Circle.js';
import Polygon from 'ol/geom/Polygon.js';
import type { Geometry } from 'ol/geom.js';
import {
  actuallyIsCircle,
  alreadyTransformedToImage,
  obliqueGeometry,
} from '../../../../src/layer/vectorSymbols.js';
import {
  getPolygonizedGeometry,
  setNewGeometry,
} from '../../../../src/layer/oblique/obliqueHelpers.js';

describe('Helpers', () => {
  describe('setting a new geometry on an oblique feature', () => {
    let originalFeature: Feature;
    let obliqueFeature: Feature;

    beforeEach(() => {
      originalFeature = new Feature();
      obliqueFeature = new Feature();
    });

    describe('if geometry not transformed to imaged', () => {
      it('should set the new geometry on the original image as the obliqueGeometry', () => {
        originalFeature.setGeometry(new Point([1, 1, 0]));
        setNewGeometry(originalFeature, obliqueFeature);
        const obliqueGeom = obliqueFeature.getGeometry();
        expect(originalFeature)
          .to.have.property(obliqueGeometry)
          .and.to.equal(obliqueGeom);
      });

      it('should convert the geometry to a polygon', () => {
        const geom = new Circle([1, 1, 0], 20);
        originalFeature.setGeometry(geom);
        setNewGeometry(originalFeature, obliqueFeature);
        expect(originalFeature[obliqueGeometry]).to.be.an.instanceOf(Polygon);
      });
    });

    describe('if geometry already transformed to image', () => {
      let geom: Circle;

      beforeEach(() => {
        geom = new Circle([1, 1, 0], 20);
        geom[alreadyTransformedToImage] = true;
        originalFeature.setGeometry(geom);
      });

      it('should not convert to polygon', () => {
        setNewGeometry(originalFeature, obliqueFeature);
        const obliqueGeom = obliqueFeature.getGeometry() as Circle;
        expect(obliqueGeom).to.be.an.instanceof(Circle);
        expect(obliqueGeom.getCenter()).to.have.members([1, 1, 0]);
        expect(obliqueGeom.getRadius()).to.equal(20);
        expect(obliqueGeom).to.not.equal(geom);
      });

      it('should copy any properties on the geometry to the oblique geometry', () => {
        geom.set('test', true);
        setNewGeometry(originalFeature, obliqueFeature);
        const obliqueGeom = originalFeature[obliqueGeometry]!;
        expect(obliqueGeom.get('test')).to.be.true;
      });
    });
  });

  describe('getting a polygonized geometry', () => {
    describe('for a circle', () => {
      let feature: Feature;
      let convertedGeometry: Geometry;

      before(() => {
        feature = new Feature();
        feature.setGeometry(new Circle([1, 1, 0], 20));
        convertedGeometry = getPolygonizedGeometry(feature);
      });

      it('should return a polygonized circle', () => {
        expect(convertedGeometry).to.be.an.instanceof(Polygon);
      });

      it('should set the actuallyIsCircle symbol', () => {
        expect(convertedGeometry).to.have.property(actuallyIsCircle, true);
      });
    });

    describe('for a bbox', () => {
      let feature: Feature;
      let convertedGeometry: Geometry;

      before(() => {
        feature = new Feature();
        const geom = new Polygon([
          [
            [1, 1, 0],
            [0, 1, 0],
            [0, 0, 0],
          ],
        ]);
        geom.set('_vcsGeomType', 'bbox');
        feature.setGeometry(geom);
        convertedGeometry = getPolygonizedGeometry(feature);
      });

      it('should remove the vcsGeomType property', () => {
        expect(convertedGeometry.get('_vcsGeomType')).to.be.undefined;
      });

      it('should set the actuallyIsCircle symbol', () => {
        expect(convertedGeometry).to.have.property(actuallyIsCircle, false);
      });
    });
  });

  describe('getting a polygonized geometry retaining rectangle', () => {
    describe('for a circle', () => {
      let feature: Feature;
      let convertedGeometry: Geometry;

      before(() => {
        feature = new Feature();
        feature.setGeometry(new Circle([1, 1, 0], 20));
        convertedGeometry = getPolygonizedGeometry(feature, true);
      });

      it('should return a polygonized circle', () => {
        expect(convertedGeometry).to.be.an.instanceof(Polygon);
      });

      it('should set the actuallyIsCircle symbol', () => {
        expect(convertedGeometry).to.have.property(actuallyIsCircle, true);
      });
    });

    describe('for a bbox', () => {
      let feature: Feature;
      let convertedGeometry: Geometry;

      before(() => {
        feature = new Feature();
        const geom = new Polygon([
          [
            [1, 1, 0],
            [0, 1, 0],
            [0, 0, 0],
          ],
        ]);
        geom.set('_vcsGeomType', 'bbox');
        feature.setGeometry(geom);
        convertedGeometry = getPolygonizedGeometry(feature, true);
      });

      it('should retain the vcsGeomType property', () => {
        expect(convertedGeometry.get('_vcsGeomType')).to.equal('bbox');
      });

      it('should not set the actuallyIsCircle symbol', () => {
        expect(convertedGeometry).not.to.have.property(actuallyIsCircle);
      });
    });
  });
});

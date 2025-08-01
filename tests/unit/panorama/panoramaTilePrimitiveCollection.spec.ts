import {
  Cartesian3,
  Color,
  Matrix4,
  Math as CesiumMath,
  Primitive,
} from '@vcmap-cesium/engine';
import { expect } from 'chai';
import sinon from 'sinon';
import PanoramaTilePrimitiveCollection from '../../../src/panorama/panoramaTilePrimitiveCollection.js';
import type { PanoramaTile } from '../../../src/panorama/panoramaTile.js';
import { createPanoramaTile } from '../../../src/panorama/panoramaTile.js';
import { createTileCoordinate } from '../../../src/panorama/panoramaTileCoordinate.js';
import { PanoramaOverlayMode } from '../../../src/panorama/panoramaTileMaterial.js';
import { getVcsEventSpy } from '../helpers/cesiumHelpers.js';
import type { PanoramaMap } from '../../../index.js';
import { getPanoramaMap } from '../helpers/panoramaHelpers.js';

describe('PanoramaTilePrimitiveCollection', () => {
  let map: PanoramaMap;

  before(() => {
    map = getPanoramaMap();
  });

  after(() => {
    map.destroy();
  });

  describe('setting material properties', () => {
    let collection: PanoramaTilePrimitiveCollection;
    let tiles: PanoramaTile[];

    beforeEach(() => {
      tiles = [];
      for (let i = 0; i < 5; i++) {
        tiles.push(
          createPanoramaTile(
            createTileCoordinate(i, 0, 2),
            Matrix4.IDENTITY,
            [4, 4],
          ),
        );
      }
      collection = new PanoramaTilePrimitiveCollection();
      tiles.forEach((tile) => {
        collection.add(tile.getPrimitive(map));
      });
    });

    afterEach(() => {
      collection.destroy();
      tiles.forEach((tile) => {
        tile.destroy();
      });
    });

    it('should set a new overlay value and update all primitives', () => {
      collection.overlay = PanoramaOverlayMode.Depth;
      tiles.forEach((tile) => {
        expect(tile.getMaterial(map)?.overlay).to.equal(
          PanoramaOverlayMode.Depth,
        );
      });
    });

    it('should raise overlayChanged event when overlay changes', () => {
      const spy = getVcsEventSpy(collection.overlayChanged, sinon);
      collection.overlay = PanoramaOverlayMode.Depth;
      expect(spy).to.have.been.calledOnce;
    });

    it('should not raise overlayChanged event when overlay does not change', () => {
      const spy = getVcsEventSpy(collection.overlayChanged, sinon);
      collection.overlay = PanoramaOverlayMode.Depth;
      collection.overlay = PanoramaOverlayMode.Depth;
      expect(spy).to.have.been.calledOnce;
    });

    it('should set a new overlayOpacity and update all primitives', () => {
      collection.overlayOpacity = 0.5;
      tiles.forEach((tile) => {
        expect(tile.getMaterial(map)?.overlayOpacity).to.equal(0.5);
      });
    });

    it('should set a new overlayNaNColor and update all primitives', () => {
      collection.overlayNaNColor = Color.BLUE;
      tiles.forEach((tile) => {
        expect(tile.getMaterial(map)?.overlayNaNColor).to.eql(Color.BLUE);
      });
    });

    it('should set a new showDebug value and update all primitives', () => {
      collection.showDebug = true;
      tiles.forEach((tile) => {
        expect(tile.getMaterial(map)?.showDebug).to.be.true;
      });
    });

    it('should set a new opacity value and update all primitives', () => {
      collection.opacity = 0.25;
      tiles.forEach((tile) => {
        expect(tile.getMaterial(map)?.opacity).to.equal(0.25);
      });
    });

    it('should set a new cursorPosition and update all primitives', () => {
      collection.cursorPosition = new Cartesian3(1, 1, 1);
      tiles.forEach((tile) => {
        expect(tile.getMaterial(map)?.cursorPosition).to.eql(
          new Cartesian3(1, 1, 1),
        );
      });
    });

    it('should not update primitives when setting the same value', () => {
      tiles.forEach((tile) => {
        tile.getMaterial(map)!.opacity = 0.5;
      });

      collection.opacity = 1;
      tiles.forEach((tile) => {
        expect(tile.getMaterial(map)?.opacity).to.equal(0.5);
      });
    });

    it('should not update the primitive cursor position when setting a value close to the current one', () => {
      collection.cursorPosition = new Cartesian3(1, 1, 1);
      tiles.forEach((tile) => {
        tile.getMaterial(map)!.cursorPosition = new Cartesian3(2, 2, 2);
      });
      collection.cursorPosition = new Cartesian3(1, 1, 1);
      tiles.forEach((tile) => {
        expect(tile.getMaterial(map)?.cursorPosition).to.eql(
          new Cartesian3(2, 2, 2),
        );
      });
      collection.cursorPosition = new Cartesian3(
        1 + CesiumMath.EPSILON11,
        1 + CesiumMath.EPSILON11,
        1 + CesiumMath.EPSILON11,
      );
      tiles.forEach((tile) => {
        expect(tile.getMaterial(map)?.cursorPosition).to.eql(
          new Cartesian3(2, 2, 2),
        );
      });
    });

    it('should not update the overlay NaN color, if the color is the same', () => {
      collection.overlayNaNColor = Color.BLUE;
      tiles.forEach((tile) => {
        tile.getMaterial(map)!.overlayNaNColor = Color.RED;
      });
      collection.overlayNaNColor = Color.BLUE;
      tiles.forEach((tile) => {
        expect(tile.getMaterial(map)?.overlayNaNColor).to.eql(Color.RED);
      });
    });
  });

  describe('adding a primitive to the collection', () => {
    let collection: PanoramaTilePrimitiveCollection;
    let tile: PanoramaTile;

    beforeEach(() => {
      tile = createPanoramaTile(
        createTileCoordinate(1, 0, 2),
        Matrix4.IDENTITY,
        [4, 4],
      );
      collection = new PanoramaTilePrimitiveCollection();
    });

    afterEach(() => {
      collection.destroy();
      tile.destroy();
    });

    it('should set all material properties from the collection', () => {
      collection.add(tile.getPrimitive(map));
      collection.overlay = PanoramaOverlayMode.Depth;
      collection.opacity = 0.5;
      collection.overlayOpacity = 0.5;
      collection.overlayNaNColor = Color.BLUE;
      collection.showDebug = true;
      collection.cursorPosition = new Cartesian3(1, 1, 1);

      expect(tile.getMaterial(map)?.overlay).to.equal(collection.overlay);
      expect(tile.getMaterial(map)?.overlayOpacity).to.equal(
        collection.overlayOpacity,
      );
      expect(tile.getMaterial(map)?.overlayNaNColor).to.eql(
        collection.overlayNaNColor,
      );
      expect(tile.getMaterial(map)?.showDebug).to.equal(collection.showDebug);
      expect(tile.getMaterial(map)?.opacity).to.equal(collection.opacity);
      expect(tile.getMaterial(map)?.cursorPosition).to.eql(
        collection.cursorPosition,
      );
    });

    it('should add the primitive to the collection', () => {
      collection.add(tile.getPrimitive(map));
      expect(collection.contains(tile.getPrimitive(map))).to.be.true;
    });

    describe('invalid primitive', () => {
      let invalidPrimitive: Primitive;

      before(() => {
        invalidPrimitive = new Primitive();
      });

      after(() => {
        invalidPrimitive.destroy();
      });

      it('should reject if the primitive is not a valid PanoramaTileMaterial', () => {
        expect(() => collection.add(invalidPrimitive)).to.throw();
      });
    });
  });

  describe('removing a primitive from the collection', () => {
    let collection: PanoramaTilePrimitiveCollection;
    let tile: PanoramaTile;

    beforeEach(() => {
      tile = createPanoramaTile(
        createTileCoordinate(2, 0, 2),
        Matrix4.IDENTITY,
        [4, 4],
      );
      collection = new PanoramaTilePrimitiveCollection();
      collection.add(tile.getPrimitive(map));
    });

    afterEach(() => {
      collection.destroy();
      tile.destroy();
    });

    it('should remove the primitive from the collection', () => {
      expect(collection.contains(tile.getPrimitive(map))).to.be.true;
      collection.remove(tile.getPrimitive(map));
      expect(collection.contains(tile.getPrimitive(map))).to.be.false;
    });

    it('should not destroy the primitive when removed', () => {
      collection.remove(tile.getPrimitive(map));
      expect(tile.getPrimitive(map).isDestroyed()).to.be.false;
    });
  });
});

import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { expect } from 'chai';
import { LineString } from 'ol/geom.js';
import type { Coordinate } from 'ol/coordinate.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';
import {
  drapeGeometryOnTerrain,
  placeGeometryOnTerrain,
} from '../../../../src/util/editor/editorHelpers.js';
import type { CesiumMap } from '../../../../index.js';

describe('editorHelpers', () => {
  describe('drapeGeometryOnTerrain', () => {
    let cesiumMap: CesiumMap;
    let stub: SinonStub;

    before(() => {
      cesiumMap = getCesiumMap();
      stub = sinon
        .stub(cesiumMap, 'getHeightFromTerrain')
        .callsFake((coords: Coordinate[]): Promise<Coordinate[]> => {
          coords.forEach((c, i) => {
            c[2] = i;
          });
          return Promise.resolve(coords);
        });
    });

    after(() => {
      stub.restore();
      cesiumMap.destroy();
    });

    it('should place each coordinate of a XYZ layout onto the terrain', async () => {
      const geometry = new LineString([
        [0, 0, 0],
        [0, 1, 0],
        [0, 2, 0],
        [0, 3, 0],
        [0, 4, 0],
      ]);
      await drapeGeometryOnTerrain(geometry, cesiumMap);
      geometry.getCoordinates().forEach((coord, i) => {
        expect(coord[2]).to.equal(i);
      });
    });

    it('should place each coordinate of a XY layout onto the terrain', async () => {
      const geometry = new LineString([
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
      ]);
      await drapeGeometryOnTerrain(geometry, cesiumMap);
      geometry.getCoordinates().forEach((coord, i) => {
        expect(coord[2]).to.equal(i);
      });
    });
  });

  describe('placeGeometryOnTerrain', () => {
    let cesiumMap: CesiumMap;
    let stub: SinonStub;

    before(() => {
      cesiumMap = getCesiumMap();
      stub = sinon
        .stub(cesiumMap, 'getHeightFromTerrain')
        .callsFake((coords: Coordinate[]): Promise<Coordinate[]> => {
          coords.forEach((c, i) => {
            c[2] = i + 1;
          });
          return Promise.resolve(coords);
        });
    });

    after(() => {
      stub.restore();
      cesiumMap.destroy();
    });

    it('should place each coordinate of an XYZ coordinate at the lowest coordinate', async () => {
      const geometry = new LineString([
        [0, 0, 0],
        [0, 1, 0],
        [0, 2, 0],
        [0, 3, 0],
        [0, 4, 0],
      ]);
      await placeGeometryOnTerrain(geometry, cesiumMap);
      geometry.getCoordinates().forEach((coord) => {
        expect(coord[2]).to.equal(1);
      });
    });

    it('should place each coordinate of an XY coordinate at the lowest coordinate', async () => {
      const geometry = new LineString([
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
      ]);
      await placeGeometryOnTerrain(geometry, cesiumMap);
      geometry.getCoordinates().forEach((coord) => {
        expect(coord[2]).to.equal(1);
      });
    });
  });
});

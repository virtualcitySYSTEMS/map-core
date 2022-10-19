import { LineString } from 'ol/geom.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';
import { drapeGeometryOnTerrain, placeGeometryOnTerrain } from '../../../../src/util/editor/editorHelpers.js';

describe('editorHelpers', () => {
  describe('drapeGeometryOnTerrain', () => {
    let cesiumMap;
    let stub;

    before(() => {
      cesiumMap = getCesiumMap();
      stub = sinon.stub(cesiumMap, 'getHeightFromTerrain')
        .callsFake(async (coords) => {
          coords.forEach((c, i) => { c[2] = i; });
          return coords;
        });
    });

    after(() => {
      stub.restore();
      cesiumMap.destroy();
    });

    it('should place each coordinate onto the terrain', async () => {
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
  });

  describe('placeGeometryOnTerrain', () => {
    let cesiumMap;
    let stub;

    before(() => {
      cesiumMap = getCesiumMap();
      stub = sinon.stub(cesiumMap, 'getHeightFromTerrain')
        .callsFake(async (coords) => {
          coords.forEach((c, i) => { c[2] = i + 1; });
          return coords;
        });
    });

    after(() => {
      stub.restore();
      cesiumMap.destroy();
    });

    it('should place each coordinate at the lowest coordinate', async () => {
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
  });
});

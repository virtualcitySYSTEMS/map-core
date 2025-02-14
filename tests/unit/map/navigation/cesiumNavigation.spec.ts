import { expect } from 'chai';
import { Cartesian3 } from '@vcmap-cesium/engine';
import CesiumMap from '../../../../src/map/cesiumMap.js';
import CesiumNavigation from '../../../../src/map/navigation/cesiumNavigation.js';
import { getCesiumMap } from '../../helpers/cesiumHelpers.js';

describe('CesiumNavigation', () => {
  let map: CesiumMap;
  let cesiumNavigation: CesiumNavigation;

  before(() => {
    map = getCesiumMap();
    cesiumNavigation = new CesiumNavigation(map);
  });

  after(() => {
    map.destroy();
  });

  it('should update camera on movement', () => {
    const { camera } = map.getScene()!;
    const startPosition = camera.position.clone(new Cartesian3());
    cesiumNavigation.update({
      time: 0,
      duration: 1,
      input: {
        forward: 1,
        right: 0,
        up: 0,
        tiltDown: 0,
        rollRight: 0,
        turnRight: 0,
      },
    });
    expect(camera?.position.y).to.be.greaterThan(startPosition.y);
  });
  it('should not update camera, if movement is below moveThreshold', () => {
    const { camera } = map.getScene()!;
    const startPosition = camera.position.clone(new Cartesian3());
    cesiumNavigation.moveThreshold = 5;
    cesiumNavigation.update({
      time: 0,
      duration: 1,
      input: {
        forward: 1,
        right: 0,
        up: 0,
        tiltDown: 0,
        rollRight: 0,
        turnRight: 0,
      },
    });
    expect(camera?.position.y).to.equal(startPosition.y);
  });
});

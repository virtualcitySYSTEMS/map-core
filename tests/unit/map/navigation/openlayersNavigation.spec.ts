import { expect } from 'chai';
import type OpenlayersMap from '../../../../src/map/openlayersMap.js';
import OpenlayersNavigation from '../../../../src/map/navigation/openlayersNavigation.js';
import { getOpenlayersMap } from '../../helpers/openlayersHelpers.js';

describe('OpenlayersNavigation', () => {
  let map: OpenlayersMap;
  let openlayersNavigation: OpenlayersNavigation;

  before(async () => {
    map = await getOpenlayersMap();
    openlayersNavigation = new OpenlayersNavigation(map);
  });

  after(() => {
    map.destroy();
  });

  it('should update camera on movement', () => {
    const view = map.olMap!.getView();
    const startPosition = view.getCenter()!;
    openlayersNavigation.update({
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
    const newCenter = view.getCenter()!;
    expect(newCenter[1]).to.be.greaterThan(startPosition[1]);
  });
});

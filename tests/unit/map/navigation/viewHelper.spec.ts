import { expect } from 'chai';
import type OpenlayersMap from '../../../../src/map/openlayersMap.js';
import OpenlayersNavigation from '../../../../src/map/navigation/openlayersNavigation.js';
import { getOpenlayersMap } from '../../helpers/openlayersHelpers.js';
import { moveView } from '../../../../src/map/navigation/viewHelper.js';
import { getZeroInput } from '../../../../src/map/navigation/controller/controllerInput.js';

const inputScratch = getZeroInput();

describe('viewHelper moveView', () => {
  let map: OpenlayersMap;

  before(async () => {
    map = await getOpenlayersMap();
    // eslint-disable-next-line no-new
    new OpenlayersNavigation(map);
  });

  after(() => {
    map.destroy();
  });

  it('should move view forward', () => {
    const view = map.olMap!.getView();
    const startPosition = view.getCenter()!;
    inputScratch.forward = 1;
    moveView(map, inputScratch, 1);
    const newCenter = view.getCenter()!;
    expect(newCenter[0]).to.equal(startPosition[0]);
    expect(newCenter[1]).to.be.greaterThan(startPosition[1]);
    inputScratch.forward = 0;
  });

  it('should move view right', () => {
    const view = map.olMap!.getView();
    const startPosition = view.getCenter()!;
    inputScratch.right = 1;
    moveView(map, inputScratch, 1);
    const newCenter = view.getCenter()!;
    expect(newCenter[0]).to.be.greaterThan(startPosition[0]);
    expect(newCenter[1]).to.equal(startPosition[1]);
    inputScratch.right = 0;
  });

  it('should zoom out', () => {
    const view = map.olMap!.getView();
    const initialZoom = view.getZoom()!;
    inputScratch.up = 1;
    moveView(map, inputScratch, 1);
    expect(view.getZoom()!).to.be.lessThan(initialZoom);
    inputScratch.up = 0;
  });
});

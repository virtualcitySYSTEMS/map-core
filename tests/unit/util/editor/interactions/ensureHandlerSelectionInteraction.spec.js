import { Feature } from 'ol';
import { Cartesian2 } from '@vcmap-cesium/engine';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import { AxisAndPlanes, handlerSymbol } from '../../../../../index.js';
import EnsureHandlerSelectionInteraction from '../../../../../src/util/editor/interactions/ensureHandlerSelectionInteraction.js';

describe('EnsureHandlerSelectionInteraction', () => {
  let map;
  let drillResults;
  const currentFeatures = [];
  let ensureHandlerSelection;
  let drillPick;

  before(() => {
    map = getCesiumMap();
    drillResults = [
      { primitive: {} },
      { primitive: { olFeature: {} } },
      { primitive: { olFeature: { [handlerSymbol]: AxisAndPlanes.X } } },
    ];
    ensureHandlerSelection = new EnsureHandlerSelectionInteraction(
      currentFeatures,
    );
  });

  beforeEach(() => {
    drillPick = sinon.stub(map.getScene(), 'drillPick').returns(drillResults);
  });

  afterEach(() => {
    currentFeatures.length = 0;
    drillPick.restore();
  });

  after(() => {
    map.destroy();
  });

  it('should ensure a handler is selected, if a feature is selected and a feature is on the event', async () => {
    const event = {
      feature: new Feature(),
      map,
      windowPosition: new Cartesian2(0, 0),
    };
    currentFeatures.push(new Feature());
    await ensureHandlerSelection.pipe(event);
    expect(event.feature).to.equal(drillResults[2].primitive.olFeature);
  });

  it('should not drill pick the scene, if no feature is on the event', async () => {
    const event = {
      feature: undefined,
      map,
      windowPosition: new Cartesian2(0, 0),
    };
    await ensureHandlerSelection.pipe(event);
    expect(drillPick).to.not.have.been.called;
  });

  it('should not drill pick the scene, if no feature is selected', async () => {
    const event = {
      feature: new Feature(),
      map,
      windowPosition: new Cartesian2(0, 0),
    };
    await ensureHandlerSelection.pipe(event);
    expect(drillPick).to.not.have.been.called;
  });

  it('should not drill pick the scene, if the selected feature is a handler', async () => {
    const event = {
      feature: { [handlerSymbol]: AxisAndPlanes.X },
      map,
      windowPosition: new Cartesian2(0, 0),
    };
    await ensureHandlerSelection.pipe(event);
    expect(drillPick).to.not.have.been.called;
  });
});

import { Feature } from 'ol';
import { Cartesian2 } from '@vcmap/cesium';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import { AXIS_AND_PLANES, handlerSymbol, SelectMultiFeatureInteraction, VectorLayer } from '../../../../../index.js';
import EnsureHandlerSelectionInteraction
  from '../../../../../src/util/editor/interactions/ensureHandlerSelectionInteraction.js';

describe('EnsureHandlerSelectionInteraction', () => {
  let map;
  let layer;
  let drillResults;
  let featureSelection;
  let ensureHandlerSelection;
  let drillPick;

  before(() => {
    map = getCesiumMap();
    drillResults = [
      { primitive: {} },
      { primitive: { olFeature: {} } },
      { primitive: { olFeature: { [handlerSymbol]: AXIS_AND_PLANES.X } } },
    ];
    layer = new VectorLayer({});
    featureSelection = new SelectMultiFeatureInteraction(layer);
    ensureHandlerSelection = new EnsureHandlerSelectionInteraction(featureSelection);
  });

  beforeEach(() => {
    drillPick = sinon.stub(map.getScene(), 'drillPick').returns(drillResults);
  });

  afterEach(() => {
    featureSelection.clear();
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
    await featureSelection.setSelectionSet([new Feature()]);
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
      feature: { [handlerSymbol]: AXIS_AND_PLANES.X },
      map,
      windowPosition: new Cartesian2(0, 0),
    };
    await ensureHandlerSelection.pipe(event);
    expect(drillPick).to.not.have.been.called;
  });
});

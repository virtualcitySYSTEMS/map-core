import DragPan from 'ol/interaction/DragPan.js';
import { Feature } from 'ol';
import { EventType } from '../../../../../src/interaction/interactionType.js';
import MapInteractionController from '../../../../../src/util/editor/interactions/mapInteractionController.js';
import { OpenlayersMap, VcsApp, vertexSymbol } from '../../../../../index.js';
import { setCesiumMap } from '../../../helpers/cesiumHelpers.js';

describe('MapInteractionController', () => {
  let app;
  let div;
  let openlayersMap;
  let cesiumMap;
  let feature;
  let interaction;

  before(async () => {
    app = new VcsApp();
    div = document.createElement('div');
    app.maps.setTarget(div);
    openlayersMap = new OpenlayersMap({});
    app.maps.add(openlayersMap);
    await openlayersMap.initialize();
    cesiumMap = await setCesiumMap(app);
  });

  beforeEach(() => {
    feature = new Feature();
    feature.setId('test');
    interaction = new MapInteractionController();
  });

  afterEach(() => {
    interaction.destroy();
  });

  after(() => {
    app.destroy();
  });

  describe('#pipe', () => {
    let baseEvent;

    before(() => {
      baseEvent = { map: cesiumMap };
    });

    it('should set screenSpaceCameraController properly', async () => {
      const { screenSpaceCameraController } = cesiumMap.getScene();
      screenSpaceCameraController.lookEventTypes = 'look';
      screenSpaceCameraController.tiltEventTypes = 'tilt';
      screenSpaceCameraController.rotateEventTypes = 'rotate';
      await interaction.pipe({ ...baseEvent, feature });
      expect(screenSpaceCameraController).to.have.property('lookEventTypes', 'look');
      expect(screenSpaceCameraController).to.have.property('tiltEventTypes', 'tilt');
      expect(screenSpaceCameraController).to.have.property('rotateEventTypes', 'rotate');
      const vertex = new Feature();
      vertex[vertexSymbol] = true;
      await interaction.pipe({ ...baseEvent, feature: vertex });
      expect(screenSpaceCameraController).to.have.property('lookEventTypes').and.to.be.undefined;
      expect(screenSpaceCameraController).to.have.property('tiltEventTypes').and.to.be.undefined;
      expect(screenSpaceCameraController).to.have.property('rotateEventTypes').and.to.be.undefined;
      await interaction.pipe({ ...baseEvent });
      expect(screenSpaceCameraController).to.have.property('lookEventTypes', 'look');
      expect(screenSpaceCameraController).to.have.property('tiltEventTypes', 'tilt');
      expect(screenSpaceCameraController).to.have.property('rotateEventTypes', 'rotate');
    });

    describe('dragPanInteraction', () => {
      let dragPanInteraction;
      let event;

      beforeEach(() => {
        dragPanInteraction = openlayersMap.olMap.getInteractions().getArray().find(i => i instanceof DragPan);
        event = { type: EventType.MOVE, feature, map: openlayersMap };
      });

      it('should set the interaction to active by default', async () => {
        await interaction.pipe({ ...event });
        expect(dragPanInteraction.getActive()).to.be.true;
      });

      it('should set the interaction to inactive, if the feature is a vertex', async () => {
        const vertex = new Feature();
        vertex[vertexSymbol] = true;
        await interaction.pipe({ ...event, feature: vertex });
        expect(dragPanInteraction.getActive()).to.be.false;
      });
    });
  });
});

import nock from 'nock';
import { EventType } from '../../../../src/vcs/vcm/interaction/interactionType.js';
import CoordinateAtPixel from '../../../../src/vcs/vcm/interaction/coordinateAtPixel.js';
import { getObliqueMap, setObliqueMap } from '../../helpers/obliqueHelpers.js';
import VcsApp from '../../../../src/vcs/vcm/vcsApp.js';

describe('vcs.vcm.interaction.CoordinateAtPixel', () => {
  let app;

  before(() => {
    app = new VcsApp();
  });

  after(() => {
    app.destroy();
    nock.cleanAll();
  });

  describe('~obliqueHandler', () => {
    it('should transform image coordinates to wgs84, and project to mercator', async () => {
      const map = await setObliqueMap(app);
      const position = [1, 1, 1];
      const event = await CoordinateAtPixel.obliqueHandler({ map, position, type: EventType.CLICK });
      expect(event)
        .to.have.property('position')
        .and.to.have.members([1488844.5237925982, 6891361.880123189, 0]);
      expect(event)
        .to.have.property('obliqueParameters')
        .and.to.have.property('pixel')
        .and.to.have.members([1, 1]);
    });

    it('should stop propagation if no currentImage exists', async () => {
      const map = await getObliqueMap();
      const position = [1, 1, 1];
      const event = await CoordinateAtPixel.obliqueHandler({ map, position, type: EventType.CLICK });
      expect(event)
        .to.have.property('stopPropagation')
        .and.to.be.true;
      map.destroy();
    });
  });

  describe('with terrainProvider', () => {
    let scope;
    let map;

    before(async () => {
      scope = nock('http://localhost');
      map = await setObliqueMap(app, scope);
    });

    it('should use exact coordinate transformation on CLICK', async () => {
      const position = [1, 1, 1];
      const event = await CoordinateAtPixel.obliqueHandler({ map, position, type: EventType.CLICK });
      expect(event)
        .to.have.property('obliqueParameters')
        .and.to.have.property('estimate')
        .and.to.be.false;
    });

    it('should use estimated coordinate transformation on MOVE', async () => {
      const position = [1, 1, 1];
      const event = await CoordinateAtPixel.obliqueHandler({ map, position, type: EventType.MOVE });
      expect(event)
        .to.have.property('obliqueParameters')
        .and.to.have.property('estimate')
        .and.to.be.true;
    });
  });
});

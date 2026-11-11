import nock from 'nock';
import { Cartesian2, Cartesian3, Matrix4, Ray } from '@vcmap-cesium/engine';
import { EventType } from '../../../src/interaction/interactionType.js';
import CoordinateAtPixel from '../../../src/interaction/coordinateAtPixel.js';
import { getObliqueMap, setObliqueMap } from '../helpers/obliqueHelpers.js';
import VcsApp from '../../../src/vcsApp.js';
import { getPanoramaMap } from '../helpers/panoramaHelpers.js';
import { cartesianToMercator } from '../../../src/util/math.js';

describe('CoordinateAtPixel', () => {
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
      const event = await CoordinateAtPixel.obliqueHandler({
        map,
        position,
        type: EventType.CLICK,
      });
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
      const event = await CoordinateAtPixel.obliqueHandler({
        map,
        position,
        type: EventType.CLICK,
      });
      expect(event).to.have.property('stopPropagation').and.to.be.true;
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
      const event = await CoordinateAtPixel.obliqueHandler({
        map,
        position,
        type: EventType.CLICK,
      });
      expect(event)
        .to.have.property('obliqueParameters')
        .and.to.have.property('estimate').and.to.be.false;
    });

    it('should use estimated coordinate transformation on MOVE', async () => {
      const position = [1, 1, 1];
      const event = await CoordinateAtPixel.obliqueHandler({
        map,
        position,
        type: EventType.MOVE,
      });
      expect(event)
        .to.have.property('obliqueParameters')
        .and.to.have.property('estimate').and.to.be.true;
    });
  });

  describe('in a panorama map', () => {
    let map;
    let depthPosition;
    let imagePosition;
    let getPositionAtUv;
    let getPositionAtImageCoordinate;
    let interaction;

    function setImage(version) {
      sinon.stub(map, 'currentPanoramaImage').get(() => ({
        version,
        invModelMatrix: Matrix4.IDENTITY,
        getPositionAtImageCoordinate,
      }));
    }

    function getEvent() {
      return {
        map,
        windowPosition: new Cartesian2(1, 1),
        type: EventType.MOVE,
      };
    }

    beforeEach(() => {
      map = getPanoramaMap();
      depthPosition = Cartesian3.fromDegrees(1, 1, 1);
      imagePosition = Cartesian3.fromDegrees(2, 2, 2);
      getPositionAtUv = sinon.stub().returns(depthPosition);
      getPositionAtImageCoordinate = sinon.stub().resolves(imagePosition);
      sinon.stub(map, 'depthPass').get(() => ({ getPositionAtUv }));
      sinon
        .stub(map.getCesiumWidget().camera, 'getPickRay')
        .returns(new Ray(Cartesian3.ZERO, Cartesian3.UNIT_X));
      interaction = new CoordinateAtPixel();
    });

    afterEach(() => {
      interaction.destroy();
      map.destroy();
      sinon.restore();
    });

    it('should only use the depth image for version 1 images', async () => {
      setImage('1.0');
      const event = await interaction.pipe(getEvent());
      expect(getPositionAtUv).to.not.have.been.called;
      expect(event.position).to.eql(cartesianToMercator(imagePosition));
    });

    it('should only use the depth pass for version 2 images', async () => {
      setImage('2.0');
      const event = await interaction.pipe(getEvent());
      expect(getPositionAtImageCoordinate).to.not.have.been.called;
      expect(getPositionAtUv).to.have.been.calledOnce;
      expect(event.position).to.eql(cartesianToMercator(depthPosition));
    });

    it('should not fall back to the depth image, if the depth pass has no position', async () => {
      setImage('2.0');
      getPositionAtUv.returns(undefined);
      const event = await interaction.pipe(getEvent());
      expect(getPositionAtImageCoordinate).to.not.have.been.called;
      expect(event.position).to.be.undefined;
    });
  });
});

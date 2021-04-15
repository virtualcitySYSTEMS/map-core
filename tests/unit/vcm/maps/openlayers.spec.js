import ViewPoint from '../../../../src/vcs/vcm/util/viewpoint.js';
import Openlayers from '../../../../src/vcs/vcm/maps/openlayers.js';
import Projection from '../../../../src/vcs/vcm/util/projection.js';

describe('vcs.vcm.maps.Openlayers', () => {
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  after(() => {
    sandbox.restore();
  });

  describe('getting the current viewpoint', () => {
    let inputViewpoint;
    let outputViewpoint;
    let map;

    before(async () => {
      inputViewpoint = new ViewPoint({
        groundPosition: [0, 0, 0],
        cameraPosition: [0, 0, 100],
        distance: 100,
        animate: false,
        heading: 45,
      });

      map = new Openlayers({ fixedNorthOrientation: false });
      await map.initialize();
      const viewport = map.olMap.getViewport();
      sandbox.stub(viewport, 'offsetHeight').get(() => 100);
      sandbox.stub(viewport, 'offsetWidth').get(() => 100);
      await map.gotoViewPoint(inputViewpoint);
      outputViewpoint = map.getViewPointSync();
    });

    after(() => {
      map.destroy();
    });

    it('should get the current viewpoints ground position in 2D', () => {
      const { groundPosition } = outputViewpoint;
      expect(groundPosition).to.have.lengthOf(2);
      expect(groundPosition[0]).to.be.closeTo(0, 0.0001);
      expect(groundPosition[1]).to.be.closeTo(0, 0.0001);
    });

    it('should determine the distance of the current viewpoint', () => {
      expect(outputViewpoint.distance).to.be.closeTo(100, 0.0001);
    });

    it('should have a pitch of -90', () => {
      expect(outputViewpoint.pitch).to.equal(-90);
    });

    it('should determine the rotation from the view', () => {
      expect(outputViewpoint.heading).to.equal(inputViewpoint.heading);
    });
  });

  describe('setting a viewpoint', () => {
    describe('with a fixed north oriented map', () => {
      let map;
      before(async () => {
        map = new Openlayers({});
        await map.initialize();
      });

      after(() => {
        map.destroy();
      });

      describe('with a regular viewpoint', () => {
        before(async () => {
          await map.gotoViewPoint(new ViewPoint({
            groundPosition: [0, 0, 0],
            cameraPosition: [0, 0, 100],
            distance: 100,
            animate: false,
            heading: 45,
          }));
        });

        it('should set the view center to the groundPosition', () => {
          const center = map.olMap.getView().getCenter();
          const mercatorGroundPosition = Projection.wgs84ToMercator([0, 0, 0]);
          expect(center[0]).to.be.closeTo(mercatorGroundPosition[0], 0.000001);
          expect(center[1]).to.be.closeTo(mercatorGroundPosition[1], 0.000001);
        });

        it('should set the rotation to be 0', () => {
          expect(map.olMap.getView().getRotation()).to.equal(0);
        });

        it('should set the resolution based on the distance', () => {
          expect(map.olMap.getView().getResolution()).to.be.closeTo(115.47, 0.0001);
        });
      });

      describe('without a groundPosition', () => {
        it('should set the cameraPosition as the views center', async () => {
          await map.gotoViewPoint(new ViewPoint({
            cameraPosition: [1, 1, 100],
            distance: 100,
            animate: false,
            heading: 45,
          }));
          const center = map.olMap.getView().getCenter();
          const mercatorGroundPosition = Projection.wgs84ToMercator([1, 1, 100]);
          expect(center[0]).to.be.closeTo(mercatorGroundPosition[0], 0.000001);
          expect(center[1]).to.be.closeTo(mercatorGroundPosition[1], 0.000001);
        });
      });

      describe('which is animated', () => {
        it('should animate for the given duration before setting the vp', async () => {
          const promise = map.gotoViewPoint(new ViewPoint({
            groundPosition: [0, 0, 0],
            cameraPosition: [1, 1, 100],
            distance: 100,
            animate: true,
            duration: 0.01,
            heading: 45,
          }));
          expect(map.olMap.getView().getAnimating()).to.be.true;
          await promise;
          expect(map.olMap.getView().getAnimating()).to.be.false;
          const center = map.olMap.getView().getCenter();
          const mercatorGroundPosition = Projection.wgs84ToMercator([0, 0, 0]);
          expect(center[0]).to.be.closeTo(mercatorGroundPosition[0], 0.000001);
          expect(center[1]).to.be.closeTo(mercatorGroundPosition[1], 0.000001);
        });
      });
    });

    describe('with a non fixed north oriented map', () => {
      it('should rotate the map counter clockwise, based on the heading', async () => {
        const map = new Openlayers({ fixedNorthOrientation: false });
        await map.initialize();
        await map.gotoViewPoint(new ViewPoint({
          groundPosition: [0, 0, 0],
          cameraPosition: [0, 0, 100],
          distance: 100,
          animate: false,
          heading: 45,
        }));
        expect(map.olMap.getView().getRotation()).to.equal(-Math.PI / 4);
        map.destroy();
      });
    });
  });

  describe('determining the visibility of a WGS84 coordinate', () => {
    let map;

    before(async () => {
      map = new Openlayers({ fixedNorthOrientation: false });
      await map.initialize();
      map.olMap.setSize([100, 100]);
      await map.gotoViewPoint(new ViewPoint({
        groundPosition: [0, 0, 0],
        cameraPosition: [0, 0, 100],
        distance: 100,
        animate: false,
      }));
    });

    after(() => {
      map.destroy();
    });

    it('should return true for a coordinate within the current views bounds', () => {
      expect(map.pointIsVisible([0, 0])).to.be.true;
    });

    it('should return false for a coordinate outside the current views bounds', () => {
      expect(map.pointIsVisible([10, 10])).to.be.false;
    });
  });
});

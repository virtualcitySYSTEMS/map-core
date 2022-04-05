import Layer from 'ol/layer/Layer.js';
import { ImagerySplitDirection } from '@vcmap/cesium';
import AbstractRasterLayerOL from '../../../../src/layer/openlayers/rasterLayerOpenlayersImpl.js';
import VcsApp from '../../../../src/vcsApp.js';
import RasterLayer from '../../../../src/layer/rasterLayer.js';
import { setOpenlayersMap } from '../../helpers/openlayersHelpers.js';


describe('RasterLayerOpenlayersImpl', () => {
  let sandbox;
  let app;
  /** @type {import("@vcmap/core").RasterLayer} */
  let commonLayer;
  /** @type {import("@vcmap/core").RasterLayerOpenlayersImpl} */
  let ARL;
  let openlayers;
  let olLayer;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    commonLayer = new RasterLayer({});
    openlayers = await setOpenlayersMap(app);
  });

  beforeEach(() => {
    ARL = new AbstractRasterLayerOL(openlayers, commonLayer.getImplementationOptions());
    olLayer = new Layer({});
    ARL.getOLLayer = () => olLayer;
  });

  afterEach(() => {
    ARL.destroy();
    olLayer.dispose();
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  describe('initialize', () => {
    it('should call update split direction', async () => {
      const updateSplitDirection = sandbox.spy(ARL, 'updateSplitDirection');
      await ARL.initialize();
      expect(updateSplitDirection).to.have.been.called;
    });
  });

  describe('updateSplitDirection', () => {
    beforeEach(async () => {
      await ARL.initialize();
    });

    it('should clear the splitDirection listeners, if the splitDirection is none', () => {
      ARL.updateSplitDirection(ImagerySplitDirection.LEFT);
      ARL.updateSplitDirection(ImagerySplitDirection.NONE);
      expect(olLayer.hasListener('prerender')).to.be.false;
      expect(olLayer.hasListener('postrender')).to.be.false;
    });

    it('should add a pre and postrender listener', () => {
      ARL.updateSplitDirection(ImagerySplitDirection.LEFT);
      expect(olLayer.hasListener('prerender')).to.be.true;
      expect(olLayer.hasListener('postrender')).to.be.true;
    });

    it('should add a context restoring postrender event handler', () => {
      const on = sandbox.spy(olLayer, 'on');
      ARL.updateSplitDirection(ImagerySplitDirection.LEFT);
      const handler = on.getCall(1).args[1];
      const restore = sandbox.spy();
      handler({ context: { restore } });
      expect(restore).to.have.been.called;
    });
  });

  describe('_splitPreCompose', () => {
    let context;

    beforeEach(() => {
      const canvas = createCanvas(200, 200);
      context = canvas.getContext('2d');
    });

    it('should save the context, begin a path and clip', () => {
      const save = sandbox.spy(context, 'save');
      const beginPath = sandbox.spy(context, 'beginPath');
      const clip = sandbox.spy(context, 'clip');
      ARL._splitPreCompose({ context });
      expect(save).to.have.been.called;
      expect(beginPath).to.have.been.calledAfter(save);
      expect(clip).to.have.been.calledAfter(beginPath);
    });

    it('should draw a rectangle on the left screen, if splitDirection is LEFT', () => {
      ARL.splitDirection = ImagerySplitDirection.LEFT;
      const rect = sandbox.spy(context, 'rect');
      ARL._splitPreCompose({ context });
      expect(rect).to.have.been.calledWith(0, 0, 100, 200);
    });

    it('should draw a rectangle on the right screen, if splitDirection is RIGHT', () => {
      ARL.splitDirection = ImagerySplitDirection.RIGHT;
      const rect = sandbox.spy(context, 'rect');
      ARL._splitPreCompose({ context });
      expect(rect).to.have.been.calledWith(100, 0, 100, 200);
    });
  });
});

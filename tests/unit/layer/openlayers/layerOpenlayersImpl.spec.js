import Layer from 'ol/layer/Layer.js';
import { SplitDirection } from '@vcmap/cesium';
import LayerOpenlayersImpl from '../../../../src/layer/openlayers/layerOpenlayersImpl.js';
import VcsApp from '../../../../src/vcsApp.js';
import { setOpenlayersMap } from '../../helpers/openlayersHelpers.js';


describe('LayerOpenlayersImpl', () => {
  let sandbox;
  let app;
  /** @type {import("@vcmap/core").LayerOpenlayersImpl} */
  let impl;
  let olMap;
  let olLayer;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    olMap = await setOpenlayersMap(app);
  });

  beforeEach(() => {
    impl = new LayerOpenlayersImpl(olMap, { splitDirection: SplitDirection.NONE });
    olLayer = new Layer({});
    impl.getOLLayer = () => olLayer;
  });

  afterEach(() => {
    impl.destroy();
    olLayer.dispose();
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  describe('initialize', () => {
    it('should call update split direction', async () => {
      const updateSplitDirection = sandbox.spy(impl, 'updateSplitDirection');
      await impl.initialize();
      expect(updateSplitDirection).to.have.been.called;
    });
  });

  describe('updateSplitDirection', () => {
    beforeEach(async () => {
      await impl.initialize();
    });

    it('should clear the splitDirection listeners, if the splitDirection is none', () => {
      impl.updateSplitDirection(SplitDirection.LEFT);
      impl.updateSplitDirection(SplitDirection.NONE);
      expect(olLayer.hasListener('prerender')).to.be.false;
      expect(olLayer.hasListener('postrender')).to.be.false;
    });

    it('should add a pre and postrender listener', () => {
      impl.updateSplitDirection(SplitDirection.LEFT);
      expect(olLayer.hasListener('prerender')).to.be.true;
      expect(olLayer.hasListener('postrender')).to.be.true;
    });

    it('should add a context restoring postrender event handler', async () => {
      const on = sandbox.spy(olLayer, 'on');
      impl.updateSplitDirection(SplitDirection.LEFT);
      const handler = on.getCall(1).args[1];
      const restore = sandbox.spy();
      handler({ context: { restore } });
      expect(restore).to.have.been.called;
    });
  });

  describe('_splitPreRender', () => {
    let context;

    beforeEach(() => {
      const canvas = createCanvas(200, 200);
      context = canvas.getContext('2d');
    });

    it('should save the context, begin a path and clip', () => {
      const save = sandbox.spy(context, 'save');
      const beginPath = sandbox.spy(context, 'beginPath');
      const clip = sandbox.spy(context, 'clip');
      impl._splitPreRender({ context });
      expect(save).to.have.been.called;
      expect(beginPath).to.have.been.calledAfter(save);
      expect(clip).to.have.been.calledAfter(beginPath);
    });

    it('should draw a rectangle on the left screen, if splitDirection is LEFT', () => {
      impl.splitDirection = SplitDirection.LEFT;
      const rect = sandbox.spy(context, 'rect');
      impl._splitPreRender({ context });
      expect(rect).to.have.been.calledWith(0, 0, 100, 200);
    });

    it('should draw a rectangle on the right screen, if splitDirection is RIGHT', () => {
      impl.splitDirection = SplitDirection.RIGHT;
      const rect = sandbox.spy(context, 'rect');
      impl._splitPreRender({ context });
      expect(rect).to.have.been.calledWith(100, 0, 100, 200);
    });
  });
});

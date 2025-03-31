import { expect } from 'chai';
import { Entity, SplitDirection } from '@vcmap-cesium/engine';
import sinon from 'sinon';
import type { LayerOptions } from '../../../src/layer/layer.js';
import Layer from '../../../src/layer/layer.js';
import LayerCollection from '../../../src/util/layerCollection.js';
import { getVcsEventSpy } from '../helpers/cesiumHelpers.js';
import OpenStreetMapLayer from '../../../src/layer/openStreetMapLayer.js';
import { setOpenlayersMap } from '../helpers/openlayersHelpers.js';
import VcsApp from '../../../src/vcsApp.js';
import { getLayerIndex } from '../../../src/vcsModuleHelpers.js';
import type { OverrideCollection } from '../../../src/util/overrideCollection.js';
import makeOverrideCollection from '../../../src/util/overrideCollection.js';
import GlobalHider from '../../../src/layer/globalHider.js';

function getLocalZIndex(layerCollection: LayerCollection, l?: Layer): number {
  if (l) {
    // @ts-expect-error: z index is undefined
    return l[layerCollection.zIndexSymbol] as number;
  }
  return 0;
}

describe('LayerCollection', () => {
  let layer1: Layer;
  let layer2: Layer;
  let layer3: Layer;
  let layer4: Layer;
  let sandbox: sinon.SinonSandbox;

  before(() => {
    layer1 = new Layer({
      name: 'layer1',
    });
    layer2 = new Layer({
      name: 'layer2',
      zIndex: 5,
    });
    layer3 = new Layer({
      name: 'layer3',
      zIndex: 2,
    });
    layer4 = new Layer({
      name: 'layer4',
    });
    sandbox = sinon.createSandbox();
    sandbox.stub(Layer.prototype, 'isSupported').returns(true);
    sandbox.stub(Layer.prototype, 'initialize').resolves();
  });

  after(() => {
    layer1.destroy();
    layer2.destroy();
    layer3.destroy();
    layer4.destroy();
    sandbox.restore();
  });

  describe('creating from an existing array', () => {
    it('should add each layer, sorting by zIndex', () => {
      const layerCollection = LayerCollection.from([
        layer1,
        layer2,
        layer3,
        layer4,
      ]);
      const asArray = [...layerCollection];
      expect(asArray).to.have.ordered.members([layer1, layer4, layer3, layer2]);
      layerCollection.destroy();
    });
  });

  describe('setting globalHider', () => {
    it('should update the globalHider on all layers of the collection', () => {
      const layerCollection = LayerCollection.from([layer1]);
      const newGlobalHider = new GlobalHider();
      const entity = new Entity();
      newGlobalHider.addFeature('test', entity);
      layerCollection.globalHider = newGlobalHider;
      expect(layer1.globalHider!.hasFeature('test', entity)).to.be.true;
    });
  });

  describe('adding layers', () => {
    let layerCollection: LayerCollection;
    let layer5: Layer;
    let layer6: Layer;

    before(() => {
      layer5 = new Layer({
        name: 'layer5',
      });

      layer6 = new Layer({
        name: 'layer6',
        zIndex: 5,
      });
    });

    beforeEach(() => {
      layerCollection = new LayerCollection();
    });

    afterEach(() => {
      layerCollection.destroy();
    });

    after(() => {
      layer5.destroy();
      layer6.destroy();
    });

    it('should add a layer', () => {
      layerCollection.add(layer1);
      expect(layerCollection.hasKey(layer1.name)).to.be.true;
    });

    it('should raise the added event', () => {
      const spy = sandbox.spy();
      const listener = layerCollection.added.addEventListener(
        (layer: Layer) => {
          expect(layer).to.equal(layer2);
          spy();
          listener();
        },
      );
      layerCollection.add(layer2);
      expect(spy).to.have.been.calledOnce;
    });

    it('should place the layer at the correct location, based on zIndex', () => {
      layerCollection.add(layer1);
      layerCollection.add(layer2);
      layerCollection.add(layer3);
      layerCollection.add(layer4);
      layerCollection.add(layer5);
      const asArray = [...layerCollection];
      expect(asArray).to.have.ordered.members([
        layer1,
        layer4,
        layer5,
        layer3,
        layer2,
      ]);
    });

    it('should add a state change listener and emit state changed', async () => {
      layerCollection.add(layer1);
      const spy = sandbox.spy();
      const listener = layerCollection.stateChanged.addEventListener(
        (layer: Layer) => {
          expect(layer).to.equal(layer1);
          spy();
        },
      );
      await layer1.activate();
      expect(spy).to.have.been.calledTwice;
      layer1.deactivate();
      listener();
    });

    it('should add a zIndex changed listener and move the layer accordingly', () => {
      layerCollection.add(layer1);
      layerCollection.add(layer2);
      layerCollection.add(layer3);
      layerCollection.add(layer4);
      layerCollection.add(layer5);
      const spy = getVcsEventSpy(layerCollection.moved, sandbox);
      layer5.zIndex = 5;
      expect(spy).to.have.been.calledOnceWithExactly(layer5);
      expect(layerCollection.indexOf(layer5)).to.equal(4);
    });

    it('should add a layer at a given index, ensuring, it gets an appropriate local zIndex', () => {
      layerCollection.add(layer1);
      layerCollection.add(layer2);
      layerCollection.add(layer3);
      layerCollection.add(layer4);
      layerCollection.add(layer5);
      layerCollection.add(layer6, 1);
      expect(layerCollection.indexOf(layer6)).to.equal(1);
      layer5.zIndex = 1;
      expect(layerCollection.indexOf(layer5)).to.equal(3); // if layer6 did have zIndex of 5, zIndex 1 would have index 1 and not 3
    });

    it('should set globalHider on added layer', () => {
      layerCollection.add(layer1);
      expect(layer1.globalHider).to.be.equal(layerCollection.globalHider);
    });
  });

  describe('removing layers', () => {
    let layerCollection: LayerCollection;

    beforeEach(() => {
      layerCollection = LayerCollection.from([layer1, layer2, layer3, layer4]);
      layerCollection.remove(layer1);
    });

    afterEach(() => {
      layerCollection.destroy();
    });

    it('should no longer contain the layer', () => {
      expect(layerCollection.has(layer1)).to.be.false;
    });

    it('should no longer listen to state changes', async () => {
      const spy = sandbox.spy();
      const listener = layerCollection.stateChanged.addEventListener(spy);
      await layer1.activate();
      layer1.deactivate();
      expect(spy).to.not.have.been.called;
      listener();
    });

    it('should remove the local zIndex of a layer, ensuring the zIndex is reevaluated on adding the layer again', () => {
      layerCollection.lower(layer2, 3);
      expect(layerCollection.indexOf(layer2)).to.equal(0);
      layerCollection.remove(layer2);
      layerCollection.add(layer2);
      expect(layerCollection.indexOf(layer2)).to.equal(2);
    });

    it('should unset globalHider on removed layer', () => {
      expect(layer1.globalHider).to.be.undefined;
    });
  });

  describe('handling of exclusive layers', () => {
    let app: VcsApp;
    let layerCollection: LayerCollection;
    let layer5: OpenStreetMapLayer;
    let layer6: OpenStreetMapLayer;

    before(async () => {
      app = new VcsApp();
      await setOpenlayersMap(app);
      layer5 = new OpenStreetMapLayer({
        name: 'layer5',
        exclusiveGroups: ['test'],
      });

      layer6 = new OpenStreetMapLayer({
        name: 'layer6',
        zIndex: 5,
        exclusiveGroups: ['test'],
      });
    });

    beforeEach(() => {
      layerCollection = LayerCollection.from([layer1, layer5, layer6]);
    });

    afterEach(() => {
      layerCollection.destroy();
    });

    after(() => {
      layer5.destroy();
      layer6.destroy();
      app.destroy();
    });

    it('should handle exclusivity', async () => {
      await layer5.activate();
      await layer6.activate();
      expect(layer5.active).to.be.false;
    });

    it('should handle changes to exclusivity', async () => {
      await layer5.activate();
      const layer = new Layer({});
      layerCollection.add(layer);
      await layer.activate();
      layer.exclusiveGroups = ['test'];
      expect(layer5.active).to.be.false;
      layer.exclusiveGroups = [];
      await layer5.activate();
      expect(layer.active).to.be.true;
      layer.destroy();
    });

    it('should handle changes to split direction', async () => {
      layer5.splitDirection = SplitDirection.LEFT;
      layer6.splitDirection = SplitDirection.RIGHT;
      await layer5.activate();
      await layer6.activate();
      expect(layer5.active).to.be.true;
      expect(layer6.active).to.be.true;
      layer6.splitDirection = SplitDirection.NONE;
      expect(layer5.active).to.be.false;
    });

    it('should no longer manage exclusivity if a layer is removed', async () => {
      layerCollection.remove(layer6);
      await layer5.activate();
      await layer6.activate();
      expect(layer5.active).to.be.true;
      expect(layer6.active).to.be.true;
    });
  });

  describe('changing render order by moving items', () => {
    let layerCollection: LayerCollection;

    beforeEach(() => {
      layerCollection = LayerCollection.from([layer1, layer2, layer3, layer4]);
    });

    afterEach(() => {
      layerCollection.destroy();
    });

    it('should update the local zIndex according to new order moving forward', () => {
      layerCollection.moveTo(layer1, 2);

      expect([...layerCollection].indexOf(layer1)).to.equal(2);
      expect(getLocalZIndex(layerCollection, layer1)).to.be.greaterThanOrEqual(
        getLocalZIndex(layerCollection, [...layerCollection].at(-2)),
      );
    });

    it('should update the local zIndex when moving backward', () => {
      layerCollection.moveTo(layer2, 1);

      expect([...layerCollection].indexOf(layer2)).to.equal(1);
      expect(getLocalZIndex(layerCollection, layer2)).to.be.greaterThanOrEqual(
        getLocalZIndex(layerCollection, [...layerCollection].at(0)),
      );
    });

    it('should update the local zIndex when moving to the front', () => {
      layerCollection.moveTo(layer2, 0);

      expect([...layerCollection].indexOf(layer2)).to.equal(0);
      expect(getLocalZIndex(layerCollection, layer2)).to.be.lessThanOrEqual(
        getLocalZIndex(layerCollection, [...layerCollection].at(1)),
      );
    });

    it('should update the local zIndex when moving to the back', () => {
      layerCollection.moveTo(layer4, 3);

      expect([...layerCollection].indexOf(layer4)).to.equal(3);
      expect(getLocalZIndex(layerCollection, layer4)).to.be.greaterThanOrEqual(
        getLocalZIndex(layerCollection, [...layerCollection].at(-2)),
      );
    });
  });

  describe('handling changes to zIndex', () => {
    let layerCollection: LayerCollection;
    let layer5: Layer;
    let layer6: Layer;

    beforeEach(() => {
      layer5 = new Layer({
        name: 'layer5',
      });

      layer6 = new Layer({
        name: 'layer6',
        zIndex: 5,
      });

      layerCollection = LayerCollection.from([
        layer1,
        layer2,
        layer3,
        layer4,
        layer5,
        layer6,
      ]);
    });

    afterEach(() => {
      layerCollection.destroy();
      layer5.destroy();
      layer6.destroy();
    });

    it('should move the zIndex to the end of its block if increasing', () => {
      layer5.zIndex = 2;
      expect(layerCollection.indexOf(layer5)).to.equal(3);
    });

    it('should set the layer at the end, if there is no higher zIndex', () => {
      layer5.zIndex = 10;
      expect(layerCollection.indexOf(layer5)).to.equal(
        layerCollection.size - 1,
      );
    });

    it('should move a layer at the end of its block if decreasing', () => {
      layer6.zIndex = 2;
      expect(layerCollection.indexOf(layer6)).to.equal(4);
    });

    it('should move a layer to the beginning if it has the smallest zIndex', () => {
      layer5.zIndex = -1;
      expect(layerCollection.indexOf(layer5)).to.equal(0);
    });

    it('should maintain the position, if the zIndex changes but the position does not', () => {
      const indexOfLayer3 = layerCollection.indexOf(layer3);
      layer3.zIndex = 3;
      expect(layerCollection.indexOf(layer3)).to.equal(indexOfLayer3);
      layer3.zIndex = 1;
      expect(layerCollection.indexOf(layer3)).to.equal(indexOfLayer3);
    });
  });

  describe('overrideLayerCollection', () => {
    let layerCollection: OverrideCollection<Layer, LayerCollection>;
    let originalLayer: Layer;
    let overrideLayer: Layer;

    beforeEach(() => {
      originalLayer = new Layer({
        name: 'layer',
        exclusiveGroups: ['test'],
      });

      overrideLayer = new Layer({
        name: 'layer',
        exclusiveGroups: ['test'],
      });

      layerCollection = makeOverrideCollection<Layer, LayerCollection>(
        LayerCollection.from([originalLayer]),
        () => {
          return 'uuid';
        },
        (l: Layer) => l.toJSON(),
        (o: LayerOptions) => new Layer(o),
        Layer,
        getLayerIndex,
      );
    });

    afterEach(() => {
      layerCollection.destroy();
      originalLayer.destroy();
      overrideLayer.destroy();
    });

    describe('on override', () => {
      it('should remove originalLayer from the ExclusiveManager', () => {
        layerCollection.override(overrideLayer);
        expect(
          layerCollection.exclusiveManager.layers
            .get('test')!
            .has(originalLayer),
        ).to.be.false;
      });
    });
  });

  describe('locale handling', () => {
    let layerCollection: LayerCollection;

    beforeEach(() => {
      layerCollection = new LayerCollection();
      layerCollection.locale = 'fr';
    });

    afterEach(() => {
      layerCollection.destroy();
    });

    it('should set the collection locale to the layer on add', () => {
      layerCollection.add(layer1);
      expect(layer1.locale).to.be.equal('fr');
    });

    it('should synchronize the layerCollection locale on the layers', () => {
      layerCollection.add(layer1);
      expect(layer1.locale).to.be.equal('fr');
      layerCollection.locale = 'de';
      expect(layer1.locale).to.be.equal('de');
    });
  });
});

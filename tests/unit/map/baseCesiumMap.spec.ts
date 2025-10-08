import {
  Cartesian3,
  Math as CesiumMath,
  PrimitiveCollection,
} from '@vcmap-cesium/engine';
import { expect } from 'chai';
import sinon from 'sinon';
import { getBaseCesiumMap, getCesiumMap } from '../helpers/cesiumHelpers.js';
import Projection from '../../../src/util/projection.js';
import type BaseCesiumMap from '../../../src/map/baseCesiumMap.js';
import { getResolution } from '../../../src/map/baseCesiumMap.js';
import { mercatorToCartesian } from '../../../src/util/math.js';
import Viewpoint from '../../../src/util/viewpoint.js';
import type { CesiumMap } from '../../../index.js';
import { vcsLayerName } from '../../../index.js';
import { arrayCloseTo } from '../helpers/helpers.js';
import Layer from '../../../src/layer/layer.js';
import LayerCollection from '../../../src/util/layerCollection.js';

describe('BaseCesiumMap', () => {
  describe('activating a cesium map', () => {
    let map: BaseCesiumMap;

    beforeEach(() => {
      map = getBaseCesiumMap();
    });

    afterEach(() => {
      map.destroy();
    });

    it('should set the cesium widgets use of the default rendering loop to true', async () => {
      await map.activate();
      expect(map.getCesiumWidget()).to.have.property(
        'useDefaultRenderLoop',
        true,
      );
    });

    it('should force a resize of the cesium widget', async () => {
      const resize = sinon.spy(map.getCesiumWidget()!, 'resize');
      await map.activate();
      expect(resize).to.have.been.called;
    });
  });

  describe('deactivating a cesium map', () => {
    let map: CesiumMap;

    beforeEach(async () => {
      map = getCesiumMap();
      await map.activate();
    });

    afterEach(() => {
      map.destroy();
    });

    it('should set the cesium widgets use of the default rendering loop to false', () => {
      map.deactivate();
      expect(map.getCesiumWidget()).to.have.property(
        'useDefaultRenderLoop',
        false,
      );
    });
  });

  describe('getting current resolution', () => {
    let map: CesiumMap;

    before(() => {
      map = getCesiumMap();
    });

    after(() => {
      map.destroy();
    });

    it('should return the resolution (snapshot test)', async () => {
      await map.gotoViewpoint(
        new Viewpoint({
          groundPosition: [0, 0, 0],
          cameraPosition: [0, 0, 100],
          distance: 100,
          pitch: -90,
          animate: false,
        }),
      );

      sinon.stub(map.mapElement, 'offsetHeight').get(() => 100);
      sinon.stub(map.mapElement, 'offsetWidth').get(() => 100);

      const resolution = getResolution(
        mercatorToCartesian(Projection.wgs84ToMercator([0, 0, 0])),
        map.getScene()!.camera,
        map.mapElement,
        0,
      );
      expect(resolution).to.be.closeTo(1.15470053, CesiumMath.EPSILON8);
    });
  });

  describe('getting the current viewpoint', () => {
    let map: CesiumMap;
    let inputViewpoint: Viewpoint;
    let outputViewpoint: Viewpoint;

    before(async () => {
      map = getCesiumMap();

      inputViewpoint = new Viewpoint({
        groundPosition: [0, 0, 10],
        cameraPosition: [1, 1, 100],
        distance: 100,
        animate: false,
        heading: 45,
        pitch: -45,
      });

      await map.gotoViewpoint(inputViewpoint);
      sinon
        .stub(map.getScene()!.globe, 'pick')
        .returns(Cartesian3.fromDegrees(0, 0, 10)); // there are not globe tiles rendered
      map.setTarget(document.createElement('div'));
      outputViewpoint = map.getViewpointSync()!;
    });

    after(() => {
      map.destroy();
    });

    it('should get the current viewpoints ground position in 3D', () => {
      expect(outputViewpoint.groundPosition).to.have.ordered.members([
        0, 0, 10,
      ]);
    });

    it('should get the current camera position in 3D', () => {
      const { cameraPosition } = outputViewpoint;
      expect(cameraPosition).to.have.lengthOf(3);
      arrayCloseTo(cameraPosition!, [1, 1, 100], 0.0001);
    });

    it('should determine the distance of the current viewpoint', () => {
      expect(outputViewpoint.distance).to.be.closeTo(156896.9689, 0.001);
    });

    it('should get the current pitch', () => {
      expect(outputViewpoint.pitch).to.equal(inputViewpoint.pitch);
    });

    it('should get the current heading', () => {
      expect(outputViewpoint.heading).to.equal(inputViewpoint.heading);
    });
  });

  describe('handling primitive collection / tileset visualizations', () => {
    let layer1: Layer;
    let layer2: Layer;
    let primitiveCollection1: PrimitiveCollection;
    let primitiveCollection2: PrimitiveCollection;

    before(() => {
      layer1 = new Layer({});
      layer2 = new Layer({});
    });

    beforeEach(() => {
      // destroyed on map destroy or removal
      primitiveCollection1 = new PrimitiveCollection();
      primitiveCollection1[vcsLayerName] = layer1.name;
      primitiveCollection2 = new PrimitiveCollection();
      primitiveCollection2[vcsLayerName] = layer2.name;
    });

    after(() => {
      layer1.destroy();
      layer2.destroy();
    });

    describe('adding primitive collection', () => {
      let map: BaseCesiumMap;
      let layerCollection: LayerCollection;
      let numberOfDefaultPrimitives: number;

      before(() => {
        layerCollection = LayerCollection.from([layer1, layer2]);
      });

      beforeEach(() => {
        map = getBaseCesiumMap({ layerCollection });
        numberOfDefaultPrimitives =
          map.getCesiumWidget()!.scene.primitives.length;
      });

      afterEach(() => {
        map.destroy();
      });

      after(() => {
        layerCollection.destroy();
      });

      it('should add a primitive collection to the scene', () => {
        map.addPrimitiveCollection(primitiveCollection1);
        expect(
          map
            .getCesiumWidget()!
            .scene.primitives.contains(primitiveCollection1),
        ).to.be.true;
      });

      it('should not add a visualization twice', () => {
        map.addPrimitiveCollection(primitiveCollection1);
        map.addPrimitiveCollection(primitiveCollection1);
        expect(map.getCesiumWidget()!.scene.primitives.length).to.equal(
          numberOfDefaultPrimitives + 1,
        );
      });

      it('should add a visualization at the correct index based on the index in the layer collection', () => {
        map.addPrimitiveCollection(primitiveCollection2);
        map.addPrimitiveCollection(primitiveCollection1);
        const { primitives } = map.getCesiumWidget()!.scene;
        expect(primitives.length).to.equal(numberOfDefaultPrimitives + 2);
        expect(primitives.get(numberOfDefaultPrimitives)).to.equal(
          primitiveCollection1,
        );
        expect(primitives.get(numberOfDefaultPrimitives + 1)).to.equal(
          primitiveCollection2,
        );
      });

      it('should not add a primitive collection without a vcsLayerName symbol', () => {
        const collection = new PrimitiveCollection();
        map.addPrimitiveCollection(collection);
        expect(map.getCesiumWidget()!.scene.primitives.length).to.equal(
          numberOfDefaultPrimitives,
        );
        collection.destroy();
      });

      it('should not add an primitive collection with a vcsLayerName not corresponding to a layer in the layerCollection', () => {
        const collection = new PrimitiveCollection();
        collection[vcsLayerName] = 'test';
        map.addPrimitiveCollection(collection);
        expect(map.getCesiumWidget()!.scene.primitives.length).to.equal(
          numberOfDefaultPrimitives,
        );
        collection.destroy();
      });
    });

    describe('moving of layers within the layer collection', () => {
      let map: BaseCesiumMap;
      let layerCollection: LayerCollection;
      let numberOfDefaultPrimitives: number;

      before(() => {
        layerCollection = LayerCollection.from([layer1, layer2]);
      });

      beforeEach(() => {
        map = getBaseCesiumMap({ layerCollection });
        numberOfDefaultPrimitives =
          map.getCesiumWidget()!.scene.primitives.length;
      });

      afterEach(() => {
        map.destroy();
      });

      after(() => {
        layerCollection.destroy();
      });

      it('should rearrange the primitive collections to place them at the right index', () => {
        map.addPrimitiveCollection(primitiveCollection1);
        map.addPrimitiveCollection(primitiveCollection2);
        layerCollection.raise(layer1);
        const { primitives } = map.getCesiumWidget()!.scene;
        expect(primitives.get(numberOfDefaultPrimitives)).to.equal(
          primitiveCollection2,
        );
        expect(primitives.get(numberOfDefaultPrimitives + 1)).to.equal(
          primitiveCollection1,
        );
      });
    });

    describe('removing of layers', () => {
      let map: BaseCesiumMap;
      let layerCollection: LayerCollection;

      before(() => {
        layerCollection = LayerCollection.from([layer1, layer2]);
      });

      beforeEach(() => {
        map = getBaseCesiumMap({ layerCollection });
        map.addPrimitiveCollection(primitiveCollection1);
        map.addPrimitiveCollection(primitiveCollection2);
      });

      afterEach(() => {
        map.destroy();
      });

      after(() => {
        layerCollection.destroy();
      });

      it('should remove the primitive collection from the map', () => {
        map.removePrimitiveCollection(primitiveCollection1);
        expect(
          map
            .getCesiumWidget()!
            .scene.primitives.contains(primitiveCollection1),
        ).to.be.false;
      });

      it('should no longer place the primitive collection at an index, if it has been removed after the removal of its visualization', () => {
        map.removePrimitiveCollection(primitiveCollection1);
        layerCollection.raise(layer1);
        expect(
          map
            .getCesiumWidget()!
            .scene.primitives.contains(primitiveCollection1),
        ).to.be.false;
      });
    });
  });
});

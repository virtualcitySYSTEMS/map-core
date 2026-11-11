import { expect } from 'chai';
import sinon from 'sinon';
import type { Cesium3DTileset, Scene } from '@vcmap-cesium/engine';
import { Event as CesiumEvent, Matrix4 } from '@vcmap-cesium/engine';
import TilesetDepthPass from '../../../src/cursor/TilesetDepthPass.js';
import type BaseCesiumMap from '../../../src/map/baseCesiumMap.js';
import { getBaseCesiumMap } from '../helpers/cesiumHelpers.js';

type MockTileset = Cesium3DTileset & {
  destroyed: boolean;
  updateForPass: sinon.SinonSpy;
};

function getMockTileset(preloadWhenHidden = true): MockTileset {
  const tileset = {
    preloadWhenHidden,
    tilesLoaded: true,
    show: false,
    destroyed: false,
    updateForPass: sinon.spy(),
    isDestroyed(): boolean {
      return tileset.destroyed;
    },
  };
  return tileset as unknown as MockTileset;
}

function getMockScene(): Scene {
  return {
    preRender: new CesiumEvent(),
    camera: {
      viewMatrix: Matrix4.clone(Matrix4.IDENTITY),
      frustum: {
        projectionMatrix: Matrix4.clone(Matrix4.IDENTITY),
        computeCullingVolume: (): object => ({}),
      },
    },
    frameState: {},
  } as unknown as Scene;
}

/**
 * Stubs the (webgl) render of the pass, which needs a real scene.
 */
function stubRender(pass: TilesetDepthPass): sinon.SinonStub {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  return sinon.stub(pass as unknown as { _render(): void }, '_render');
}

function changeMatrix(matrix: Matrix4): void {
  Matrix4.multiplyByUniformScale(matrix, 2, matrix);
}

describe('depth pass', () => {
  describe('TilesetDepthPass', () => {
    let scene: Scene;
    let pass: TilesetDepthPass;
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      // the pass renders at most every 500ms. a frozen clock keeps the (webgl) render out of the test.
      clock = sinon.useFakeTimers();
      scene = getMockScene();
      pass = new TilesetDepthPass(scene);
    });

    afterEach(() => {
      pass.destroy();
      clock.restore();
    });

    describe('adding tilesets', () => {
      it('should count each tileset once', () => {
        const tileset = getMockTileset();
        pass.addTileset(tileset);
        pass.addTileset(tileset);
        pass.addTileset(getMockTileset());
        expect(pass.size).to.equal(2);
      });

      it('should remove a tileset with the returned function', () => {
        const remove = pass.addTileset(getMockTileset());
        remove();
        expect(pass.size).to.equal(0);
      });

      it('should update each tileset with a pass state of its own', () => {
        const tilesetA = getMockTileset();
        const tilesetB = getMockTileset();
        pass.addTileset(tilesetA);
        pass.addTileset(tilesetB);
        scene.preRender.raiseEvent(scene, 0);

        expect(tilesetA.updateForPass).to.have.been.calledOnce;
        expect(tilesetB.updateForPass).to.have.been.calledOnce;
        expect(tilesetA.updateForPass.firstCall.args[1]).to.not.equal(
          tilesetB.updateForPass.firstCall.args[1],
        );
      });

      it('should show the tileset only while it is updated', () => {
        const tileset = getMockTileset();
        let showDuringUpdate: boolean | undefined;
        tileset.updateForPass = sinon.spy(() => {
          showDuringUpdate = tileset.show;
        });
        pass.addTileset(tileset);
        scene.preRender.raiseEvent(scene, 0);
        expect(showDuringUpdate).to.be.true;
        expect(tileset.show).to.be.false;
      });
    });

    describe('preloading', () => {
      it('should disable preloading while the tileset is part of the pass', () => {
        const tileset = getMockTileset();
        pass.addTileset(tileset);
        expect(tileset.preloadWhenHidden).to.be.false;
      });

      it('should restore the original preloading, when removing a tileset', () => {
        const tileset = getMockTileset();
        const remove = pass.addTileset(tileset);
        remove();
        expect(tileset.preloadWhenHidden).to.be.true;
      });
    });

    describe('updating tiles', () => {
      let tileset: MockTileset;

      beforeEach(() => {
        tileset = getMockTileset();
        pass.addTileset(tileset);
        scene.preRender.raiseEvent(scene, 0);
        tileset.updateForPass.resetHistory();
      });

      it('should not update tiles, if neither the camera nor the tiles changed', () => {
        scene.preRender.raiseEvent(scene, 0);
        expect(tileset.updateForPass).to.not.have.been.called;
      });

      it('should update tiles, if the view changed', () => {
        changeMatrix(scene.camera.viewMatrix);
        scene.preRender.raiseEvent(scene, 0);
        expect(tileset.updateForPass).to.have.been.calledOnce;
      });

      it('should update tiles, if the projection changed', () => {
        changeMatrix(scene.camera.frustum.projectionMatrix);
        scene.preRender.raiseEvent(scene, 0);
        expect(tileset.updateForPass).to.have.been.calledOnce;
      });

      it('should update tiles each frame, while tiles are loading', () => {
        (tileset as { tilesLoaded: boolean }).tilesLoaded = false;
        scene.preRender.raiseEvent(scene, 0);
        scene.preRender.raiseEvent(scene, 0);
        expect(tileset.updateForPass).to.have.been.calledTwice;
      });

      it('should update tiles of all tilesets, once a tileset is added', () => {
        const other = getMockTileset();
        pass.addTileset(other);
        scene.preRender.raiseEvent(scene, 0);
        expect(tileset.updateForPass).to.have.been.calledOnce;
        expect(other.updateForPass).to.have.been.calledOnce;
      });
    });

    describe('suspending tile loading', () => {
      let tileset: MockTileset;

      beforeEach(() => {
        tileset = getMockTileset();
        pass.addTileset(tileset);
      });

      it('should not select new tiles while suspended', () => {
        pass.suspend();
        changeMatrix(scene.camera.viewMatrix);
        scene.preRender.raiseEvent(scene, 0);
        expect(tileset.updateForPass).to.not.have.been.called;
        expect(pass.suspended).to.be.true;
      });

      it('should update tiles after resuming, even if nothing else changed', () => {
        scene.preRender.raiseEvent(scene, 0);
        pass.suspend()();
        tileset.updateForPass.resetHistory();
        scene.preRender.raiseEvent(scene, 0);
        expect(tileset.updateForPass).to.have.been.calledOnce;
        expect(pass.suspended).to.be.false;
      });

      it('should not render while suspended, even if a pass is due', () => {
        const render = stubRender(pass);
        pass.suspend();
        clock.tick(1000);
        scene.preRender.raiseEvent(scene, 0);
        expect(render).to.not.have.been.called;
      });

      it('should render on the next frame after resuming, even if no pass is due yet', () => {
        const render = stubRender(pass);
        clock.tick(1000);
        scene.preRender.raiseEvent(scene, 0);
        render.resetHistory();
        tileset.updateForPass.resetHistory();

        const release = pass.suspend();
        scene.preRender.raiseEvent(scene, 0);
        release();
        scene.preRender.raiseEvent(scene, 0);
        expect(render).to.have.been.calledOnce;
        expect(tileset.updateForPass).to.have.been.calledOnce;
        expect(render).to.have.been.calledAfter(tileset.updateForPass);
      });

      it('should stay suspended until all suspensions are released, each only once', () => {
        const releaseA = pass.suspend();
        const releaseB = pass.suspend();
        releaseA();
        releaseA();
        expect(pass.suspended).to.be.true;
        releaseB();
        expect(pass.suspended).to.be.false;
      });
    });

    describe('suspending while a promise is pending', () => {
      let tileset: MockTileset;

      beforeEach(() => {
        tileset = getMockTileset();
        pass.addTileset(tileset);
        scene.preRender.raiseEvent(scene, 0);
        tileset.updateForPass.resetHistory();
      });

      it('should not select new tiles while the promise is pending', () => {
        pass.suspendWhile(new Promise(() => {})).catch(() => {});
        changeMatrix(scene.camera.viewMatrix);
        scene.preRender.raiseEvent(scene, 0);
        expect(tileset.updateForPass).to.not.have.been.called;
      });

      it('should resolve with the value of the promise and update tiles afterwards', async () => {
        const value = await pass.suspendWhile(Promise.resolve(1));
        expect(value).to.equal(1);
        scene.preRender.raiseEvent(scene, 0);
        expect(tileset.updateForPass).to.have.been.calledOnce;
      });

      it('should resume after the promise rejected', async () => {
        const error = new Error('failed');
        let caught: unknown;
        try {
          await pass.suspendWhile(Promise.reject(error));
        } catch (e) {
          caught = e;
        }
        expect(caught).to.equal(error);
        scene.preRender.raiseEvent(scene, 0);
        expect(tileset.updateForPass).to.have.been.calledOnce;
      });
    });

    describe('disabling the pass', () => {
      let tileset: MockTileset;

      beforeEach(() => {
        tileset = getMockTileset();
        pass.addTileset(tileset);
      });

      it('should not update tiles, while disabled', () => {
        pass.enabled = false;
        changeMatrix(scene.camera.viewMatrix);
        scene.preRender.raiseEvent(scene, 0);
        expect(tileset.updateForPass).to.not.have.been.called;
      });

      it('should update tiles once enabled again', () => {
        scene.preRender.raiseEvent(scene, 0);
        pass.enabled = false;
        pass.enabled = true;
        tileset.updateForPass.resetHistory();
        scene.preRender.raiseEvent(scene, 0);
        expect(tileset.updateForPass).to.have.been.calledOnce;
      });
    });

    describe('destroyed tilesets', () => {
      it('should drop destroyed tilesets on the next update', () => {
        const tileset = getMockTileset();
        pass.addTileset(tileset);
        tileset.destroyed = true;
        scene.preRender.raiseEvent(scene, 0);
        expect(pass.size).to.equal(0);
        expect(tileset.updateForPass).to.not.have.been.called;
      });
    });
  });

  describe('BaseCesiumMap depth pass', () => {
    let map: BaseCesiumMap;

    beforeEach(() => {
      map = getBaseCesiumMap();
    });

    afterEach(() => {
      map.destroy();
    });

    it('should not have a depth pass by default', () => {
      expect(map.depthPass).to.be.undefined;
    });

    it('should share one depth pass for all tilesets', () => {
      map.addToDepthPass(getMockTileset());
      const { depthPass } = map;
      map.addToDepthPass(getMockTileset());
      expect(map.depthPass).to.equal(depthPass);
      expect(depthPass).to.have.property('size', 2);
    });

    it('should destroy the depth pass, once the last tileset has been removed', () => {
      const removeA = map.addToDepthPass(getMockTileset());
      const removeB = map.addToDepthPass(getMockTileset());
      const depthPass = map.depthPass!;

      removeA();
      expect(map.depthPass).to.equal(depthPass);
      removeB();
      expect(map.depthPass).to.be.undefined;
      expect(depthPass.isDestroyed()).to.be.true;
    });

    it('should create a new depth pass after the previous one has been destroyed', () => {
      map.addToDepthPass(getMockTileset())();
      map.addToDepthPass(getMockTileset());
      expect(map.depthPass).to.exist;
      expect(map.depthPass!.isDestroyed()).to.be.false;
    });

    it('should destroy the depth pass with the map', () => {
      map.addToDepthPass(getMockTileset());
      const depthPass = map.depthPass!;
      map.destroy();
      expect(depthPass.isDestroyed()).to.be.true;
      expect(map.depthPass).to.be.undefined;
    });

    it('should not fail removing a tileset after the map has been destroyed', () => {
      const remove = map.addToDepthPass(getMockTileset());
      map.destroy();
      expect(() => {
        remove();
      }).to.not.throw();
    });
  });
});

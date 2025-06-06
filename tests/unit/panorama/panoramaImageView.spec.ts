import { expect } from 'chai';
import sinon, { type SinonSandbox, type SinonStub } from 'sinon';
import type { Primitive } from '@vcmap-cesium/engine';
import { Cartesian3, Ray } from '@vcmap-cesium/engine';
import {
  getPanoramaImage,
  getPanoramaMap,
} from '../helpers/panoramaHelpers.js';
import type PanoramaMap from '../../../src/map/panoramaMap.js';
import type { PanoramaImage } from '../../../src/panorama/panoramaImage.js';
import type { TileCoordinate } from '../../../src/panorama/panoramaTileCoordinate.js';
import {
  createPanoramaTile,
  type PanoramaTile,
} from '../../../src/panorama/panoramaTile.js';
import { MAX_FOV } from '../../../src/panorama/panoramaCameraController.js';

describe('PanoramaImageView', () => {
  describe('tile loading and rendering', () => {
    let map: PanoramaMap;
    let panoramaImage: PanoramaImage;
    let createVisibleTiles: SinonStub;
    let destroy: () => void;
    let sandbox: SinonSandbox;

    before(async () => {
      sandbox = sinon.createSandbox();
      ({ panoramaImage, destroy } = await getPanoramaImage());
    });

    beforeEach(() => {
      map = getPanoramaMap();
      createVisibleTiles = sandbox
        .stub(panoramaImage.tileProvider, 'createVisibleTiles')
        .callsFake((tileCoordinates: TileCoordinate[]): PanoramaTile[] => {
          return tileCoordinates.map((tileCoordinate) => {
            return createPanoramaTile(
              tileCoordinate,
              panoramaImage.modelMatrix,
              panoramaImage.tileSize,
            );
          });
        });
      map.setCurrentImage(panoramaImage);
    });

    afterEach(() => {
      map.destroy();
      sandbox.restore();
    });

    after(() => {
      destroy();
    });

    it('should render tiles based on camera and image', () => {
      expect(createVisibleTiles).to.have.been.calledOnce;
      const tileCoordinates = createVisibleTiles.getCall(0)
        .args[0] as TileCoordinate[];
      expect(tileCoordinates.map((tc) => tc.key)).to.have.ordered.members([
        '2/7/2',
        '2/7/1',
        '2/0/1',
        '2/0/2',
        '0/0/0',
        '0/1/0',
      ]);
    });

    it('should remove tiles when not visible', () => {
      sandbox.stub(map.getCesiumWidget().scene.canvas, 'width').get(() => 20);
      map.panoramaCameraController.zoomOut(MAX_FOV); // Zoom out to trigger tile loading
      expect(map.panoramaView.tilePrimitiveCollection.length).to.equal(2);
    });

    it('should not load the base level more then once', () => {
      sandbox.stub(map.getCesiumWidget().scene.canvas, 'width').get(() => 20);
      map.panoramaCameraController.zoomOut(MAX_FOV); // Zoom out to trigger tile loading
      expect(createVisibleTiles).to.have.been.calledTwice;
      const tileCoordinates = createVisibleTiles.getCall(1)
        .args[0] as TileCoordinate[];
      expect(tileCoordinates.map((tc) => tc.key)).to.have.ordered.members([
        '0/0/0',
        '0/1/0',
      ]);
    });

    it('should add every loaded tile to the primitive collection', () => {
      expect(map.panoramaView.tilePrimitiveCollection.length).to.equal(6);
    });

    it('should allow the suspension of tile loading', () => {
      map.panoramaView.suspendTileLoading = true;
      map.panoramaCameraController.zoomOut(MAX_FOV); // Zoom out to trigger tile loading
      expect(createVisibleTiles).to.have.been.calledOnce;
    });

    it('should load on camera change', () => {
      map.getCesiumWidget().camera.changed.raiseEvent();
      expect(createVisibleTiles).to.have.been.calledTwice;
    });
  });

  describe('image change reaction', () => {
    describe('setting a new image', () => {
      let map: PanoramaMap;
      let panoramaImage: PanoramaImage;
      let newImage: PanoramaImage;
      let destroy: () => void;
      let destroyNewImage: () => void;
      let sandbox: SinonSandbox;

      before(async () => {
        sandbox = sinon.createSandbox();
        ({ panoramaImage, destroy } = await getPanoramaImage());
        ({ panoramaImage: newImage, destroy: destroyNewImage } =
          await getPanoramaImage());
      });

      beforeEach(() => {
        map = getPanoramaMap();
        sandbox
          .stub(panoramaImage.tileProvider, 'createVisibleTiles')
          .callsFake((tileCoordinates: TileCoordinate[]): PanoramaTile[] => {
            return tileCoordinates.map((tileCoordinate) => {
              return createPanoramaTile(
                tileCoordinate,
                panoramaImage.modelMatrix,
                panoramaImage.tileSize,
              );
            });
          });
        map.setCurrentImage(panoramaImage);
      });

      afterEach(() => {
        map.destroy();
        sandbox.restore();
      });

      after(() => {
        destroy();
        destroyNewImage();
      });

      it('should add the new tile primitives to the collection', () => {
        const firstTile = map.panoramaView.tilePrimitiveCollection.get(
          0,
        ) as Primitive;
        map.setCurrentImage(newImage);
        expect(map.panoramaView.tilePrimitiveCollection.length).to.equal(6);
        expect(map.panoramaView.tilePrimitiveCollection.contains(firstTile)).to
          .be.false;
      });
    });

    describe('unsetting the image', () => {
      let map: PanoramaMap;
      let panoramaImage: PanoramaImage;
      let destroy: () => void;
      let sandbox: SinonSandbox;

      before(async () => {
        sandbox = sinon.createSandbox();
        ({ panoramaImage, destroy } = await getPanoramaImage());
      });

      beforeEach(() => {
        map = getPanoramaMap();
        sandbox
          .stub(panoramaImage.tileProvider, 'createVisibleTiles')
          .callsFake((tileCoordinates: TileCoordinate[]): PanoramaTile[] => {
            return tileCoordinates.map((tileCoordinate) => {
              return createPanoramaTile(
                tileCoordinate,
                panoramaImage.modelMatrix,
                panoramaImage.tileSize,
              );
            });
          });
        map.setCurrentImage(panoramaImage);
      });

      afterEach(() => {
        map.destroy();
        sandbox.restore();
      });

      after(() => {
        destroy();
      });

      it('should add the new tile primitives to the collection', () => {
        map.setCurrentImage();
        expect(map.panoramaView.tilePrimitiveCollection.length).to.equal(0);
      });
    });
  });

  describe('depth handling', () => {
    let map: PanoramaMap;
    let panoramaImage: PanoramaImage;
    let destroy: () => void;
    let sandbox: SinonSandbox;
    let getDepthAtImageCoordinate: SinonStub;
    let callMouseMock: (event: MouseEvent | TouchEvent) => {
      promise: Promise<number | undefined>;
      resolve: (depth?: number) => void;
    };

    before(async () => {
      sandbox = sinon.createSandbox();
      ({ panoramaImage, destroy } = await getPanoramaImage({ depth: true }));

      callMouseMock = (
        event: MouseEvent | TouchEvent,
      ): {
        promise: Promise<number | undefined>;
        resolve: (depth?: number) => void;
      } => {
        let resolveDepth: (depth?: number) => void = () => {};
        const depthPromise = new Promise<number | undefined>((resolve) => {
          resolveDepth = resolve;
        });
        getDepthAtImageCoordinate.callsFake(() => depthPromise);
        const { canvas } = map.getCesiumWidget().scene;
        canvas.dispatchEvent(event);
        return { promise: depthPromise, resolve: resolveDepth };
      };
    });

    beforeEach(() => {
      map = getPanoramaMap();
      sandbox
        .stub(panoramaImage.tileProvider, 'createVisibleTiles')
        .callsFake((tileCoordinates: TileCoordinate[]): PanoramaTile[] => {
          return tileCoordinates.map((tileCoordinate) => {
            return createPanoramaTile(
              tileCoordinate,
              panoramaImage.modelMatrix,
              panoramaImage.tileSize,
            );
          });
        });

      getDepthAtImageCoordinate = sandbox.stub(
        panoramaImage.tileProvider,
        'getDepthAtImageCoordinate',
      );

      sandbox
        .stub(map.getCesiumWidget().camera, 'getPickRay')
        .returns(new Ray());

      map.setCurrentImage(panoramaImage);
    });

    afterEach(() => {
      map.destroy();
      sandbox.restore();
    });

    after(() => {
      destroy();
    });

    it('should set cursor position based on depth', async () => {
      const originalCursorPosition =
        map.panoramaView.tilePrimitiveCollection.cursorPosition;
      const { promise, resolve } = callMouseMock(
        new MouseEvent('mousemove', { clientX: 20, clientY: 20 }),
      );
      resolve(1);
      await promise;
      expect(
        map.panoramaView.tilePrimitiveCollection.cursorPosition,
      ).to.not.equal(originalCursorPosition);
    });

    it('should not update the cursor position if depth is not available', async () => {
      const originalCursorPosition =
        map.panoramaView.tilePrimitiveCollection.cursorPosition;
      const { promise, resolve } = callMouseMock(
        new MouseEvent('mousemove', { clientX: 20, clientY: 20 }),
      );
      resolve();
      await promise;
      expect(map.panoramaView.tilePrimitiveCollection.cursorPosition).to.equal(
        originalCursorPosition,
      );
    });

    it('should not update, if the mouse leaves before depth could be ascertained', async () => {
      const originalCursorPosition =
        map.panoramaView.tilePrimitiveCollection.cursorPosition;
      const { promise, resolve } = callMouseMock(
        new MouseEvent('mousemove', { clientX: 20, clientY: 20 }),
      );
      resolve(1);
      callMouseMock(new MouseEvent('mouseleave', { clientX: 20, clientY: 20 }));
      await promise;
      expect(map.panoramaView.tilePrimitiveCollection.cursorPosition).to.equal(
        originalCursorPosition,
      );
    });

    it('should only update the cursor position, if it changes enough', async () => {
      const { promise, resolve } = callMouseMock(
        new MouseEvent('mousemove', { clientX: 20, clientY: 20 }),
      );
      resolve(1);
      await promise;
      const { cursorPosition } = map.panoramaView.tilePrimitiveCollection;
      const { promise: nextPromise, resolve: nextResolve } = callMouseMock(
        new MouseEvent('mousemove', { clientX: 22, clientY: 20 }),
      );
      nextResolve(1.01);
      await nextPromise;
      expect(map.panoramaView.tilePrimitiveCollection.cursorPosition).to.equal(
        cursorPosition,
      );
      const { promise: nextPromise2, resolve: nextResolve2 } = callMouseMock(
        new MouseEvent('mousemove', { clientX: 22, clientY: 25 }),
      );
      nextResolve2(1.02);
      await nextPromise2;
      expect(
        map.panoramaView.tilePrimitiveCollection.cursorPosition,
      ).to.not.equal(cursorPosition);
    });

    it('should unset the cursor position on mouse leave', async () => {
      const originalCursorPosition =
        map.panoramaView.tilePrimitiveCollection.cursorPosition;

      const { promise, resolve } = callMouseMock(
        new MouseEvent('mousemove', { clientX: 20, clientY: 20 }),
      );
      resolve(1);
      await promise;
      expect(map.panoramaView.tilePrimitiveCollection.cursorPosition).to.not.be
        .undefined;
      const { promise: leavePromise, resolve: leaveResolve } = callMouseMock(
        new MouseEvent('mouseleave', { clientX: 20, clientY: 20 }),
      );
      leaveResolve();
      await leavePromise;
      expect(map.panoramaView.tilePrimitiveCollection.cursorPosition)
        .to.eql(new Cartesian3(-1, -1, -1))
        .and.to.not.equal(originalCursorPosition);
    });

    it('should work for touching events', async () => {
      const originalCursorPosition =
        map.panoramaView.tilePrimitiveCollection.cursorPosition;
      const { promise, resolve } = callMouseMock(
        new TouchEvent('touchmove', {
          touches: [
            new Touch({
              clientX: 20,
              clientY: 20,
              identifier: 0,
              target: map.getCesiumWidget().scene.canvas,
            }),
          ],
        }),
      );
      resolve(1);
      await promise;
      expect(
        map.panoramaView.tilePrimitiveCollection.cursorPosition,
      ).to.not.equal(originalCursorPosition);
    });

    it('should unset cursor position on touch end', async () => {
      const originalCursorPosition =
        map.panoramaView.tilePrimitiveCollection.cursorPosition;

      const { promise, resolve } = callMouseMock(
        new TouchEvent('touchmove', {
          touches: [
            new Touch({
              clientX: 20,
              clientY: 20,
              identifier: 0,
              target: map.getCesiumWidget().scene.canvas,
            }),
          ],
        }),
      );
      resolve(1);
      await promise;
      expect(
        map.panoramaView.tilePrimitiveCollection.cursorPosition,
      ).to.not.equal(originalCursorPosition);
      const { promise: leavePromise, resolve: leaveResolve } = callMouseMock(
        new TouchEvent('touchend', {
          changedTouches: [
            new Touch({
              clientX: 20,
              clientY: 20,
              identifier: 0,
              target: map.getCesiumWidget().scene.canvas,
            }),
          ],
        }),
      );
      leaveResolve();
      await leavePromise;
      expect(map.panoramaView.tilePrimitiveCollection.cursorPosition)
        .to.eql(new Cartesian3(-1, -1, -1))
        .and.to.not.equal(originalCursorPosition);
    });
  });

  describe('destroy', () => {
    let map: PanoramaMap;
    let panoramaImage: PanoramaImage;
    let newImage: PanoramaImage;
    let destroy: () => void;
    let destroyNewImage: () => void;

    let sandbox: SinonSandbox;
    let getDepthAtImageCoordinate: SinonStub;
    let callMouseMock: (event: MouseEvent | TouchEvent) => {
      promise: Promise<number | undefined>;
      resolve: (depth?: number) => void;
    };

    before(async () => {
      sandbox = sinon.createSandbox();
      ({ panoramaImage, destroy } = await getPanoramaImage({ depth: true }));
      ({ panoramaImage: newImage, destroy: destroyNewImage } =
        await getPanoramaImage());

      callMouseMock = (
        event: MouseEvent | TouchEvent,
      ): {
        promise: Promise<number | undefined>;
        resolve: (depth?: number) => void;
      } => {
        let resolveDepth: (depth?: number) => void = () => {};
        const depthPromise = new Promise<number | undefined>((resolve) => {
          resolveDepth = resolve;
        });
        getDepthAtImageCoordinate.callsFake(() => depthPromise);
        const { canvas } = map.getCesiumWidget().scene;
        canvas.dispatchEvent(event);
        return { promise: depthPromise, resolve: resolveDepth };
      };
    });

    beforeEach(() => {
      map = getPanoramaMap();
      sandbox
        .stub(panoramaImage.tileProvider, 'createVisibleTiles')
        .callsFake((tileCoordinates: TileCoordinate[]): PanoramaTile[] => {
          return tileCoordinates.map((tileCoordinate) => {
            return createPanoramaTile(
              tileCoordinate,
              panoramaImage.modelMatrix,
              panoramaImage.tileSize,
            );
          });
        });

      getDepthAtImageCoordinate = sandbox.stub(
        panoramaImage.tileProvider,
        'getDepthAtImageCoordinate',
      );

      sandbox
        .stub(map.getCesiumWidget().camera, 'getPickRay')
        .returns(new Ray());

      map.setCurrentImage(panoramaImage);
      map.panoramaView.destroy();
    });

    afterEach(() => {
      map.destroy();
      sandbox.restore();
    });

    after(() => {
      destroy();
      destroyNewImage();
    });

    it('should remove the canvas listeners from the canvas', async () => {
      const originalCursorPosition =
        map.panoramaView.tilePrimitiveCollection.cursorPosition;
      const { promise, resolve } = callMouseMock(
        new MouseEvent('mousemove', { clientX: 20, clientY: 20 }),
      );
      resolve(1);
      await promise;
      expect(map.panoramaView.tilePrimitiveCollection.cursorPosition).to.equal(
        originalCursorPosition,
      );
    });

    it('should no longer listen to camera changes', () => {
      map.getCesiumWidget().camera.changed.raiseEvent();
      expect(map.panoramaView.tilePrimitiveCollection.length).to.equal(0);
    });

    it('should no longer render on render', () => {
      map.panoramaView.render();
      expect(map.panoramaView.tilePrimitiveCollection.length).to.equal(0);
    });

    it('should no longer listen to image changes', () => {
      map.setCurrentImage(newImage);
      expect(map.panoramaView.tilePrimitiveCollection.length).to.equal(0);
    });
  });
});

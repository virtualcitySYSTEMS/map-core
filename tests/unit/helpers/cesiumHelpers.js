import {
  BoundingSphere,
  Entity,
  Camera,
  WebMercatorProjection,
  PrimitiveCollection,
  Globe,
  Event as CesiumEvent,
  SceneMode,
  ImageryLayerCollection,
  Clock,
  DataSourceCollection,
  ScreenSpaceEventHandler,
  Color,
  Cesium3DTileFeature,
  TweenCollection,
  ContextLimits,
} from '@vcmap/cesium';
import CesiumTilesetLayer from '../../../src/layer/cesiumTilesetLayer.js';
import DataSourceLayer from '../../../src/layer/dataSourceLayer.js';
import CesiumMap from '../../../src/map/cesiumMap.js';
import { Viewpoint } from '../../../index.js';

export const tilesetJSON = {
  asset: {
    version: '0.0',
    tilesetVersion: '54443336650',
  },
  geometricError: 48.828125,
  root: {
    boundingVolume: {
      region: [
        0.233260953,
        0.916361773,
        0.233644448,
        0.91655352,
        0.0,
        140.3,
      ],
    },
    geometricError: 24.4140625,
    refine: 'ADD',
    children: [],
  },
  properties: {},
  extras: { _3DTILESDIFFUSE: true },
};

/**
 * @param {Sinon.SinonSandbox} sandbox
 * @param {string=} url
 * @returns {*|Sinon.SinonFakeServer|null}
 */
export function createTilesetServer(sandbox, url) {
  const server = sandbox ? sandbox.useFakeServer() : sinon.createFakeServer();
  server.autoRespond = true;
  server.respondImmediately = true;
  server.respondWith(
    url || 'http://test.com/tileset.json',
    [200, { 'Content-Type': 'application/json' }, JSON.stringify(tilesetJSON)],
  );
  server.respond();
  return server;
}

/**
 * @param {Sinon.SinonSandbox} sandbox
 * @param {CesiumMap=} cesiumMap
 * @param {string=} name
 * @returns {Promise<CesiumTilesetLayer>}
 */
export async function createInitializedTilesetLayer(sandbox, cesiumMap, name) {
  createTilesetServer(sandbox);
  const tilesetLayer = new CesiumTilesetLayer({
    url: 'http://test.com/tileset.json',
    name,
  });

  await tilesetLayer.initialize();
  if (cesiumMap) {
    cesiumMap.layerCollection.add(tilesetLayer);
    const impls = tilesetLayer.getImplementationsForMap(cesiumMap);
    await Promise.all(impls.map(async (impl) => {
      await impl.initialize();
      Object.defineProperty(impl.cesium3DTileset, 'boundingSphere', {
        get() {
          return new BoundingSphere();
        },
      });
    }));
  }

  return tilesetLayer;
}

export function createEntities(numberOfEntities = 1) {
  const layer = new DataSourceLayer({});

  const entities = new Array(numberOfEntities);
  for (let i = 0; i < numberOfEntities; i++) {
    entities[i] = new Entity({
      model: {},
    });
    layer.addEntity(entities[i]);
  }

  return {
    layer,
    entities,
  };
}

/**
 * @param {import("@vcmap/core").VcsEvent} event
 * @param {sinon.sandbox} [sandbox]
 * @returns {sinon.spy}
 */
export function getVcsEventSpy(event, sandbox) {
  const spy = (sandbox ?? sinon).spy();
  const listener = event.addEventListener(function callback() {
    listener();
    // eslint-disable-next-line prefer-rest-params
    spy(...arguments);
  });
  return spy;
}

export function getMockScene() {
  const scene = {
    screenSpaceCameraController: {
      enableInputs: true,
    },
    globe: new Globe(),
    mode: SceneMode.SCENE3D,
    tweens: new TweenCollection(),
    primitives: new PrimitiveCollection(),
    groundPrimitives: new PrimitiveCollection(),
    imageryLayers: new ImageryLayerCollection(),
    drawingBufferHeight: 100,
    drawingBufferWidth: 100,
    postRender: new CesiumEvent(),
    preUpdate: new CesiumEvent(),
    mapProjection: new WebMercatorProjection(),
    shadowMap: { enabled: false },
    canvas: document.createElement('canvas'),
    terrainProvider: {
      readyPromise: Promise.resolve(),
    },
    frameState: {
      mode: undefined,
      context: {
        depthTexture: true,
        stencilBuffer: true,
      },
      lineWidth: 1,
    },
    context: {
      depthTexture: true,
      stencilBuffer: true,
    },
    render(time) {
      this.postRender.raiseEvent(this, time);
    },
    pick() {},
    pickPosition() {},
    drillPick() { return []; },
    destroy() {
      this.primitives.destroy();
      this.groundPrimitives.destroy();
      this.imageryLayers.destroy();
      this.globe.destroy();
      this.canvas = null;
    },
  };
  const camera = new Camera(scene);
  const originalFlyTo = camera.flyTo;

  camera.flyTo = function flyTo(options) {
    options.duration = 0;
    originalFlyTo.bind(camera)(options);
  };

  scene.camera = camera;
  return scene;
}

export function getCesiumMap(mapOptions) {
  const map = new CesiumMap(mapOptions || {});
  const scene = getMockScene();
  map._cesiumWidget = {
    scene,
    camera: scene.camera,
    render: scene.render,
    resolutionScale: 1,
    clock: new Clock({}),
    destroy() {
      this.scene.destroy();
      this.scene = null;
      this.camera = null;
    },
    resize() {},
  };

  map.screenSpaceEventHandler = new ScreenSpaceEventHandler(map._cesiumWidget.scene.canvas);
  map.dataSourceDisplay = {
    dataSources: new DataSourceCollection(),
    isDestroyed() {
      return false;
    },
    destroy() {
      this.dataSources.destroy();
    },
  };
  map.initialized = true;
  const originalGetViewpointSync = map.getViewpointSync.bind(map);
  map.getViewpointSync = function patchedGetVPSync() {
    const vp = originalGetViewpointSync();
    if (vp) {
      return vp;
    }
    return new Viewpoint({});
  };

  return map;
}

/**
 * @param {VcsApp} app
 * @returns {Promise<CesiumMap>}
 */
export async function setCesiumMap(app) {
  const map = getCesiumMap({ layerCollection: app.layers, target: app.maps.target });
  app.maps.add(map);
  await app.maps.setActiveMap(map.name);
  return map;
}

/**
 * creates usable default ContextLimits, copy pasted from chrome
 */
export function setupCesiumContextLimits() {
  ContextLimits._highpFloatSupported = true;
  ContextLimits._highpIntSupported = true;
  ContextLimits._maximumAliasedLineWidth = 1;
  ContextLimits._maximumAliasedPointSize = 1024;
  ContextLimits._maximumColorAttachments = 8;
  ContextLimits._maximumCombinedTextureImageUnits = 32;
  ContextLimits._maximumCubeMapSize = 16384;
  ContextLimits._maximumDrawBuffers = 8;
  ContextLimits._maximumFragmentUniformVectors = 1024;
  ContextLimits._maximumRenderbufferSize = 16384;
  ContextLimits._maximumTextureFilterAnisotropy = 16;
  ContextLimits._maximumTextureImageUnits = 16;
  ContextLimits._maximumTextureSize = 16384;
  ContextLimits._maximumVaryingVectors = 30;
  ContextLimits._maximumVertexAttributes = 16;
  ContextLimits._maximumVertexTextureImageUnits = 16;
  ContextLimits._maximumVertexUniformVectors = 4095;
  ContextLimits._maximumViewportHeight = 32767;
  ContextLimits._maximumViewportWidth = 32767;
  ContextLimits._minimumAliasedLineWidth = 1;
  ContextLimits._minimumAliasedPointSize = 1;
}

class BatchTable {
  constructor(properties) {
    this.properties = properties;
    this.color = new Color();
    this.show = true;
    this.destroyed = false;
  }

  getPropertyIds() { return Object.keys(this.properties); }

  getProperty(id, prop) { return this.properties[prop]; }

  getColor() { return this.color; }

  setColor(id, color) { this.color = color; }

  getShow() { return this.show; }

  setShow(id, show) { this.show = show; }

  isDestroyed() { return this.destroyed; }
}

/**
 * @param {Object} properties
 * @param {Object=} tileset
 * @returns {Cesium.Cesium3DTileFeature}
 */
export function createDummyCesium3DTileFeature(properties = {}, tileset) {
  const dummy = new Cesium3DTileFeature();
  const content = { batchTable: new BatchTable(properties), isDestroyed() { return false; } };
  if (tileset) {
    content.tileset = tileset;
  }
  dummy._content = content;
  return dummy;
}

import chai from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import canvas from 'canvas';
import canvasBindings from 'canvas/lib/bindings.js';
import fetch from 'node-fetch';
import ResizeObserverPolyfill from 'resize-observer-polyfill';

chai.use(sinonChai);

global.XMLHttpRequest = window.XMLHttpRequest;
global.expect = chai.expect;
global.sinon = sinon;

global.requestAnimationFrame = window.requestAnimationFrame;
global.cancelAnimationFrame = window.cancelAnimationFrame;
global.canvaslibrary = canvas;
global.CESIUM_BASE_URL = 'cesium/Source/';
global.FileReader = window.FileReader;
global.DOMParser = window.DOMParser;
global.fetch = fetch;
global.ResizeObserver = ResizeObserverPolyfill;
global.ShadowRoot = Function;
global.ImageBitmap = HTMLCanvasElement;
global.OffscreenCanvas = HTMLCanvasElement;
global.createImageBitmap = (image, sx, sy, sw, sh) => {
  if (image instanceof HTMLCanvasElement) {
    return image;
  }
  const canElem = canvas.createCanvas(sw, sh);
  const ctx = canElem.getContext('2d');
  const imageData = canvas.createImageData(
    new Uint8ClampedArray(image),
    sw,
    sh,
  );
  ctx.putImageData(imageData, sx, sy);

  return Promise.resolve(canElem);
};

const OriginalBlob = global.Blob;
global.Blob = function BlobPolyfill(parts, options) {
  if (parts.length === 0) {
    return new OriginalBlob([], options);
  }
  if (parts.length > 1) {
    throw new Error(
      'Blob constructor takes a single argument which is an array of ArrayBuffer',
    );
  }
  return parts[0];
};

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
global.Touch = class TouchMock {
  constructor({ identifier = 0, target = null, clientX = 0, clientY = 0 }) {
    this.identifier = identifier;
    this.target = target;
    this.clientX = clientX;
    this.clientY = clientY;
  }
};

Object.assign(canvas, {
  CanvasGradient: canvasBindings.CanvasGradient,
  CanvasPattern: canvasBindings.CanvasPattern,
});
['CanvasRenderingContext2D', 'CanvasPattern', 'CanvasGradient'].forEach(
  (obj) => {
    global[obj] = canvas[obj];
  },
);
global.createCanvas = canvas.createCanvas;

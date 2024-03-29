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

// @ts-nocheck
import CanvasImmediateRenderer from 'ol/render/canvas/Immediate.js';
import { intersects } from 'ol/extent.js';
import { transformGeom2D } from 'ol/geom/SimpleGeometry.js';
import { transform2D } from 'ol/geom/flat/transform.js';

/**
 * @class
 * @extends {CanvasImmediateRenderer}
 * @memberOf ol
 * @exports
 * Tile Renderer Implementation of openlayers CanvasImmediateRenderer
 * can be used to allow for a correction Factor to take into account Mercator Tile distortion
 */
class CanvasTileRenderer extends CanvasImmediateRenderer {
  /**
   * @param {CanvasRenderingContext2D} context Context.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("ol/extent").Extent} extent Extent.
   * @param {import("ol/transform").Transform} transform Transform.
   * @param {number} viewRotation View rotation.
   * @param {number=} squaredTolerance Optional squared tolerance for simplification.
   * @param {import("ol/proj").TransformFunction=} userTransform Transform from user to view projection.
   * @param {number} [scaleY=1] Scale value for Scaling Circles, Images, Text in Y direction.
   */
  constructor(
    context,
    pixelRatio,
    extent,
    transform,
    viewRotation,
    squaredTolerance,
    userTransform,
    scaleY = 1,
  ) {
    super(context, pixelRatio, extent, transform, viewRotation, squaredTolerance, userTransform);

    /**
     * @private
     * @type {number}
     */
    this.scaleY = scaleY;

    /**
     * @private
     * @type {import("ol/size").Size}
     */
    this.scaledImageScale_ = [0, 0];

    /**
     * @private
     * @type {import("ol/size").Size}
     */
    this.scaledTextScale_ = [0, 0];
  }

  /**
   * @private
   * @type {import("ol/size").Size}
   */
  get imageScale_() {
    return this.scaledImageScale_;
  }

  /**
   * @private
   * @param {import("ol/size").Size} value
   */
  set imageScale_(value) {
    const imageScale = value || [1, 1];
    this.scaledImageScale_ = [
      imageScale[0],
      imageScale[1] * this.scaleY,
    ];
  }

  /**
   * @private
   * @type {import("ol/size").Size}
   */
  get textScale_() {
    return this.scaledTextScale_;
  }

  /**
   * @private
   * @param {import("ol/size").Size} value
   */
  set textScale_(value) {
    const textScale = value || [1, 1];
    this.scaledTextScale_ = [
      textScale[0],
      textScale[1] * this.scaleY,
    ];
  }

  /**
   * @param {Array<number>} flatCoordinates Flat coordinates.
   * @param {number} offset Offset.
   * @param {number} end End.
   * @param {number} stride Stride.
   * @param {boolean} close Close.
   * @private
   * @returns {number} end End.
   */
  moveToLineTo_(flatCoordinates, offset, end, stride, close) {
    const context = this.context_;
    const pixelCoordinates = transform2D(
      flatCoordinates,
      offset,
      end,
      stride,
      this.transform_,
      this.pixelCoordinates_,
    );
    context.moveTo(pixelCoordinates[0], pixelCoordinates[1]);
    const { length } = pixelCoordinates;
    for (let i = 2; i < length; i += 2) {
      context.lineTo(pixelCoordinates[i], pixelCoordinates[i + 1]);
    }
    if (close) {
      context.closePath();
    }
    return end;
  }

  /**
   * Render a circle geometry into the canvas.  Rendering is immediate and uses
   * the current fill and stroke styles.
   *
   * takes the mercator yscale into account and draws a ellipse instead of a circle.
   *
   * @param {import("ol/geom/Circle").default} geometry Circle geometry.
   * @api
   */
  drawCircle(geometry) {
    if (!intersects(this.extent_, geometry.getExtent())) {
      return;
    }
    if (this.fillState_ || this.strokeState_) {
      if (this.fillState_) {
        this.setContextFillState_(this.fillState_);
      }
      if (this.strokeState_) {
        this.setContextStrokeState_(this.strokeState_);
      }
      const pixelCoordinates = transformGeom2D(
        geometry,
        this.transform_,
        this.pixelCoordinates_,
      );
      const dx = pixelCoordinates[2] - pixelCoordinates[0];
      const dy = pixelCoordinates[3] - pixelCoordinates[1];
      const radius = Math.sqrt(dx * dx + dy * dy);
      const context = this.context_;
      context.beginPath();
      context.ellipse(
        pixelCoordinates[0],
        pixelCoordinates[1],
        radius,
        radius * this.scaleY,
        0,
        0,
        2 * Math.PI,
      );
      if (this.fillState_) {
        context.fill();
      }
      if (this.strokeState_) {
        context.stroke();
      }
    }
    if (this.text_ !== '') {
      this.drawText_(geometry.getCenter(), 0, 2, 2);
    }
  }
}

export default CanvasTileRenderer;

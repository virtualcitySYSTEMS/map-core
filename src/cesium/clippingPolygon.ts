import {
  Cartesian3,
  defined,
  ClippingPolygon,
  Rectangle,
} from '@vcmap-cesium/engine';

function equalArrayCartesian3(
  flatPositions: number[],
  cartesian3s: Cartesian3[],
): boolean {
  if (defined(flatPositions) !== defined(cartesian3s)) {
    return false;
  }
  if (flatPositions.length !== cartesian3s.length * 3) {
    return false;
  }
  const n = cartesian3s.length;
  for (let i = 0; i < n; i++) {
    if (
      flatPositions[i * 3] !== cartesian3s[i].x ||
      flatPositions[i * 3 + 1] !== cartesian3s[i].y ||
      flatPositions[i * 3 + 2] !== cartesian3s[i].z
    ) {
      return false;
    }
  }
  return true;
}
// eslint-disable-next-line @typescript-eslint/unbound-method
const originalComputeRectangle = ClippingPolygon.prototype.computeRectangle;
ClippingPolygon.prototype.computeRectangle = function computeRectangle(
  result,
): Rectangle {
  if (equalArrayCartesian3(this._cachedPackedCartesians, this.positions)) {
    return Rectangle.clone(this._cachedRectangle, result);
  }
  this._cachedPackedCartesians = Cartesian3.packArray(
    this.positions,
    new Array(this.positions.length * 3),
  );
  const rectangle = originalComputeRectangle.call(this, result);
  this._cachedRectangle = Rectangle.clone(rectangle);
  return rectangle;
};

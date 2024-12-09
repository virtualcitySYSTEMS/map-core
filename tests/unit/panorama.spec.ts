import { expect } from 'chai';

type Point2D = [number, number];
type SphericalCoords = { phi: number; theta: number };

function stereographicProjection(
  tangentPoint: SphericalCoords,
  spherePoint: SphericalCoords,
): Point2D {
  // Convert tangent point to Cartesian
  const tangentCartesian = {
    x: Math.sin(tangentPoint.phi) * Math.cos(tangentPoint.theta),
    y: Math.sin(tangentPoint.phi) * Math.sin(tangentPoint.theta),
    z: Math.cos(tangentPoint.phi),
  };

  // Convert sphere point to Cartesian
  const sphereCartesian = {
    x: Math.sin(spherePoint.phi) * Math.cos(spherePoint.theta),
    y: Math.sin(spherePoint.phi) * Math.sin(spherePoint.theta),
    z: Math.cos(spherePoint.phi),
  };

  // Direction vector from tangent point to sphere point
  const dx = sphereCartesian.x - tangentCartesian.x;
  const dy = sphereCartesian.y - tangentCartesian.y;
  const dz = sphereCartesian.z - tangentCartesian.z;

  // Scaling factor for intersection with the tangent plane z = tz
  const t = -tangentCartesian.z / dz;

  // Plane coordinates
  const X = tangentCartesian.x + t * dx;
  const Y = tangentCartesian.y + t * dy;

  return [X, Y];
}

function inverseStereographicProjection(
  tangentPoint: SphericalCoords,
  planePoint: Point2D,
): SphericalCoords {
  // Convert tangent point to Cartesian coordinates
  const tangentCartesian = {
    x: Math.sin(tangentPoint.phi) * Math.cos(tangentPoint.theta),
    y: Math.sin(tangentPoint.phi) * Math.sin(tangentPoint.theta),
    z: Math.cos(tangentPoint.phi),
  };

  const [X, Y] = planePoint; // Plane point

  // Handle the special case when the tangent point is the North Pole
  if (tangentPoint.phi === 0) {
    const sphereCartesian = {
      x: (2 * X) / (1 + X ** 2 + Y ** 2),
      y: (2 * Y) / (1 + X ** 2 + Y ** 2),
      z: (1 - X ** 2 - Y ** 2) / (1 + X ** 2 + Y ** 2),
    };

    const r = Math.sqrt(
      sphereCartesian.x ** 2 + sphereCartesian.y ** 2 + sphereCartesian.z ** 2,
    ); // Should be 1 for a unit sphere
    const theta = Math.atan2(sphereCartesian.y, sphereCartesian.x);
    const phi = Math.acos(sphereCartesian.z / r);

    return { theta, phi };
  }

  // General case: tangent point is not the North Pole
  const { x: tx, y: ty, z: tz } = tangentCartesian;

  // Plane point in Cartesian coordinates
  const planeCartesian = { x: X, y: Y, z: tz };

  // Direction vector from tangent point to plane point
  const direction = {
    x: planeCartesian.x - tx,
    y: planeCartesian.y - ty,
    z: planeCartesian.z - tz,
  };

  // Solve for the intersection of the line with the sphere
  const a = direction.x ** 2 + direction.y ** 2 + direction.z ** 2; // ||direction||^2
  const b = 2 * (tx * direction.x + ty * direction.y + tz * direction.z); // Dot product
  const c = tx ** 2 + ty ** 2 + tz ** 2 - 1; // Sphere equation ||P||^2 = 1

  const discriminant = b ** 2 - 4 * a * c;
  if (discriminant < 0) {
    throw new Error('No valid intersection with the sphere.');
  }

  const t = (-b - Math.sqrt(discriminant)) / (2 * a); // Smaller root

  // Intersection point on the sphere in Cartesian coordinates
  const sphereCartesian = {
    x: tx + t * direction.x,
    y: ty + t * direction.y,
    z: tz + t * direction.z,
  };

  // Convert back to spherical coordinates
  const r = Math.sqrt(
    sphereCartesian.x ** 2 + sphereCartesian.y ** 2 + sphereCartesian.z ** 2,
  ); // Should be 1 for a unit sphere
  const theta = Math.atan2(sphereCartesian.y, sphereCartesian.x);
  const phi = Math.acos(sphereCartesian.z / r);

  return { theta, phi };
}

// eslint-disable-next-line mocha/no-skipped-tests
describe.skip('stereoGraphicProjection', () => {
  it('should project and inverse project correctly', () => {
    const point = stereographicProjection(
      { phi: Math.PI / 2, theta: Math.PI / 2 },
      { phi: 0, theta: 0 },
    );
    const inverse = inverseStereographicProjection(
      { phi: Math.PI / 2, theta: Math.PI / 2 },
      point,
    );
    expect(inverse).to.eql({ phi: 0, theta: 0 });
  });

  it('should project and inverse project correctly', () => {
    const point = stereographicProjection(
      { phi: Math.PI / 2, theta: Math.PI / 2 },
      {
        phi: Math.PI / 3,
        theta: Math.PI / 3,
      },
    );
    const inverse = inverseStereographicProjection(
      { phi: Math.PI / 2, theta: Math.PI / 2 },
      point,
    );
    expect(inverse).to.eql({ phi: Math.PI / 3, theta: Math.PI / 3 });
  });
});

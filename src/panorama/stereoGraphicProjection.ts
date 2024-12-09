import { Coordinate } from 'ol/coordinate.js';

export type ImageCoordinates = {
  x: number;
  y: number;
};

/**
 * Stereographic projection with a custom tangent point (phi0, theta0, radius).
 * Formel _müsste_ kugelzentrisch sein.
 * @param point - The point on the sphere in radian [phi, theta].
 * @param origin - The tangent point coordinates [phi0, theta0].
 * @param {number} radius - Radius of the sphere.
 * @returns {} - The projected 2D coordinates {x, y}.
 */
export function stereographicProjectionWithTangentPoint(
  point: Coordinate,
  origin: Coordinate,
  radius = 1,
): Coordinate {
  const [phi, theta] = point;
  const [phi0, theta0] = origin;

  // Cartesian coordinates of the tangent point
  const x0 = radius * Math.sin(theta0) * Math.cos(phi0);
  const y0 = radius * Math.sin(theta0) * Math.sin(phi0);
  const z0 = radius * Math.cos(theta0);

  // Cartesian coordinates of the point to project
  const x = radius * Math.sin(theta) * Math.cos(phi);
  const y = radius * Math.sin(theta) * Math.sin(phi);
  const z = radius * Math.cos(theta);

  // Shift the origin to the tangent point
  const xPrime = x - x0;
  const yPrime = y - y0;
  const zPrime = z - z0;

  // Scale factor for projection
  const scaleFactor = 1 - zPrime / radius;

  if (scaleFactor === 0) {
    throw new Error('Projection is undefined: Point maps to infinity.');
  }

  // Projected coordinates
  const xCoord = xPrime / scaleFactor;
  const yCoord = yPrime / scaleFactor;

  return [xCoord, yCoord];
}

/**
 * Inverse stereographic projection with a custom tangent point (phi0, theta0, radius).
 * We use the cameras far plane as the projection plane, and the cameras center as the tangent point
 * the tangent point is 0, 0 on the tangent plane.
 *
 * we always project onto a unit sphere, so the radius is always 1.
 * @param point - The projected 2D coordinates {x, y}.
 * @param origin - The tangent point coordinates [phi0, theta0].
 * @param [radius] - Radius of the sphere.
 * @returns - The spherical coordinates [phi, theta].
 */
export function inverseStereographicProjectionWithTangentPoint(
  point: Coordinate,
  origin: Coordinate,
  radius = 1,
): Coordinate {
  const [x, y] = point;
  const [phi0, theta0] = origin;
  // Cartesian coordinates of the tangent point
  const x0 = radius * Math.sin(theta0) * Math.cos(phi0);
  const y0 = radius * Math.sin(theta0) * Math.sin(phi0);
  const z0 = radius * Math.cos(theta0);

  // Scale factor for projection
  const scaleFactor = 1 - (x * x + y * y) / (radius * radius);

  if (scaleFactor === 0) {
    throw new Error('Projection is undefined: Point maps to infinity.');
  }

  // Shift the origin back to the sphere's center
  const xPrime = x * scaleFactor + x0;
  const yPrime = y * scaleFactor + y0;
  const zPrime = radius * (1 + scaleFactor) + z0;

  // Convert Cartesian coordinates back to spherical coordinates
  const phi = Math.atan2(yPrime, xPrime);
  const theta = Math.atan2(
    Math.sqrt(xPrime * xPrime + yPrime * yPrime),
    zPrime,
  );

  return [phi, theta];
}

/**
 * Berechnet den scaleFactor basierend auf den maximalen und minimalen projizierten Koordinaten,
 * um sicherzustellen, dass alle projizierten Punkte in das Bild passen.
 *
 * @param {Array} points - Liste der Punkte, die projiziert werden (array von {phi, theta}).
 * @param {number} radius - Radius der Kugel.
 * @param {number} phi0 - Azimutalwinkel des Tangentenpunkts.
 * @param {number} theta0 - Polarwinkel des Tangentenpunkts.
 * @param {number} width - Breite des Bildes in Pixeln.
 * @param {number} height - Höhe des Bildes in Pixeln.
 * @returns {number} - Der berechnete scaleFactor.
 */
function calculateScaleFactor(
  points: { phi: number; theta: number }[],
  radius: number,
  phi0: number,
  theta0: number,
  width: number,
  height: number,
) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  // Durchlaufe alle Punkte und projiziere sie
  points.forEach(({ phi, theta }) => {
    const [x, y] = stereographicProjectionWithTangentPoint(
      [phi, theta],
      [phi0, theta0],
      radius,
    );

    // Bestimme die minimalen und maximalen projizierten Koordinaten
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });

  // Berechne die maximalen Distanzen auf der X- und Y-Achse
  const xRange = maxX - minX;
  const yRange = maxY - minY;

  // Berechne den scaleFactor, so dass die projizierten Punkte im Bildbereich liegen
  const scaleX = width / xRange;
  const scaleY = height / yRange;

  // Der scaleFactor ist der kleinere der beiden Werte, um sicherzustellen, dass alle Punkte passen
  const scaleFactor = Math.min(scaleX, scaleY);

  return scaleFactor;
}

/**
 * Wandelt projizierte Koordinaten in Pixelkoordinaten um.
 *
 * @param {number} x - X-Koordinate aus der stereografischen Projektion.
 * @param {number} y - Y-Koordinate aus der stereografischen Projektion.
 * @param {number} width - Breite des Bildes in Pixeln.
 * @param {number} height - Höhe des Bildes in Pixeln.
 * @param {number} scaleFactor - Skalierungsfaktor.
 * @returns {Object} - Die Pixelkoordinaten {xPixel, yPixel}.
 */
function projectToPixelCoordinates(
  x: number,
  y: number,
  width: number,
  height: number,
  scaleFactor: number,
) {
  const centerX = width / 2;
  const centerY = height / 2;

  const xPixel = centerX + x * scaleFactor;
  const yPixel = centerY - y * scaleFactor; // Flip Y for image coordinates

  return { xPixel, yPixel };
}

// Beispiel für Punkte, die projiziert werden sollen
const points = [
  { phi: 0, theta: 0.34906 }, // Ecke oben links (0°, 20°)
  { phi: 0.17453, theta: 0.34906 }, // Ecke oben rechts (10°, 20°)
  { phi: 0.17453, theta: 0.17453 }, // Ecke unten rechts (10°, 10°)
  { phi: 0, theta: 0.17453 }, // Ecke unten links (0°, 10°)
];

// Parameter
const radius = 1; // Beispiel-Radius der Kugel
const phi0 = 0.08727; // Tangentenpunkt Azimut
const theta0 = 0.2618; // Tangentenpunkt Polarwinkel
const width = 1000; // Bildbreite in Pixel
const height = 600; // Bildhöhe in Pixel

// Berechne den scaleFactor
const scaleFactor = calculateScaleFactor(
  points,
  radius,
  phi0,
  theta0,
  width,
  height,
);

// Projektion der Punkte auf das Bild
points.forEach(({ phi, theta }) => {
  const [x, y] = stereographicProjectionWithTangentPoint(
    [phi, theta],
    [phi0, theta0],
    radius,
  );
  const pixelCoords = projectToPixelCoordinates(
    x,
    y,
    width,
    height,
    scaleFactor,
  );

  console.log(
    `Pixel-Koordinaten für Punkt (phi: ${phi}, theta: ${theta}):`,
    pixelCoords,
  );
});

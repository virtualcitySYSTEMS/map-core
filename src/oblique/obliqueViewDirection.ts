export enum ObliqueViewDirection {
  NORTH = 1,
  EAST = 2,
  SOUTH = 3,
  WEST = 4,
  NADIR = 5,
}

export const obliqueViewDirectionNames = {
  north: ObliqueViewDirection.NORTH,
  east: ObliqueViewDirection.EAST,
  south: ObliqueViewDirection.SOUTH,
  west: ObliqueViewDirection.WEST,
  nadir: ObliqueViewDirection.NADIR,
};

export function getDirectionName(
  direction: ObliqueViewDirection,
): string | undefined {
  const entry = Object.entries(obliqueViewDirectionNames).find(
    ([, namedDirection]) => namedDirection === direction,
  );

  return entry?.[0];
}

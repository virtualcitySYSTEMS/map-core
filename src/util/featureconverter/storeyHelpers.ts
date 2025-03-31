import type { HeightReference } from '@vcmap-cesium/engine';
import type {
  RelativeHeightReference,
  VectorHeightInfo,
} from './vectorHeightInfo.js';

/**
 * @param  extrudedHeight should be a number > 0
 * @param  storeyHeights
 * @param  storeyNumber
 */
export function getStoreyHeights(
  extrudedHeight: number,
  storeyHeights: number[],
  storeyNumber: number,
): number[] {
  const positiveExtrudedHeight = Math.abs(extrudedHeight);
  const fittedStoreyHeights = [];
  if (storeyHeights.length) {
    let height = 0;
    for (let i = 0; i < storeyHeights.length; i++) {
      height += storeyHeights[i];
      if (height < positiveExtrudedHeight) {
        fittedStoreyHeights.push(storeyHeights[i]);
      } else {
        fittedStoreyHeights.push(
          storeyHeights[i] - (height - positiveExtrudedHeight),
        );
        return fittedStoreyHeights;
      }
    }
    const lastStoreyHeight = storeyHeights[storeyHeights.length - 1];
    while (height < positiveExtrudedHeight) {
      height += lastStoreyHeight;
      if (height < positiveExtrudedHeight) {
        fittedStoreyHeights.push(lastStoreyHeight);
      } else {
        fittedStoreyHeights.push(
          lastStoreyHeight - (height - positiveExtrudedHeight),
        );
        return fittedStoreyHeights;
      }
    }
  } else if (storeyNumber) {
    return new Array(storeyNumber).fill(
      positiveExtrudedHeight / storeyNumber,
    ) as number[];
  }
  // case no predefined storeyHeights
  return [positiveExtrudedHeight];
}

export function validateStoreys(
  storeys: number,
  storeyHeights: number[],
): void {
  if (storeys && storeyHeights.length) {
    const missingStoreyHeights = storeys - storeyHeights.length;
    if (missingStoreyHeights > 0) {
      storeyHeights.push(
        ...(new Array(missingStoreyHeights).fill(
          storeyHeights[storeyHeights.length - 1],
        ) as number[]),
      );
    } else if (missingStoreyHeights < 0) {
      storeyHeights.splice(storeyHeights.length + missingStoreyHeights);
    }
    if (storeys > 100) {
      storeyHeights.splice(100);
    }
  } else {
    storeyHeights.splice(0);
  }
}

export type StoreyOptions = { currentHeight: number; extrudedHeight: number };

export function getStoreyOptions(
  heightInfo: VectorHeightInfo<RelativeHeightReference | HeightReference.NONE>,
  geometryHeight: number,
): { storeys: StoreyOptions[]; skirtLevel: number } {
  const options: StoreyOptions[] = [];
  let currentHeight = geometryHeight;
  heightInfo.storeyHeightsAboveGround.forEach((storeyHeight) => {
    const extrudedHeight = currentHeight + storeyHeight;
    options.push({
      currentHeight,
      extrudedHeight,
    });
    currentHeight = extrudedHeight;
  });

  currentHeight = geometryHeight;
  heightInfo.storeyHeightsBelowGround.forEach((storeyHeight) => {
    const extrudedHeight = currentHeight - storeyHeight;
    options.push({
      currentHeight,
      extrudedHeight,
    });
    currentHeight = extrudedHeight;
  });

  return { storeys: options, skirtLevel: currentHeight };
}

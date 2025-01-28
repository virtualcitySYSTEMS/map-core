import { fromUrl, GeoTIFF, GeoTIFFImage } from 'geotiff';
import { Cartesian3 } from '@vcmap-cesium/engine';
import {
  createPanoramaTile,
  PanoramaTile,
  TileCoordinate,
  TileSize,
} from './panoramaTile.js';
import type { TileLoadStrategy } from './panoramaTileProvider.js';
/*
type HeaderEntry = {
  tag: number;
  type: number;
  count: number;
  valueOffset: number;
};

const typeSizes = new Map([
  [1, 1],
  [2, 1], // BYTE // ASCII
  [3, 2], // SHORT
  [4, 4], // LONG
  [5, 8], // RATIONAL
  [12, 8],
  // Add other types as needed
]);

async function readHeaderValue(
  image: GeoTIFF,
  entry: HeaderEntry,
): Promise<{ type: number; value: number | number[] }> {
  const values: number[] = [];
  const size = typeSizes.get(entry.type)!;
  const data = await image.getSlice(entry.valueOffset, entry.count * size);
  const dataView = new DataView(data.buffer);

  const isInlineData = entry.count * size <= 4;

  for (let i = 0; i < entry.count; i++) {
    let value;
    switch (entry.type) {
      case 1: // BYTE
      case 2: // ASCII
        value = isInlineData
          ? (entry.valueOffset >> (i * 8)) & 0xff
          : dataView.getUint8(i * size);
        break;
      case 3: // SHORT
        value = isInlineData
          ? (entry.valueOffset >> (i * 16)) & 0xffff
          : dataView.getUint16(i * size, true);
        break;
      case 4: // LONG
        value = isInlineData
          ? entry.valueOffset
          : dataView.getUint32(i * size, true);
        break;
      case 5: // RATIONAL (two LONGs)
        value =
          dataView.getUint32(i * size, true) /
          dataView.getUint32(i * size + 4, true);
        break;
      case 12:
        value = dataView.getFloat64(i * size, true);
        break;
      default:
        throw new Error(`Unsupported type: ${entry.type}`);
    }
    values.push(value);
  }

  return {
    type: entry.type,
    value: entry.count === 1 ? values[0] : values,
  };
}

async function parseGeoTIFFHeaders(image: GeoTIFF): Promise<void> {
  // Read the GeoTIFF file into a buffer

  // TIFF header is at the beginning of the file

  const ifd = await image.getSlice(image.firstIFDOffset, 2);
  const entries = new Uint16Array(ifd.buffer)[0];

  const readEntry = async (offset: number, i: number): Promise<HeaderEntry> => {
    const entry = await image.getSlice(offset, 12);
    const tag = new Uint16Array(entry.buffer.slice(0, 2))[0];
    const type = new Uint16Array(entry.buffer.slice(2, 4))[0];
    const count = new Uint32Array(entry.buffer.slice(4, 8))[0];
    const valueOffset = new Uint32Array(entry.buffer.slice(8, 12))[0];

    return {
      tag,
      type,
      count,
      valueOffset,
    };
  };

  const headers = [];
  for (let i = 0; i < entries; i++) {
    const entry = await readEntry(image.firstIFDOffset + 2 + i * 12, i);
    headers.push(await readHeaderValue(image, entry));
  }

  console.log(await image.getImageCount());
  const i1 = await image.getImage(3);
  console.log(i1.getFileDirectory());
  console.log(i1.getGeoKeys());

  /*
  const magicNumber = readUInt16LE(buffer, 2);
  const ifdOffset = readUInt32LE(buffer, 4);

  console.log('Byte Order:', byteOrder);
  console.log('Magic Number:', magicNumber);
  console.log('IFD Offset:', ifdOffset);

  // Read the Image File Directory (IFD) entries
  const numEntries = readUInt16LE(buffer, ifdOffset);
  console.log('Number of IFD Entries:', numEntries);

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    const tag = readUInt16LE(buffer, entryOffset);
    const type = readUInt16LE(buffer, entryOffset + 2);
    const count = readUInt32LE(buffer, entryOffset + 4);
    const valueOffset = readUInt32LE(buffer, entryOffset + 8);

    console.log(
      `Entry ${
        i + 1
      } - Tag: ${tag}, Type: ${type}, Count: ${count}, Value Offset: ${valueOffset}`,
    );
  }
}
*/

async function fetchImages(
  rootUrl: string,
): Promise<{ image: GeoTIFF; rgb: GeoTIFFImage[] }> {
  const image = await fromUrl(rootUrl);
  let imageCount = await image.getImageCount();
  const promises = [];
  while (imageCount) {
    imageCount -= 1;
    promises.push(image.getImage(imageCount));
  }
  const rgb = await Promise.all(promises);
  return { image, rgb };
}

function getImageDataFromRGBReadRaster(
  readRaster: Uint8Array,
  tileSize: TileSize,
): ImageData {
  const clampedArray = new Uint8ClampedArray((readRaster.length / 3) * 4);
  clampedArray.fill(255);
  for (let i = 0; i < readRaster.length; i += 3) {
    clampedArray[(i / 3) * 4] = readRaster[i];
    clampedArray[(i / 3) * 4 + 1] = readRaster[i + 1];
    clampedArray[(i / 3) * 4 + 2] = readRaster[i + 2];
  }
  return new ImageData(clampedArray, tileSize[0], tileSize[1]);
}

export function createCogLoadingStrategy(
  rootUrl: string,
  origin: Cartesian3,
  tileSize: TileSize,
): TileLoadStrategy {
  const ready = fetchImages(rootUrl);

  return {
    async loadTile(
      tileCoordinate: TileCoordinate,
      abort: AbortSignal,
    ): Promise<PanoramaTile | null | Error> {
      const { rgb } = await ready;
      const levelImage = rgb[tileCoordinate.level];
      if (levelImage) {
        const tileImage = await levelImage.readRGB({
          window: [
            tileCoordinate.x * tileSize[0],
            tileCoordinate.y * tileSize[1],
            (tileCoordinate.x + 1) * tileSize[0],
            (tileCoordinate.x + 1) * tileSize[1],
          ],
          width: tileSize[0],
          height: tileSize[1],
          signal: abort,
          enableAlpha: true,
        });
        const image = await createImageBitmap(
          getImageDataFromRGBReadRaster(tileImage as Uint8Array, tileSize),
        );

        return createPanoramaTile(tileCoordinate, image, origin, tileSize);
      }
      return null;
    },
    destroy(): void {
      ready
        .then(({ rgb, image }) => {
          image.close(); // not entirely sure how to clear these things.
          rgb.length = 0;
        })
        .catch((e) => {
          console.error(e);
        });
    },
  };
}

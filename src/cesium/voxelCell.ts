import type { VoxelPrimitive, OrientedBoundingBox } from '@vcmap-cesium/engine';
import { Cartesian3, VoxelCell, VoxelShapeType } from '@vcmap-cesium/engine';
import { vcsLayerName } from '../layer/layerSymbols.js';

/**
 * Cesium's VoxelMetadataOrder.Y_UP is not exported. Box 3D Tiles voxel
 * providers always use this value.
 */
const VOXEL_METADATA_ORDER_Y_UP = 1;

type VoxelCellWithObb = VoxelCell & {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _orientedBoundingBox: OrientedBoundingBox;
};

type VoxelPrimitiveWithInternals = VoxelPrimitive & {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _inputDimensions: Cartesian3;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _paddingBefore: Cartesian3;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _shape: {
    computeOrientedBoundingBoxForSample(
      spatialNode: unknown,
      dimensions: Cartesian3,
      tileUv: Cartesian3,
      result: OrientedBoundingBox,
    ): OrientedBoundingBox;
  };
  provider: VoxelPrimitive['provider'] & {
    metadataOrder?: number;
  };
};

type VoxelCellStatic = typeof VoxelCell & {
  fromKeyframeNode(
    primitive: VoxelPrimitive,
    tileIndex: number,
    sampleIndex: number,
    keyframeNode: { spatialNode: unknown },
  ): VoxelCell;
};

/**
 * Cesium packs pickVoxel sampleIndex in glTF Y-up input space, but rebuilds
 * the cell OBB as if the index were Z-up. Invert that remap for box tilesets
 * so orientedBoundingBox.center matches the clicked cell.
 */
function correctYUpBoxOrientedBoundingBox(
  primitive: VoxelPrimitiveWithInternals,
  spatialNode: unknown,
  sampleIndex: number,
  result: OrientedBoundingBox,
): OrientedBoundingBox {
  if (
    primitive.provider.metadataOrder !== VOXEL_METADATA_ORDER_Y_UP ||
    primitive.shape !== VoxelShapeType.BOX
  ) {
    return result;
  }

  // eslint-disable-next-line no-underscore-dangle
  const inputDim = primitive._inputDimensions;
  const slice = inputDim.x * inputDim.y;
  const inputZ = Math.floor(sampleIndex / slice);
  const indexInSlice = sampleIndex - inputZ * slice;
  const inputY = Math.floor(indexInSlice / inputDim.x);
  const inputX = indexInSlice - inputY * inputDim.x;

  // Inverse of Octree.glsl Y_UP + SHAPE_BOX:
  //   input.y = shape.z
  //   input.z = inputDim.z - shape.y
  const paddedCoordinate = Cartesian3.fromElements(
    inputX,
    inputDim.z - 1 - inputZ,
    inputY,
  );
  const tileUv = Cartesian3.divideComponents(
    Cartesian3.subtract(
      paddedCoordinate,
      // eslint-disable-next-line no-underscore-dangle
      primitive._paddingBefore,
      paddedCoordinate,
    ),
    primitive.dimensions,
    paddedCoordinate,
  );

  // eslint-disable-next-line no-underscore-dangle
  return primitive._shape.computeOrientedBoundingBoxForSample(
    spatialNode,
    primitive.dimensions,
    tileUv,
    result,
  );
}

const voxelCellStatic = VoxelCell as VoxelCellStatic;
const originalFromKeyframeNode =
  voxelCellStatic.fromKeyframeNode.bind(VoxelCell);

/** XXX This fix can be removed as soon as Cesium fixes this axis orientation bug. */
voxelCellStatic.fromKeyframeNode = function fromKeyframeNode(
  primitive,
  tileIndex,
  sampleIndex,
  keyframeNode,
): VoxelCell {
  const cell = originalFromKeyframeNode(
    primitive,
    tileIndex,
    sampleIndex,
    keyframeNode,
  ) as VoxelCellWithObb;
  // eslint-disable-next-line no-underscore-dangle
  cell._orientedBoundingBox = correctYUpBoxOrientedBoundingBox(
    primitive as VoxelPrimitiveWithInternals,
    keyframeNode.spatialNode,
    sampleIndex,
    // eslint-disable-next-line no-underscore-dangle
    cell._orientedBoundingBox,
  );
  return cell;
};

VoxelCell.prototype.getId = function getId(this: VoxelCell): string {
  return `${this.primitive[vcsLayerName] ?? 'voxel'}:${this.tileIndex}:${this.sampleIndex}`;
};

VoxelCell.prototype.getAttributes = function getAttributes(
  this: VoxelCell,
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  this.getNames().forEach((name) => {
    attributes[name] = this.getProperty(name);
  });
  return attributes;
};

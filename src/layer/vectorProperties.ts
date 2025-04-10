import deepEqual from 'fast-deep-equal';
import type { Feature } from 'ol';
import {
  type BoxGeometry,
  Cartesian3,
  ClassificationType,
  type CylinderGeometry,
  type EllipsoidGeometry,
  HeightReference,
  NearFarScalar,
  type SphereGeometry,
} from '@vcmap-cesium/engine';
import { check, maybe, ofEnum } from '@vcsuite/check';
import type { Coordinate } from 'ol/coordinate.js';
import type { Color } from 'ol/color.js';
import type { ColorLike } from 'ol/colorlike.js';
import {
  parseBoolean,
  parseEnumKey,
  parseInteger,
  parseNumber,
} from '@vcsuite/parsers';
import { getLogger as getLoggerByName, type Logger } from '@vcsuite/logger';
import VcsEvent from '../vcsEvent.js';
import type { DeclarativeStyleItemOptions } from '../style/declarativeStyleItem.js';
import type { VectorStyleItemOptions } from '../style/vectorStyleItem.js';
import type { FlightInstanceMeta } from '../util/flight/flightInstance.js';

function getLogger(): Logger {
  return getLoggerByName('VectorProperties');
}

export enum PrimitiveOptionsType {
  CYLINDER = 'cylinder',
  SPHERE = 'sphere',
  ELLIPSOID = 'ellipsoid',
  BOX = 'box',
}

export type VectorPropertiesGeometryOptions<T extends PrimitiveOptionsType> =
  T extends PrimitiveOptionsType.CYLINDER
    ? ConstructorParameters<typeof CylinderGeometry>[0]
    : T extends PrimitiveOptionsType.SPHERE
      ? ConstructorParameters<typeof SphereGeometry>[0]
      : T extends PrimitiveOptionsType.ELLIPSOID
        ? ConstructorParameters<typeof EllipsoidGeometry>[0]
        : T extends PrimitiveOptionsType.BOX
          ? ConstructorParameters<typeof BoxGeometry>[0]
          : never;

export type VectorPropertiesPrimitiveOptions<
  T extends PrimitiveOptionsType = PrimitiveOptionsType,
> = {
  type: T;
  /**
   * the options for the specified geometry
   */
  geometryOptions: VectorPropertiesGeometryOptions<T>;
  depthFailColor?: Color | ColorLike;
  /**
   * an offset to apply to the geometry
   */
  offset?: Coordinate;
  /**
   * additional options passed to the Primitive constructor
   */
  additionalOptions?: Record<string, unknown>;
};

export function vectorPropertiesOfType<T extends PrimitiveOptionsType>(
  options: VectorPropertiesPrimitiveOptions,
  type: T,
): options is VectorPropertiesPrimitiveOptions<T> {
  return options.type === type;
}

export type AltitudeModeType =
  | 'absolute'
  | 'relativeToGround'
  | 'relativeToTerrain'
  | 'relativeTo3DTiles'
  | 'clampToGround'
  | 'clampToTerrain'
  | 'clampTo3DTiles';

export type ClassificationTypeType = 'both' | 'terrain' | 'cesium3DTile';

export type VectorPropertiesOptions = {
  /**
   * (3D) Either "relativeToGround", "clampToGround" or 'absolute'
   */
  altitudeMode?: AltitudeModeType;
  /**
   * if the features are pickable
   */
  allowPicking?: boolean;
  /**
   * (3D) the cesium classification type for this layer. one of 'both', 'terrain' or 'cesium3DTile'
   */
  classificationType?: ClassificationTypeType;
  /**
   * (3D) Array with 4 numbers by which features are being scaled based on distance see <a href="https://cesium.com/docs/cesiumjs-ref-doc/Billboard.html#scaleByDistance"> here </a>
   */
  scaleByDistance?: number[];
  /**
   * (3D) Array with 3 numbers see for explanation: <a href="https://cesium.com/docs/cesiumjs-ref-doc/Billboard.html#eyeOffset"> here </a>
   */
  eyeOffset?: number[];
  /**
   * (3D) can be used with altitudeMode relativeToGround
   */
  heightAboveGround?: number;
  /**
   * (3D) default skirt value to use for extruded features
   */
  skirt?: number;
  /**
   * (3D) ground height level of the objects
   */
  groundLevel?: number;
  /**
   * (3D) - default layer extruded Height
   */
  extrudedHeight?: number;
  storeysAboveGround?: number;
  storeysBelowGround?: number;
  storeyHeightsAboveGround?: number[] | number;
  storeyHeightsBelowGround?: number[] | number;
  modelUrl?: string;
  modelScaleX?: number;
  modelScaleY?: number;
  modelScaleZ?: number;
  /**
   * in degrees
   */
  modelHeading?: number;
  /**
   * in degrees
   */
  modelPitch?: number;
  /**
   * in degrees
   */
  modelRoll?: number;
  modelAutoScale?: boolean;
  /**
   * Model options are merged with the model definition from model url, scale and orientation and accepts any option passed to a Cesium.Model.
   */
  modelOptions?: Record<string, unknown>;
  /**
   * primitive options to render in 3D instead of a billboard
   */
  primitiveOptions?: VectorPropertiesPrimitiveOptions;
  /**
   * a base URL to resolve relative model URLs against.
   */
  baseUrl?: string;
};

export type PropertyChangedKey = Exclude<
  keyof VectorProperties,
  'propertyChanged'
>;

export type VcsMeta = VectorPropertiesOptions & {
  /**
   * The version of the schema
   */
  version: string;
  style?: VectorStyleItemOptions | DeclarativeStyleItemOptions;
  embeddedIcons?: string[];
  screenSpaceError?: number;
  flightOptions?: FlightInstanceMeta;
  baseUrl?: string;
  /**
   * the layers properties bag
   */
  layerProperties?: Record<string, unknown>;
};

export type VectorPropertiesBaseOptions = {
  scale: number[];
  heading: number;
  pitch: number;
  roll: number;
  autoScale: boolean;
};

export type VectorPropertiesModelOptions = VectorPropertiesBaseOptions & {
  url: string;
};

export type VectorPropertiesPrimitive = VectorPropertiesBaseOptions & {
  primitiveOptions: VectorPropertiesPrimitiveOptions;
};

/**
 * The version of vcsMeta schema being written by this helper
 */
export const vcsMetaVersion = '2.1';

// legacy
// eslint-disable-next-line @typescript-eslint/naming-convention
export const AltitudeModeCesium: Record<AltitudeModeType, HeightReference> = {
  clampToGround: HeightReference.CLAMP_TO_GROUND,
  clampTo3DTiles: HeightReference.CLAMP_TO_3D_TILE,
  clampToTerrain: HeightReference.CLAMP_TO_TERRAIN,
  absolute: HeightReference.NONE,
  relativeToGround: HeightReference.RELATIVE_TO_GROUND,
  relativeTo3DTiles: HeightReference.RELATIVE_TO_3D_TILE,
  relativeToTerrain: HeightReference.RELATIVE_TO_TERRAIN,
};

// legacy
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ClassificationTypeCesium: Record<
  ClassificationTypeType,
  ClassificationType
> = {
  both: ClassificationType.BOTH,
  cesium3DTile: ClassificationType.CESIUM_3D_TILE,
  terrain: ClassificationType.TERRAIN,
};

export function parseNearFarScalar(
  value?: unknown,
  defaultValue?: NearFarScalar,
): NearFarScalar | undefined {
  if (Array.isArray(value)) {
    const valid = value
      .map((entry) => parseNumber(entry))
      .filter((entry) => entry != null);
    if (valid.length === 4) {
      return new NearFarScalar(valid[0], valid[1], valid[2], valid[3]);
    }
  }
  return defaultValue;
}

export function parseCartesian3(
  value?: unknown,
  defaultValue?: Cartesian3,
): Cartesian3 | undefined {
  if (Array.isArray(value)) {
    const valid = value
      .map((entry) => parseNumber(entry))
      .filter((entry) => entry != null);
    if (valid.length === 3) {
      return new Cartesian3(valid[0], valid[1], valid[2]);
    }
  }
  return defaultValue;
}

export function parseStoreyHeights(
  storeyHeights?: unknown,
  defaultStoreyHeights?: number[] | number,
): number[] {
  if (Array.isArray(storeyHeights)) {
    return storeyHeights
      .map((value) => parseNumber(value))
      .filter((value) => value != null && value > 0) as number[];
  } else {
    const numberValue = parseNumber(storeyHeights);
    if (numberValue && numberValue > 0) {
      return [numberValue];
    }
  }
  if (!defaultStoreyHeights) {
    return [];
  }
  if (!Array.isArray(defaultStoreyHeights)) {
    return [defaultStoreyHeights];
  }
  return defaultStoreyHeights;
}

export function getAltitudeModeOptions(
  altitudeMode: HeightReference,
): AltitudeModeType {
  for (const [key, mode] of Object.entries(AltitudeModeCesium) as [
    AltitudeModeType,
    HeightReference,
  ][]) {
    if (mode === altitudeMode) {
      return key;
    }
  }
  throw new Error(`Unknown altitude mode ${altitudeMode}`);
}

export function getClassificationTypeOptions(
  classificationType?: ClassificationType,
): ClassificationTypeType | undefined {
  for (const [key, mode] of Object.entries(ClassificationTypeCesium) as [
    ClassificationTypeType,
    ClassificationType,
  ][]) {
    if (mode === classificationType) {
      return key;
    }
  }
  return undefined;
}

export function getNearFarValueOptions(
  nearFarScalar?: NearFarScalar,
): number[] | undefined {
  return nearFarScalar ? NearFarScalar.pack(nearFarScalar, []) : undefined;
}

export function getCartesian3Options(
  cartesian3?: Cartesian3,
): number[] | undefined {
  return cartesian3 ? Cartesian3.pack(cartesian3, []) : undefined;
}

/**
 * Properties Collection for VectorLayer Features
 */
class VectorProperties {
  /**
   * Returns the default options for VectorProperties
   */
  static getDefaultOptions(): VectorPropertiesOptions {
    // implementation detail, be careful, defaultValues are not used everywhere, check in constructor and elsewhere
    return {
      altitudeMode: 'clampToGround',
      allowPicking: true,
      classificationType: undefined,
      scaleByDistance: undefined,
      eyeOffset: undefined,
      heightAboveGround: undefined,
      skirt: 0,
      groundLevel: undefined,
      extrudedHeight: 0,
      storeysAboveGround: 0,
      storeysBelowGround: 0,
      storeyHeightsAboveGround: [],
      storeyHeightsBelowGround: [],
      modelUrl: undefined,
      modelScaleX: 1,
      modelScaleY: 1,
      modelScaleZ: 1,
      modelHeading: 0,
      modelPitch: 0,
      modelRoll: 0,
      modelOptions: undefined,
      modelAutoScale: false,
      baseUrl: undefined,
      primitiveOptions: undefined,
    };
  }

  private _altitudeMode: HeightReference;

  private _allowPicking: boolean;

  private _classificationType: ClassificationType | undefined;

  private _scaleByDistance: NearFarScalar | undefined;

  private _eyeOffset: Cartesian3 | undefined;

  private _heightAboveGround: number | undefined;

  private _skirt: number;

  private _groundLevel: number | undefined;

  private _extrudedHeight: number;

  private _storeysAboveGround: number;

  private _storeysBelowGround: number;

  private _storeyHeightsAboveGround: number[];

  private _storeyHeightsBelowGround: number[];

  private _modelUrl: string | undefined;

  private _modelScaleX: number;

  private _modelScaleY: number;

  private _modelScaleZ: number;

  private _modelHeading: number;

  private _modelPitch: number;

  private _modelRoll: number;

  private _baseUrl: string | undefined;

  private _modelOptions: Record<string, unknown> | undefined;

  private _modelAutoScale: boolean;

  private _primitiveOptions: VectorPropertiesPrimitiveOptions | undefined;

  /**
   * Event raised when properties change. is passed an array of keys for the changed properties.
   * @readonly
   */
  readonly propertyChanged: VcsEvent<PropertyChangedKey[]>;

  /**
   * @param  options
   */
  constructor(options: VectorPropertiesOptions) {
    const defaultValues = VectorProperties.getDefaultOptions();
    this._altitudeMode = parseEnumKey(
      options.altitudeMode,
      AltitudeModeCesium,
      HeightReference.CLAMP_TO_GROUND,
    );

    this._allowPicking = parseBoolean(
      options.allowPicking,
      defaultValues.allowPicking,
    );

    this._classificationType = parseEnumKey(
      options.classificationType,
      ClassificationTypeCesium,
    );

    this._scaleByDistance = parseNearFarScalar(
      options.scaleByDistance,
      undefined,
    );

    this._eyeOffset = parseCartesian3(options.eyeOffset, undefined);

    this._heightAboveGround = parseNumber(
      options.heightAboveGround,
      defaultValues.heightAboveGround,
    );

    this._skirt = parseNumber(options.skirt, defaultValues.skirt);

    this._groundLevel = parseNumber(
      options.groundLevel,
      defaultValues.groundLevel,
    );

    this._extrudedHeight = parseNumber(
      options.extrudedHeight,
      defaultValues.extrudedHeight,
    );

    this._storeysAboveGround = parseInteger(
      options.storeysAboveGround,
      defaultValues.storeysAboveGround,
    );

    this._storeysBelowGround = parseInteger(
      options.storeysBelowGround,
      defaultValues.storeysBelowGround,
    );

    this._storeyHeightsAboveGround = parseStoreyHeights(
      options.storeyHeightsAboveGround,
      defaultValues.storeyHeightsAboveGround,
    );

    this._storeyHeightsBelowGround = parseStoreyHeights(
      options.storeyHeightsBelowGround,
      defaultValues.storeyHeightsBelowGround,
    );

    this._modelUrl = options.modelUrl ?? defaultValues.modelUrl;

    this._modelScaleX = parseNumber(
      options.modelScaleX,
      defaultValues.modelScaleX,
    );

    this._modelScaleY = parseNumber(
      options.modelScaleY,
      defaultValues.modelScaleY,
    );

    this._modelScaleZ = parseNumber(
      options.modelScaleZ,
      defaultValues.modelScaleZ,
    );

    this._modelHeading = parseNumber(
      options.modelHeading,
      defaultValues.modelHeading,
    );

    this._modelPitch = parseNumber(
      options.modelPitch,
      defaultValues.modelPitch,
    );

    this._modelRoll = parseNumber(options.modelRoll, defaultValues.modelRoll);

    this._baseUrl = options.baseUrl ?? defaultValues.baseUrl;

    this._modelOptions = options.modelOptions || defaultValues.modelOptions;

    this._modelAutoScale = parseBoolean(
      options.modelAutoScale,
      defaultValues.modelAutoScale,
    );

    this._primitiveOptions =
      options.primitiveOptions || defaultValues.primitiveOptions;

    this.propertyChanged = new VcsEvent();
  }

  get altitudeMode(): HeightReference {
    return this._altitudeMode;
  }

  set altitudeMode(altitudeMode: HeightReference) {
    if (altitudeMode !== this._altitudeMode) {
      check(altitudeMode, ofEnum(HeightReference));
      this._altitudeMode = altitudeMode;
      this.propertyChanged.raiseEvent(['altitudeMode']);
    }
  }

  getAltitudeMode(feature: Feature): HeightReference {
    return parseEnumKey(
      feature.get('olcs_altitudeMode'),
      AltitudeModeCesium,
      this._altitudeMode,
    );
  }

  get allowPicking(): boolean {
    return this._allowPicking;
  }

  set allowPicking(allowPicking: boolean) {
    if (allowPicking !== this._allowPicking) {
      check(allowPicking, Boolean);
      this._allowPicking = allowPicking;
      this.propertyChanged.raiseEvent(['allowPicking']);
    }
  }

  getAllowPicking(feature: Feature): boolean {
    const allowPicking = feature.get('olcs_allowPicking') as unknown;
    return parseBoolean(allowPicking, this._allowPicking);
  }

  get classificationType(): ClassificationType | undefined {
    return this._classificationType;
  }

  set classificationType(classificationType: ClassificationType | undefined) {
    if (classificationType !== this._classificationType) {
      check(classificationType, maybe(ofEnum(ClassificationType)));
      this._classificationType = classificationType;
      this.propertyChanged.raiseEvent(['classificationType']);
    }
  }

  getClassificationType(feature: Feature): ClassificationType | undefined {
    return parseEnumKey(
      feature.get('olcs_classificationType'),
      ClassificationTypeCesium,
      this.classificationType,
    );
  }

  get scaleByDistance(): NearFarScalar | undefined {
    return this._scaleByDistance;
  }

  set scaleByDistance(value: NearFarScalar | undefined) {
    if (!NearFarScalar.equals(value, this._scaleByDistance)) {
      check(value, maybe(NearFarScalar));
      this._scaleByDistance = value;
      this.propertyChanged.raiseEvent(['scaleByDistance']);
    }
  }

  getScaleByDistance(feature: Feature): NearFarScalar | undefined {
    return parseNearFarScalar(
      feature.get('olcs_scaleByDistance'),
      this.scaleByDistance,
    );
  }

  get eyeOffset(): Cartesian3 | undefined {
    return this._eyeOffset;
  }

  set eyeOffset(value: Cartesian3 | undefined) {
    if (!Cartesian3.equals(this.eyeOffset, value)) {
      check(value, maybe(Cartesian3));
      this._eyeOffset = value;
      this.propertyChanged.raiseEvent(['eyeOffset']);
    }
  }

  getEyeOffset(feature: Feature): Cartesian3 | undefined {
    const featureValue = feature.get('olcs_eyeOffset') as unknown;
    if (!featureValue) {
      const zCoordinateEyeOffset = feature.get(
        'olcs_zCoordinateEyeOffset',
      ) as unknown;
      if (zCoordinateEyeOffset) {
        getLogger().deprecate(
          'zCoordinateEyeOffset',
          'use eyeOffset and provide [0,0,value]',
        );
        return new Cartesian3(0, 0, parseNumber(zCoordinateEyeOffset, 0));
      }
    }
    return parseCartesian3(featureValue, this.eyeOffset);
  }

  get heightAboveGround(): number | undefined {
    return this._heightAboveGround;
  }

  set heightAboveGround(value: number | undefined) {
    if (value !== this._heightAboveGround) {
      check(value, maybe(Number));
      this._heightAboveGround = value;
      this.propertyChanged.raiseEvent(['heightAboveGround']);
    }
  }

  getHeightAboveGround(feature: Feature): number | undefined {
    return parseNumber(
      feature.get('olcs_heightAboveGround'),
      this.heightAboveGround,
    );
  }

  get skirt(): number {
    return this._skirt;
  }

  set skirt(value: number) {
    if (value !== this._skirt) {
      check(value, Number);
      this._skirt = value;
      this.propertyChanged.raiseEvent(['skirt']);
    }
  }

  getSkirt(feature: Feature): number {
    return parseNumber(feature.get('olcs_skirt'), this.skirt);
  }

  get groundLevel(): number | undefined {
    return this._groundLevel;
  }

  set groundLevel(value: number | undefined) {
    if (value !== this._groundLevel) {
      check(value, maybe(Number));
      this._groundLevel = value;
      this.propertyChanged.raiseEvent(['groundLevel']);
    }
  }

  getGroundLevel(feature: Feature): number | undefined {
    return parseNumber(feature.get('olcs_groundLevel'), this.groundLevel);
  }

  get extrudedHeight(): number {
    return this._extrudedHeight;
  }

  set extrudedHeight(value: number) {
    if (value !== this._extrudedHeight) {
      check(value, Number);
      this._extrudedHeight = value;
      this.propertyChanged.raiseEvent(['extrudedHeight']);
    }
  }

  getExtrudedHeight(feature: Feature): number {
    return parseNumber(feature.get('olcs_extrudedHeight'), this.extrudedHeight);
  }

  get storeysAboveGround(): number {
    return this._storeysAboveGround;
  }

  set storeysAboveGround(value: number) {
    if (value !== this._storeysAboveGround) {
      check(value, Number);
      this._storeysAboveGround = Math.trunc(value);
      this.propertyChanged.raiseEvent(['storeysAboveGround']);
    }
  }

  getStoreysAboveGround(feature: Feature): number {
    return parseInteger(
      feature.get('olcs_storeysAboveGround'),
      this.storeysAboveGround,
    );
  }

  get storeysBelowGround(): number {
    return this._storeysBelowGround;
  }

  set storeysBelowGround(value: number) {
    if (value !== this._storeysBelowGround) {
      check(value, Number);
      this._storeysBelowGround = Math.trunc(value);
      this.propertyChanged.raiseEvent(['storeysBelowGround']);
    }
  }

  getStoreysBelowGround(feature: Feature): number {
    return parseInteger(
      feature.get('olcs_storeysBelowGround'),
      this.storeysBelowGround,
    );
  }

  get storeyHeightsAboveGround(): number[] {
    return this._storeyHeightsAboveGround.slice();
  }

  set storeyHeightsAboveGround(value: number[]) {
    if (!deepEqual(value, this._storeyHeightsAboveGround)) {
      check(value, [Number]);
      this._storeyHeightsAboveGround = value;
      this.propertyChanged.raiseEvent(['storeyHeightsAboveGround']);
    }
  }

  getStoreyHeightsAboveGround(feature: Feature): number[] {
    return parseStoreyHeights(
      feature.get('olcs_storeyHeightsAboveGround'),
      this.storeyHeightsAboveGround,
    );
  }

  get storeyHeightsBelowGround(): number[] {
    return this._storeyHeightsBelowGround.slice();
  }

  set storeyHeightsBelowGround(value: number[]) {
    if (!deepEqual(value, this._storeyHeightsBelowGround)) {
      check(value, [Number]);
      this._storeyHeightsBelowGround = value;
      this.propertyChanged.raiseEvent(['storeyHeightsBelowGround']);
    }
  }

  getStoreyHeightsBelowGround(feature: Feature): number[] {
    return parseStoreyHeights(
      feature.get('olcs_storeyHeightsBelowGround'),
      this.storeyHeightsBelowGround,
    );
  }

  get modelUrl(): string | undefined {
    return this._modelUrl;
  }

  set modelUrl(value: string | undefined) {
    check(value, maybe(String));

    if (this._modelUrl !== value) {
      this._modelUrl = value;
      this.propertyChanged.raiseEvent(['modelUrl']);
    }
  }

  getModelUrl(feature: Feature): string | undefined {
    const featureValue = feature.get('olcs_modelUrl') as string | undefined;
    return featureValue !== undefined ? featureValue : this.modelUrl;
  }

  get modelScaleX(): number {
    return this._modelScaleX;
  }

  set modelScaleX(value: number) {
    check(value, Number);

    if (this._modelScaleX !== value) {
      this._modelScaleX = value;
      this.propertyChanged.raiseEvent(['modelScaleX']);
    }
  }

  getModelScaleX(feature: Feature): number {
    return parseNumber(feature.get('olcs_modelScaleX'), this.modelScaleX);
  }

  get modelScaleY(): number {
    return this._modelScaleY;
  }

  set modelScaleY(value: number) {
    check(value, Number);

    if (this._modelScaleY !== value) {
      this._modelScaleY = value;
      this.propertyChanged.raiseEvent(['modelScaleY']);
    }
  }

  getModelScaleY(feature: Feature): number {
    return parseNumber(feature.get('olcs_modelScaleY'), this.modelScaleY);
  }

  get modelScaleZ(): number {
    return this._modelScaleZ;
  }

  set modelScaleZ(value: number) {
    check(value, Number);

    if (this._modelScaleZ !== value) {
      this._modelScaleZ = value;
      this.propertyChanged.raiseEvent(['modelScaleZ']);
    }
  }

  getModelScaleZ(feature: Feature): number {
    return parseNumber(feature.get('olcs_modelScaleZ'), this.modelScaleZ);
  }

  get modelHeading(): number {
    return this._modelHeading;
  }

  set modelHeading(value: number) {
    check(value, Number);

    if (this._modelHeading !== value) {
      this._modelHeading = value;
      this.propertyChanged.raiseEvent(['modelHeading']);
    }
  }

  getModelHeading(feature: Feature): number {
    return parseNumber(feature.get('olcs_modelHeading'), this.modelHeading);
  }

  get modelPitch(): number {
    return this._modelPitch;
  }

  set modelPitch(value: number) {
    check(value, Number);

    if (this._modelPitch !== value) {
      this._modelPitch = value;
      this.propertyChanged.raiseEvent(['modelPitch']);
    }
  }

  getModelPitch(feature: Feature): number {
    return parseNumber(feature.get('olcs_modelPitch'), this.modelPitch);
  }

  get modelRoll(): number {
    return this._modelRoll;
  }

  set modelRoll(value: number) {
    check(value, Number);

    if (this._modelRoll !== value) {
      this._modelRoll = value;
      this.propertyChanged.raiseEvent(['modelRoll']);
    }
  }

  getModelRoll(feature: Feature): number {
    return parseNumber(feature.get('olcs_modelRoll'), this.modelRoll);
  }

  /**
   * Model options are merged with the model definition from model url, scale and orientation and accepts any option
   * passed to a Cesium.Model.
   */
  get modelOptions(): Record<string, unknown> | undefined {
    return this._modelOptions;
  }

  set modelOptions(modelOptions: Record<string, unknown> | undefined) {
    check(modelOptions, maybe(Object));

    if (this._modelOptions !== modelOptions) {
      this._modelOptions = modelOptions;
      this.propertyChanged.raiseEvent(['modelOptions']);
    }
  }

  /**
   * Get the features or the properties modelOptions.
   * @param  feature
   */
  getModelOptions(feature: Feature): Record<string, unknown> | undefined {
    const featureValue = feature.get('olcs_modelOptions') as
      | Record<string, unknown>
      | undefined;
    if (featureValue) {
      return featureValue;
    }
    if (this.modelOptions) {
      return this.modelOptions;
    }
    return undefined;
  }

  get modelAutoScale(): boolean {
    return this._modelAutoScale;
  }

  set modelAutoScale(value: boolean) {
    check(value, maybe(Boolean));

    const booleanValue = !!value;
    if (this._modelAutoScale !== booleanValue) {
      this._modelAutoScale = booleanValue;
      this.propertyChanged.raiseEvent(['modelAutoScale']);
    }
  }

  getModelAutoScale(feature: Feature): boolean {
    const featureValue = feature.get('olcs_modelAutoScale') as
      | boolean
      | undefined;
    return featureValue !== undefined ? featureValue : this.modelAutoScale;
  }

  get baseUrl(): string | undefined {
    return this._baseUrl;
  }

  set baseUrl(value: string | undefined) {
    check(value, maybe(String));

    if (this._baseUrl !== value) {
      this._baseUrl = value;
      this.propertyChanged.raiseEvent(['baseUrl']);
    }
  }

  getBaseUrl(feature: Feature): string | undefined {
    const featureValue = feature.get('olcs_baseUrl') as string | undefined;
    return featureValue !== undefined ? featureValue : this.baseUrl;
  }

  get primitiveOptions(): VectorPropertiesPrimitiveOptions | undefined {
    return this._primitiveOptions;
  }

  set primitiveOptions(value: VectorPropertiesPrimitiveOptions | undefined) {
    check(value, maybe(Object));

    if (this._primitiveOptions !== value) {
      this._primitiveOptions = value;
      this.propertyChanged.raiseEvent(['primitiveOptions']);
    }
  }

  getPrimitiveOptions(
    feature: Feature,
  ): VectorPropertiesPrimitiveOptions | undefined {
    const featureValue = feature.get('olcs_primitiveOptions') as
      | VectorPropertiesPrimitiveOptions
      | undefined;
    return featureValue !== undefined ? featureValue : this.primitiveOptions;
  }

  private _getBaseOptions(feature: Feature): VectorPropertiesBaseOptions {
    return {
      // 0 is not a valid scale value and will crash cesium
      scale: [
        this.getModelScaleX(feature) || 1,
        this.getModelScaleY(feature) || 1,
        this.getModelScaleZ(feature) || 1,
      ],
      heading: this.getModelHeading(feature),
      pitch: this.getModelPitch(feature),
      roll: this.getModelRoll(feature),
      autoScale: this.getModelAutoScale(feature),
    };
  }

  /**
   * Returns the primive definition of this feature
   * @param  feature
   */
  getPrimitive(feature: Feature): VectorPropertiesPrimitive | null {
    const primitiveOptions = this.getPrimitiveOptions(feature);
    if (!primitiveOptions?.geometryOptions) {
      return null;
    }

    return {
      ...this._getBaseOptions(feature),
      primitiveOptions,
    };
  }

  getModel(feature: Feature): VectorPropertiesModelOptions | null {
    let url = this.getModelUrl(feature);
    if (!url) {
      return null;
    }

    const baseUrl = this.getBaseUrl(feature);
    if (baseUrl) {
      url = new URL(url, baseUrl).toString();
    }

    return {
      ...this._getBaseOptions(feature),
      url,
    };
  }

  /**
   * Determines if a feature (in general with a point geometry) should be rendered as a geometry (billboard & label etc) or a model or a primitive
   * @param feature
   */
  renderAs(feature: Feature): 'geometry' | 'model' | 'primitive' {
    if (feature.get('olcs_modelUrl')) {
      return 'model';
    }

    const primitiveOptions = feature.get('olcs_primitiveOptions') as
      | VectorPropertiesPrimitiveOptions
      | undefined;

    if (primitiveOptions?.geometryOptions) {
      return 'primitive';
    }

    if (this.modelUrl) {
      return 'model';
    }

    if (this.primitiveOptions?.geometryOptions) {
      return 'primitive';
    }

    return 'geometry';
  }

  /**
   * resets values, either given, or default Value raises propertyChanged event once;
   * @param  vcsMeta
   */
  setVcsMeta(vcsMeta: VcsMeta): void {
    const options = VectorProperties.getDefaultOptions();
    // special case, setVCSMeta should not restore the altitudeMode default
    if (!vcsMeta.altitudeMode) {
      vcsMeta.altitudeMode = getAltitudeModeOptions(this.altitudeMode);
    }
    Object.assign(options, vcsMeta);
    this.setValues(options);
  }

  /**
   * sets given values only raises propertyChanged event if a value has been set;
   * @param  options
   */
  setValues(options: VectorPropertiesOptions): void {
    const defaultValues = VectorProperties.getDefaultOptions();
    const changedProperties: PropertyChangedKey[] = [];
    // check if key exists in options, to also set undefined values
    if ('altitudeMode' in options) {
      const defaultAltitudeMode = parseEnumKey(
        defaultValues.altitudeMode,
        AltitudeModeCesium,
        undefined,
      );
      const parsedAltitudeMode = parseEnumKey(
        options.altitudeMode,
        AltitudeModeCesium,
        defaultAltitudeMode,
      );
      if (this._altitudeMode !== parsedAltitudeMode) {
        this._altitudeMode = parsedAltitudeMode;
        changedProperties.push('altitudeMode');
      }
    }

    if ('allowPicking' in options) {
      const parsedAllowPicking = parseBoolean(
        options.allowPicking,
        defaultValues.allowPicking,
      );
      if (this._allowPicking !== parsedAllowPicking) {
        this._allowPicking = parsedAllowPicking;
        changedProperties.push('allowPicking');
      }
    }

    if ('classificationType' in options) {
      const defaultClassificationType = parseEnumKey(
        defaultValues.classificationType,
        ClassificationTypeCesium,
        undefined,
      );
      const parsedClassificationType = parseEnumKey(
        options.classificationType,
        ClassificationTypeCesium,
        defaultClassificationType,
      );
      if (this._classificationType !== parsedClassificationType) {
        this._classificationType = parsedClassificationType;
        changedProperties.push('classificationType');
      }
    }

    if ('scaleByDistance' in options) {
      const parsedScaleByDistance = parseNearFarScalar(
        options.scaleByDistance,
        undefined,
      );
      if (!NearFarScalar.equals(parsedScaleByDistance, this._scaleByDistance)) {
        this._scaleByDistance = parsedScaleByDistance;
        changedProperties.push('scaleByDistance');
      }
    }

    if ('eyeOffset' in options) {
      const parsedEyeOffset = parseCartesian3(options.eyeOffset, undefined);
      if (!Cartesian3.equals(parsedEyeOffset, this._eyeOffset)) {
        this._eyeOffset = parsedEyeOffset;
        changedProperties.push('eyeOffset');
      }
    }

    if ('heightAboveGround' in options) {
      const parsedHeightAboveGround = parseNumber(
        options.heightAboveGround,
        defaultValues.heightAboveGround,
      );
      if (parsedHeightAboveGround !== this._heightAboveGround) {
        this._heightAboveGround = parsedHeightAboveGround;
        changedProperties.push('heightAboveGround');
      }
    }

    if ('skirt' in options) {
      const parsedSkirt = parseNumber(options.skirt, defaultValues.skirt);
      if (parsedSkirt !== this._skirt) {
        this._skirt = parsedSkirt;
        changedProperties.push('skirt');
      }
    }

    if ('groundLevel' in options) {
      const parsedGroundLevel = parseNumber(
        options.groundLevel,
        defaultValues.groundLevel,
      );
      if (parsedGroundLevel !== this._groundLevel) {
        this._groundLevel = parsedGroundLevel;
        changedProperties.push('groundLevel');
      }
    }

    if ('extrudedHeight' in options) {
      const parsedExtrudedHeight = parseNumber(
        options.extrudedHeight,
        defaultValues.extrudedHeight,
      );
      if (parsedExtrudedHeight !== this._extrudedHeight) {
        this._extrudedHeight = parsedExtrudedHeight;
        changedProperties.push('extrudedHeight');
      }
    }
    if ('storeysAboveGround' in options) {
      const parsedStoreysAboveGround = parseInteger(
        options.storeysAboveGround,
        defaultValues.storeysAboveGround,
      );
      if (parsedStoreysAboveGround !== this._storeysAboveGround) {
        this._storeysAboveGround = parsedStoreysAboveGround;
        changedProperties.push('storeysAboveGround');
      }
    }
    if ('storeysBelowGround' in options) {
      const parsedStoreysBelowGround = parseInteger(
        options.storeysBelowGround,
        defaultValues.storeysBelowGround,
      );
      if (parsedStoreysBelowGround !== this._storeysBelowGround) {
        this._storeysBelowGround = parsedStoreysBelowGround;
        changedProperties.push('storeysBelowGround');
      }
    }

    if ('storeyHeightsAboveGround' in options) {
      const parsedStoreyHeightsAboveGround = parseStoreyHeights(
        options.storeyHeightsAboveGround,
        defaultValues.storeyHeightsAboveGround,
      );
      if (
        !deepEqual(
          parsedStoreyHeightsAboveGround,
          this._storeyHeightsAboveGround,
        )
      ) {
        this._storeyHeightsAboveGround = parsedStoreyHeightsAboveGround;
        changedProperties.push('storeyHeightsAboveGround');
      }
    }

    if ('storeyHeightsBelowGround' in options) {
      const parsedStoreyHeightsBelowGround = parseStoreyHeights(
        options.storeyHeightsBelowGround,
        defaultValues.storeyHeightsBelowGround,
      );
      if (
        !deepEqual(
          parsedStoreyHeightsBelowGround,
          this._storeyHeightsBelowGround,
        )
      ) {
        this._storeyHeightsBelowGround = parsedStoreyHeightsBelowGround;
        changedProperties.push('storeyHeightsBelowGround');
      }
    }

    if ('modelUrl' in options) {
      if (options.modelUrl !== this._modelUrl) {
        this._modelUrl = options.modelUrl ?? '';
        changedProperties.push('modelUrl');
      }
    }

    if ('modelScaleX' in options) {
      const parsedModelScaleX = parseNumber(
        options.modelScaleX,
        defaultValues.modelScaleX,
      );
      if (parsedModelScaleX !== this._modelScaleX) {
        this._modelScaleX = parsedModelScaleX;
        changedProperties.push('modelScaleX');
      }
    }

    if ('modelScaleY' in options) {
      const parsedModelScaleY = parseNumber(
        options.modelScaleY,
        defaultValues.modelScaleY,
      );
      if (parsedModelScaleY !== this._modelScaleY) {
        this._modelScaleY = parsedModelScaleY;
        changedProperties.push('modelScaleY');
      }
    }

    if ('modelScaleZ' in options) {
      const parsedModelScaleZ = parseNumber(
        options.modelScaleZ,
        defaultValues.modelScaleZ,
      );
      if (parsedModelScaleZ !== this._modelScaleZ) {
        this._modelScaleZ = parsedModelScaleZ;
        changedProperties.push('modelScaleZ');
      }
    }

    if ('modelHeading' in options) {
      const parsedModelHeading = parseNumber(
        options.modelHeading,
        defaultValues.modelHeading,
      );
      if (parsedModelHeading !== this._modelHeading) {
        this._modelHeading = parsedModelHeading;
        changedProperties.push('modelHeading');
      }
    }

    if ('modelPitch' in options) {
      const parsedModelPitch = parseNumber(
        options.modelPitch,
        defaultValues.modelPitch,
      );
      if (parsedModelPitch !== this._modelPitch) {
        this._modelPitch = parsedModelPitch;
        changedProperties.push('modelPitch');
      }
    }

    if ('modelRoll' in options) {
      const parsedModelRoll = parseNumber(
        options.modelRoll,
        defaultValues.modelRoll,
      );
      if (parsedModelRoll !== this._modelRoll) {
        this._modelRoll = parsedModelRoll;
        changedProperties.push('modelRoll');
      }
    }

    if ('modelOptions' in options) {
      if (!deepEqual(this._modelOptions, options.modelOptions)) {
        this._modelOptions = options.modelOptions
          ? structuredClone(options.modelOptions)
          : undefined;
        changedProperties.push('modelOptions');
      }
    }

    if ('modelAutoScale' in options) {
      if (this._modelAutoScale !== options.modelAutoScale) {
        this._modelAutoScale = !!options.modelAutoScale;
        changedProperties.push('modelAutoScale');
      }
    }

    if ('baseUrl' in options) {
      if (options.baseUrl !== this._baseUrl) {
        this._baseUrl = options.baseUrl ?? '';
        changedProperties.push('baseUrl');
      }
    }

    if ('primitiveOptions' in options) {
      if (!deepEqual(this._primitiveOptions, options.primitiveOptions)) {
        this._primitiveOptions = options.primitiveOptions
          ? structuredClone(options.primitiveOptions)
          : undefined;
        changedProperties.push('primitiveOptions');
      }
    }

    if (changedProperties.length) {
      this.propertyChanged.raiseEvent(changedProperties);
    }
  }

  getValues(): VectorPropertiesOptions {
    return {
      altitudeMode: getAltitudeModeOptions(this.altitudeMode),
      allowPicking: this.allowPicking,
      classificationType: getClassificationTypeOptions(this.classificationType),
      scaleByDistance: getNearFarValueOptions(this.scaleByDistance),
      eyeOffset: getCartesian3Options(this.eyeOffset),
      heightAboveGround: this.heightAboveGround,
      skirt: this.skirt,
      groundLevel: this.groundLevel,
      extrudedHeight: this.extrudedHeight,
      storeysAboveGround: this.storeysAboveGround,
      storeysBelowGround: this.storeysBelowGround,
      storeyHeightsAboveGround: this.storeyHeightsAboveGround,
      storeyHeightsBelowGround: this.storeyHeightsBelowGround,
      modelUrl: this.modelUrl,
      modelScaleX: this.modelScaleX,
      modelScaleY: this.modelScaleY,
      modelScaleZ: this.modelScaleZ,
      modelHeading: this.modelHeading,
      modelPitch: this.modelPitch,
      modelRoll: this.modelRoll,
      modelAutoScale: this.modelAutoScale,
      modelOptions: this.modelOptions,
      baseUrl: this.baseUrl,
      primitiveOptions: this.primitiveOptions,
    };
  }

  /**
   * The common vector properties for the input features.
   * @param features Features for which the vector property values should be returned.
   * @returns The common vector properties for the features. When a/all feature(s) does not has a property set, the layer or, if not set, the default value is returned. If features have different values for a property, the property key is not added to the returned obeject. If feature array is empty, an empty object is returned.
   */
  getValuesForFeatures(features: Feature[]): VectorPropertiesOptions {
    const values: VectorPropertiesOptions = {};

    if (!features.length) {
      return values;
    }

    /**
     * Checks if all the values of the array are equal using fast-deep-equal.
     * @param propertyValues An array of values for a specific property from different features.
     * @returns Whether all values are equal.
     */
    function isAllEqual(
      propertyValues: (
        | string
        | number
        | boolean
        | number[]
        | Record<string, unknown>
        | undefined
      )[],
    ): boolean {
      return propertyValues.every((curr, index, array) => {
        if (index === 0) {
          return true;
        }
        return deepEqual(curr, array[0]);
      });
    }

    const altitudeModeValues = features.map((f) => this.getAltitudeMode(f));
    if (isAllEqual(altitudeModeValues)) {
      values.altitudeMode = getAltitudeModeOptions(altitudeModeValues[0]);
    }

    const allowPickingValues = features.map((f) => this.getAllowPicking(f));
    if (isAllEqual(allowPickingValues)) {
      values.allowPicking = allowPickingValues[0];
    }

    const classificationTypeValues = features.map((f) =>
      this.getClassificationType(f),
    );
    if (isAllEqual(classificationTypeValues)) {
      values.classificationType = getClassificationTypeOptions(
        classificationTypeValues[0],
      );
    }

    const scaleByDistanceValues = features.map((f) =>
      getNearFarValueOptions(this.getScaleByDistance(f)),
    );
    if (isAllEqual(scaleByDistanceValues)) {
      values.scaleByDistance = scaleByDistanceValues[0];
    }

    const eyeOffsetValues = features.map((f) =>
      getCartesian3Options(this.getEyeOffset(f)),
    );
    if (isAllEqual(eyeOffsetValues)) {
      values.eyeOffset = eyeOffsetValues[0];
    }

    const heightAboveGroundValues = features.map((f) =>
      this.getHeightAboveGround(f),
    );
    if (isAllEqual(heightAboveGroundValues)) {
      values.heightAboveGround = heightAboveGroundValues[0];
    }

    const skirtValues = features.map((f) => this.getSkirt(f));
    if (isAllEqual(skirtValues)) {
      values.skirt = skirtValues[0];
    }

    const groundLevelValues = features.map((f) => this.getGroundLevel(f));
    if (isAllEqual(groundLevelValues)) {
      values.groundLevel = groundLevelValues[0];
    }

    const extrudedHeightValues = features.map((f) => this.getExtrudedHeight(f));
    if (isAllEqual(extrudedHeightValues)) {
      values.extrudedHeight = extrudedHeightValues[0];
    }

    const storeysAboveGroundValues = features.map((f) =>
      this.getStoreysAboveGround(f),
    );
    if (isAllEqual(storeysAboveGroundValues)) {
      values.storeysAboveGround = storeysAboveGroundValues[0];
    }

    const storeysBelowGroundValues = features.map((f) =>
      this.getStoreysBelowGround(f),
    );
    if (isAllEqual(storeysBelowGroundValues)) {
      values.storeysBelowGround = storeysBelowGroundValues[0];
    }

    const storeyHeightsAboveGroundValues = features.map((f) =>
      this.getStoreyHeightsAboveGround(f),
    );
    if (isAllEqual(storeyHeightsAboveGroundValues)) {
      values.storeyHeightsAboveGround = storeyHeightsAboveGroundValues[0];
    }

    const storeyHeightsBelowGroundValues = features.map((f) =>
      this.getStoreyHeightsBelowGround(f),
    );
    if (isAllEqual(storeyHeightsBelowGroundValues)) {
      values.storeyHeightsBelowGround = storeyHeightsBelowGroundValues[0];
    }

    const modelUrlValues = features.map((f) => this.getModelUrl(f));
    if (isAllEqual(modelUrlValues)) {
      values.modelUrl = modelUrlValues[0];
    }

    const modelScaleXValues = features.map((f) => this.getModelScaleX(f));
    if (isAllEqual(modelScaleXValues)) {
      values.modelScaleX = modelScaleXValues[0];
    }

    const modelScaleYValues = features.map((f) => this.getModelScaleY(f));
    if (isAllEqual(modelScaleYValues)) {
      values.modelScaleY = modelScaleYValues[0];
    }

    const modelScaleZValues = features.map((f) => this.getModelScaleZ(f));
    if (isAllEqual(modelScaleZValues)) {
      values.modelScaleZ = modelScaleZValues[0];
    }

    const modelHeadingValues = features.map((f) => this.getModelHeading(f));
    if (isAllEqual(modelHeadingValues)) {
      values.modelHeading = modelHeadingValues[0];
    }

    const modelPitchValues = features.map((f) => this.getModelPitch(f));
    if (isAllEqual(modelPitchValues)) {
      values.modelPitch = modelPitchValues[0];
    }

    const modelRollValues = features.map((f) => this.getModelRoll(f));
    if (isAllEqual(modelRollValues)) {
      values.modelRoll = modelRollValues[0];
    }

    const modelAutoScale = features.map((f) => this.getModelAutoScale(f));
    if (isAllEqual(modelAutoScale)) {
      values.modelAutoScale = modelAutoScale[0];
    }

    const modelOptions = features.map((f) => this.getModelOptions(f));
    if (isAllEqual(modelOptions)) {
      values.modelOptions = modelOptions[0];
    }

    const primitiveOptions = features.map((f) => this.getPrimitiveOptions(f));
    if (isAllEqual(primitiveOptions)) {
      values.primitiveOptions = primitiveOptions[0];
    }

    const baseUrlValues = features.map((f) => this.getBaseUrl(f));
    if (isAllEqual(baseUrlValues)) {
      values.baseUrl = baseUrlValues[0];
    }

    return values;
  }

  /**
   * Sets vector property options on a array of features. When a property equals the value that is returned from the getter of the VectorProperties instance, the property is unset from the feature(s).
   * @param options The vector property options to be set on the features.
   * @param features The features to set the vector property options on.
   */
  setValuesForFeatures(
    options: VectorPropertiesOptions,
    features: Feature[],
  ): void {
    const layerValues = this.getValues();

    type UpdateConfig<
      T extends keyof VectorPropertiesOptions = keyof VectorPropertiesOptions,
    > = {
      key: T;
      set: boolean;
      value: VectorPropertiesOptions[T];
    };

    const updates: UpdateConfig[] = [];
    Object.entries(options).forEach(([key, value]) => {
      const keyCast = key as keyof VectorPropertiesOptions;
      updates.push({
        key: keyCast,
        value,
        set: !deepEqual(value, layerValues[keyCast]),
      });
    });

    features.forEach((f) => {
      updates.forEach(({ key, set, value }) => {
        const propertyName = `olcs_${key}`;
        if (set) {
          f.set(propertyName, value);
        } else {
          f.unset(propertyName);
        }
      });
    });
  }

  // XXX ugly design, this does NOT return a VcsMeta (missing version) but is missued to get config objects too often to change
  getVcsMeta(
    defaultOptions?: VectorPropertiesOptions,
  ): Omit<VcsMeta, 'version'> {
    const defaultValues =
      defaultOptions || VectorProperties.getDefaultOptions();
    const vcsMeta: Omit<VcsMeta, 'version'> = {};
    if (
      getAltitudeModeOptions(this.altitudeMode) !== defaultValues.altitudeMode
    ) {
      vcsMeta.altitudeMode = getAltitudeModeOptions(this.altitudeMode);
    }
    if (this.allowPicking !== defaultValues.allowPicking) {
      vcsMeta.allowPicking = this.allowPicking;
    }
    if (
      getClassificationTypeOptions(this.classificationType) !==
      defaultValues.classificationType
    ) {
      vcsMeta.classificationType = getClassificationTypeOptions(
        this.classificationType,
      );
    }
    if (
      !deepEqual(
        getNearFarValueOptions(this.scaleByDistance),
        defaultValues.scaleByDistance,
      )
    ) {
      vcsMeta.scaleByDistance = getNearFarValueOptions(this.scaleByDistance);
    }
    if (
      !deepEqual(getCartesian3Options(this.eyeOffset), defaultValues.eyeOffset)
    ) {
      vcsMeta.eyeOffset = getCartesian3Options(this.eyeOffset);
    }
    if (this.heightAboveGround !== defaultValues.heightAboveGround) {
      vcsMeta.heightAboveGround = this.heightAboveGround;
    }
    if (this.skirt !== defaultValues.skirt) {
      vcsMeta.skirt = this.skirt;
    }
    if (this.groundLevel !== defaultValues.groundLevel) {
      vcsMeta.groundLevel = this.groundLevel;
    }
    if (this.extrudedHeight !== defaultValues.extrudedHeight) {
      vcsMeta.extrudedHeight = this.extrudedHeight;
    }
    if (this.storeysAboveGround !== defaultValues.storeysAboveGround) {
      vcsMeta.storeysAboveGround = this.storeysAboveGround;
    }
    if (this.storeysBelowGround !== defaultValues.storeysBelowGround) {
      vcsMeta.storeysBelowGround = this.storeysBelowGround;
    }
    if (
      !deepEqual(
        this.storeyHeightsAboveGround,
        defaultValues.storeyHeightsAboveGround,
      )
    ) {
      vcsMeta.storeyHeightsAboveGround = this.storeyHeightsAboveGround;
    }
    if (
      !deepEqual(
        this.storeyHeightsBelowGround,
        defaultValues.storeyHeightsBelowGround,
      )
    ) {
      vcsMeta.storeyHeightsBelowGround = this.storeyHeightsBelowGround;
    }
    if (this.modelUrl !== defaultValues.modelUrl) {
      vcsMeta.modelUrl = this.modelUrl;
    }
    if (this.modelScaleX !== defaultValues.modelScaleX) {
      vcsMeta.modelScaleX = this.modelScaleX;
    }
    if (this.modelScaleY !== defaultValues.modelScaleY) {
      vcsMeta.modelScaleY = this.modelScaleY;
    }
    if (this.modelScaleZ !== defaultValues.modelScaleZ) {
      vcsMeta.modelScaleZ = this.modelScaleZ;
    }
    if (this.modelHeading !== defaultValues.modelHeading) {
      vcsMeta.modelHeading = this.modelHeading;
    }
    if (this.modelPitch !== defaultValues.modelPitch) {
      vcsMeta.modelPitch = this.modelPitch;
    }
    if (this.modelRoll !== defaultValues.modelRoll) {
      vcsMeta.modelRoll = this.modelRoll;
    }
    if (this.baseUrl !== defaultValues.baseUrl) {
      vcsMeta.baseUrl = this.baseUrl;
    }
    return vcsMeta;
  }

  /**
   * destroys the vectorProperties and removes all listeners
   */
  destroy(): void {
    this.propertyChanged.destroy();
  }
}
export default VectorProperties;

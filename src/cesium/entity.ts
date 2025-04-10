/* eslint-disable @typescript-eslint/no-explicit-any */
import { Entity } from '@vcmap-cesium/engine';

Entity.prototype.getId = function getId(this: Entity): string | number {
  return this.id;
};

/**
 * To be used for cesium 3D style functions
 */
Entity.prototype.getProperty = function getProperty(
  this: Entity,
  property: string,
): any {
  return this[property as keyof Entity];
};

Entity.prototype.getAttributes = function getAttributes(): Record<
  string,
  unknown
> {
  return this.properties ?? {};
};

/**
 * To be used for cesium 3D style functions
 */
Entity.prototype.getPropertyInherited = function getPropertyInherited(
  this: Entity,
  property: string,
): any {
  return this.getProperty(property);
};

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

/**
 * To be used for cesium 3D style functions
 */
Entity.prototype.getPropertyInherited = function getPropertyInherited(
  this: Entity,
  property: string,
): any {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return this.getProperty(property);
};

// @ts-nocheck
import { Material, Cartesian2 } from '@vcmap/cesium';

/**
 * @file Wallpaper Material to implement openlayers pattern support in cesium
 */

// Call this once at application startup
// eslint-disable-next-line no-underscore-dangle
Material._materialCache.addMaterial('Wallpaper', {
  fabric: {
    type: 'Wallpaper',
    uniforms: {
      image: Material.DefaultImageId,
      anchor: new Cartesian2(0, 0),
    },
    components: {
      diffuse: 'texture2D(image, fract((gl_FragCoord.xy - anchor.xy) / vec2(imageDimensions.xy))).rgb',
      alpha: 'texture2D(image, fract((gl_FragCoord.xy - anchor.xy) / vec2(imageDimensions.xy))).a',
    },
  },
  translucent: false,
});

// //Create an instance and assign to anything that has a material property.
// //scene - the scene
// //image - the image (I think both a url or Image object are supported)
// //anchor - A Cartesian3 that is the most southern and westard point of the geometry
// var WallPaperMaterialProperty = function(scene, image, anchor) {
//   this._scene = scene;
//   this._image = image;
//   this._anchor = anchor;
//   this.definitionChanged = new Cesium.Event();
//   this.isConstant = true;
// };
//
// WallPaperMaterialProperty.prototype.getType = function(time) {
//   return 'Wallpaper';
// };
//
// WallPaperMaterialProperty.prototype.getValue = function(time, result) {
//   if (!Cesium.defined(result)) {
//     result = {
//       image : undefined,
//       anchor : undefined
//     };
//   }
//
//   result.image = this._image;
//   result.anchor = Cesium.SceneTransforms.wgs84ToDrawingBufferCoordinates(this._scene, this._anchor, result.anchor);
//   if(Cesium.defined(result.anchor)){
//     result.anchor.x = Math.floor(result.anchor.x);
//     result.anchor.y = Math.floor(result.anchor.y);
//   } else {
//     result.anchor = new Cesium.Cartesian2(0, 0);
//   }
//   return result;
// };
//
// WallPaperMaterialProperty.prototype.equals = function(other) {
//   return this === other || //
//     (other instanceof  WallPaperMaterialProperty && //
//       this._image === other._image);
// };

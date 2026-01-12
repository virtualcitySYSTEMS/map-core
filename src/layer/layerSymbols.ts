/**
 * Symbol to declare a layers name on its visualizations, e.g. ol.layer.Layer, Cesium.Cesium3DTileset*
 */
export const vcsLayerName: unique symbol = Symbol('vcsLayerName');

/**
 * Symbol added to Cesium3DTilesets to suppress picking.
 */
export const allowPicking: unique symbol = Symbol('allowPicking');

/**
 * Symbol to store the I3SNode and the cartesian position on features created from non Cesium3DTileset sources.
 */
export const i3sData: unique symbol = Symbol('i3sData');

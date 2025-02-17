/**
 * Symbol to declare a layers name on its visualizations, e.g. ol.layer.Layer, Cesium.Cesium3DTileset*
 */
export const vcsLayerName: unique symbol = Symbol('vcsLayerName');

/**
 * Symbol added to Cesium3DTilesets to suppress picking.
 */
export const allowPicking: unique symbol = Symbol('allowPicking');

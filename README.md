# VC Map Core

> Part of the [VC Map Project](https://github.com/virtualcitySYSTEMS/map-ui)

## Getting Started
- clone Repo
- npm install

# Coding Conventions
### Exporting from a module
- You should export all variables, functions, class etc. from a module
  which are required to use the API.
- Make sure the names of exports have _meaning outside of their module_. E.g. a
  function names `extend(destination: extent3D, source: extend3D):void` would need to be rephrased to `extend3DExtent`.
- If you export things _just for testing your unit_ or other _internals only_ make
  sure to set the `@private` doclet.
  ```javascript
  /**
   * Resets the foo. Exported for testing
   * @private
   */
  export function resetFooInstance() {} 
  ```

### TS & Typesafety
- You should use the imported name in your doclets, e.g.:
  ```javascript
  import Vector from 'ol/source/Vector.js';
  
  /**
   * @param {Vector} source
   * @returns {Array<import("ol").Feature<import("ol/geom/Geometry").default>>}
   */
  function getAllFeatures(source) {
    if (source instanceof Vector) {
      return source.getFeatures();
    }
    return [];
  }
  ```
- You should use dump file imports where possible (WebStorm cannot generate 
  Intelisensse from default imports). Thus `@param {import("ol/Feature").default}`
  would become: `@param {import("ol").Feature}`.
- You will need to import library own classes use `@param {import("@vcmap/core").CesiumMap}`.
- You do _not_ need to import `typedefs` since these are provided globally during type checking.

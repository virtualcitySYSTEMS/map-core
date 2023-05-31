# VC Map Core

> Part of the [VC Map Project](https://github.com/virtualcitySYSTEMS/map-ui)

## Getting Started

- clone Repo
- npm install

# Coding Conventions

### Exporting from a module

- You should export all variables, functions, class etc. from a module
  which are required to use the API.
- Party of your module which should be part of the library must be added to the index.ts file manually
- Make sure the names of exports have _meaning outside of their module_. E.g. a
  function names `extend(destination: extent3D, source: extend3D):void` would need to be rephrased to `extend3DExtent`.

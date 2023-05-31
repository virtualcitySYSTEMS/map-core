# VcsApp

The [VcsApp](../src/vcsApp.ts) is the main class of a VC Map application.
One or multiple instances of a VcsApp can (co)exist and be embedded in a Website.

The VcsApp implements the module concept, which allows to build modular applications.
It has the capability to serialize and deserialize its modules.

## Collections

An VcsApp consists of the following [collections](../src/util/collection.ts) containing deserialized items defining the VcsApp's content:

- modules
- [maps](./maps.md)
- [layers](./layers.md)
- obliqueCollections
- [styles](./style.md)
- viewpoints
- categories

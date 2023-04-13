# VcsModule

A [module](../src/vcsModule.js) is a serialized configuration of the [VcsApp](../src/vcsApp.js).
This means it can include [style](./style.md) or [layer](./layers.md) definitions, oblique collections, viewpoints, [maps](./maps.md), categories or plugins. 

The VcsApp can load one or multiple serialized modules at the same time.
The modules are stored in an IndexedCollection, all deserialized objects are added to the [VcsApp](../src/vcsApp.js).

> If an object has already existed on the VcsApp, it will be overwritten by the new definition defined by the newly added module.

You can add a module programmatically as follows:
```js
vcsApp.addModule({
  id: 'myModuleId',
  layers: [
    {
      type: 'CesiumTilesetLayer',
      name: 'buildings',
      url: '',
    }
  ],
  styles: [
    {
      type: 'DeclarativeStyleItem',
      name: 'buildingsStyle',
      "declarativeStyle": {
        show: true,
        color: 'rgb(${CIR}[0], ${CIR}[1], ${CIR}[2])',
      }
    }
  ]
})
```

A module can als be removed from the VcsApp, if it's not needed any more.
All objects belonging to this module, will be destroyed and removed from the [VcsApp](../src/vcsApp.js).

> If an object has been overwritten by an added module, the original object will be restored once said module is removed.

To remove a module from the VcsApp, call:
```js
vcsApp.removeModule('myModuleId');
```

You can listen to changes of modules using the below events:
```js
vcsApp.moduleAdded.addEventListener(module => {
  // do something on added
})

;vcsApp.moduleRemoved.addEventListener(module => {
  // do something on removed
});
```

## Dynamic module

The VcsApp has a `dynamicModule`, which can be any module of the modules collection.
All objects added to the VcsApp, which are not *[volatile](#volatile-objects)* and are *without a module*, are automatically added to the current dynamic module. 

Per default the VcsApp sets an *empty* `defaultDynamicModule` as `dynamicModule`.
The dynamic module can be changed though by calling:
```js
vcsApp.setDynamicModule({
  id: 'myDynamicModule',
  // ...
})
```
To unset the current dynamic module and set it back to the `defaultDynamicModule` call:
```js
vcsApp.resetDynamicModule();
```

This can be helpful, if you want to edit a module by adding or removing objects to the VcsApp.
To do so, set your module as dynamic module and make your changes by adding or removing objects from VcsApp collections.
When the module is serialized, all changes will be applied.

## Volatile Objects

An object can be marked "volatile". This ensures, that an object added to the VcsApp
will never be serialized into a module, regardless of the current dynamic module. 
Typical use case is a scratch layer, which represents temporary features.

To mark an object as "volatile", import the helper function and call:
```js
import { markVolatile, VectorLayer } from '@vcmap/core';

const scratchLayer = new VectorLayer({ name: '_myScratchLayer' });
markVolatile(scratchLayer);
```


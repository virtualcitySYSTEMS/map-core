# Editor
The editor is a set of functionality to allow users to:
1. Create features with a given geometry on a specific layer.
2. Select & edit the geometry of a single feature on a specific layer.
3. Select, translate, scale & rotate one or more features from a specific layer.

## Missing Features
- Altitude mode handling
- snapping

## Usage
The editor defines a session concept, named `EditorSession`. An editor session
is active as soon as its created and can be either stopped by calling the `stop` 
method or by being removed from the current `VcsApp`s `EventHandler`.

For the above outlined functionality, there are three types of sessions which can be 
created, each intended for a specific use case.

### Creating Features
If you wish to start a `CreateFeatureSession`, you must call the `startCreateFeatureSession` 
helper, to create it. Once created you can listen to the sessions events to handle creation
& stopping. The following outlines some example usage:

```js
import { 
  VcsApp, 
  VectorLayer, 
  startCreateFeatureSession, 
  GeometryType,
} from '@vcmap/core';

// The app on which all things happen
const app = new VcsApp();
// The layer we wish to edit
const layer = new VectorLayer();
app.layers.add(layer);
await layer.activate();

/**
 * Create a feature session and just keep cereating new features, once a feature has been
 * created
 */
function createFeaturesIndefinitely() {
  startCreateFeatureSession(app, layer, GeometryType.LineString);
}

/**
 * You can sync information from the session with another structure.
 * @param {{ currentId: string|number, numberCreated: number, active: boolean }} info
 */
function createFeatureAndGrabInfo(info) {
  const session = startCreateFeatureSession(app, layer, GeometryType.LineString);
  session.featureCreated.addEventListener((feature) => {
    info.currentId = feature.getId();
  });
  
  session.creationFinished.addEventListener((feature) => {
    if (feature) {
      info.numberCreated += 1;
    }
  });
  
  session.stopped.addEventListener(() => {
    info.active = false;
  });
  info.active = true;
}

/**
 * Wait for a single feature to be created.
 * @returns {Promise<import("ol").Feature>}
 */
function waitForOne() {
  const session = startCreateFeatureSession(app, layer, GeometryType.LineString);
  
  return new Promise((resolve, reject) => {
    let feature = null; 
    session.stopped.addEventListener(() => {
      resolve(feature); // may be null if finished before feature was valid
    });
    
    session.creationFinished.addEventListener((f) => {
      if (f) {
        feature = f;
        session.stop();
      }
    });
  });
}
```

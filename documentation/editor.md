# Editor
The editor is a set of functionality to allow users to:
1. Create features with a given geometry on a specific layer.
2. Select & edit the geometry of a single feature on a specific layer.
3. Select, translate, scale & rotate one or more features from a specific layer.

## Missing Features
- Altitude mode handling
- Snapping

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

```javascript
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

### Editing Feature Geometries
To edit the feature geometries in a layer, you must start the `EditGeometrySession` using
the `startEditGeometrySession` helper.
This session provides a feature selection, to select a single feature & the required
interactions to edit the currently selected feature.

The following outlines some example use cases:
```javascript
import { 
  VcsApp, 
  VectorLayer,
  startEditGeometrySession, 
  GeometryType,
} from '@vcmap/core';

// The app on which all things happen
const app = new VcsApp();
// The layer we wish to edit
const layer = new VectorLayer();
app.layers.add(layer);
await layer.activate();

/**
 * This will edit the layer indefinitly
 */
function editLayerGeometries() {
  startEditGeometrySession(app, layer);
}

/**
 * You can sync information from the session with another structure.
 * @param {{ currentFeature: import("ol").Feature|null|null}}
 */
function snycInfo(info) {
  const session = startEditGeometrySession(app, layer);
  session.featureSelection.featureChanged.addEventListener((feature) => {
    info.currentFeature = feature;
  });
}

/**
 * If you know the feature you wish to edit beforehand, you can do the following
 * @param {string} featureId
 */
async function setTheCurrentFeature(featureId) {
  const session = startEditGeometrySession(app, layer);
  const feature = layer.getFeatureById(featureId);
  await session.featureSelection.selectFeature(feature); 
}

/**
 * If you wish to only edit one feature and then stop the session
 * @param {string} featureId
 */
async function stopAfter(featureId) {
  const session = startEditGeometrySession(app, layer);
  const feature = layer.getFeatureById(featureId);
  await session.featureSelection.selectFeature(feature);
  session.featureSelection.featureChanged.addEventListener(() => {
    session.stop();
  });
}

/**
 * You can finish editing a feature, if you clear the selection. 
 * @param {VcsEvent<void>} finishEvent
 */
function finishEvent(finishEvent) {
  const session = startEditGeometrySession(app, layer);
  finishEvent.addEventListener(() => {
    if (session.featureSelection.selectedFeature) {
      session.featureSelection.clear();
    }
  });
}
```

### Transforming Features
There are four ways to transform features. This includes in all viewers 1) translate, 2) 
scale and 3) rotate. In 3D, you can also extrude features. Transformations can be applied
to a selection set, as opposed to editing of geometries, which only works on single features.

Once you have started a session, the session will take care of handling map changes &
oblique images changes and trys to maintain the users selection set (of course this cannot
be done in oblique). You can also change the _mode_ of the current session
without clearing the selectiong set.

```javascript
import { 
  VcsApp, 
  VectorLayer,
  startEditFeaturesSession, 
  GeometryType,
  TransformationMode,
} from '@vcmap/core';

// The app on which all things happen
const app = new VcsApp();
// The layer we wish to edit
const layer = new VectorLayer();
app.layers.add(layer);
await layer.activate();

/**
 * This will edit the layer indefinitly
 */
function editLayerGeometries() {
  startEditFeaturesSession(app, layer);
}

/**
 * You can sync information from the session with another structure.
 * @param {{ currentFeature: import("ol").Feature|null|null}}
 */
function snycInfo(info) {
  const session = startEditFeaturesSession(app, layer);
  session.featureSelection.featuresChanged.addEventListener((features) => {
    info.currentFeature = features[0];
  });
}

/**
 * If you know the feature you wish to edit beforehand, you can do the following
 * @param {string} featureId
 */
async function setTheCurrentFeatures(featureId) {
  const session = startEditFeaturesSession(app, layer);
  const feature = layer.getFeatureById(featureId);
  await session.featureSelection.setSelectionSet([feature]); 
}

/**
 * If you wish to only edit one feature and then stop the session
 * @param {string} featureId
 */
async function stopAfter(featureId) {
  const session = startEditFeaturesSession(app, layer);
  const feature = layer.getFeatureById(featureId);
  await session.featureSelection.setSelectionSet([feature]);
  session.featureSelection.featureChanged.addEventListener(() => {
    session.stop();
  });
}

/**
 * You can change the initial mode
 */
function startWithRotate() {
  startEditFeaturesSession(app, layer, TransformationMode.ROTATE);
}

/**
 * You can set a different highlight style
 * @param {import("@vcmap/core").VectorStyleItem} style
 */
function customHighlightStyle(style) {
  startEditFeaturesSession(app, layer, TransformationMode.TRANSLATE, style);
}

/**
 * You can listen to mode changes and change the mode
 */
function listenToModeChanged() {
  const session = startEditFeaturesSession(app, layer);
  session.modeChanged.addEventListener((mode) => {
    console.log(`current mode is: ${mode}`);
  });
  session.setMode(TransformationMode.ROTATE);
  session.setMode(TransformationMode.SCALE);
}
```

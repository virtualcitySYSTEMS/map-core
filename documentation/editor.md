# Editor

The editor is a set of functionality to allow users to:

1. Create features with a given geometry on a specific layer.
2. Select & edit the geometry of a single feature on a specific layer.
3. Select, translate, scale & rotate one or more features from a specific layer.
4. Allows snapping to parallel or orthogonal lines of the currently edited feature.
5. Allows snapping to edges and vertexes of features in the current layer or other vectorLayers.
6. Shows the segment lengths on edit.

## Usage

The editor defines a session concept, named `EditorSession`. An editor session
is active as soon as its created and can be either stopped by calling the `stop`
method or by being removed from the current `VcsApp`s `EventHandler`.

For the above outlined functionality, there are three types of sessions which can be
created, each intended for a specific use case.

### Creating Features

If you wish to start a `CreateFeatureSession`, you must call the `startCreateFeatureSession`
helper, to create it. Once created you can listen to the sessions events to handle creation
& stopping. In the options snapping options can be controlled, for example which layer should be snapped to.
The following outlines some example usage:

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
  const session = startCreateFeatureSession(
    app,
    layer,
    GeometryType.LineString,
    'absolute',
    {
      snapTo: ['orthogonal', 'parallel', 'vertex', 'edge'],
      initialSnapToLayers: [layer],
      hideSegmentLength: false,
    },
  );
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
  const session = startCreateFeatureSession(
    app,
    layer,
    GeometryType.LineString,
  );

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

### Selecting Features

To select features of a layer, you must start the `EditGeometrySession` using
the `startEditGeometrySession` helper.

```javascript
import {
  VcsApp,
  VectorLayer,
  startSelectFeaturesSession,
  SelectionMode,
} from '@vcmap/core';
import { Circle, Fill, Style, Stroke } from 'ol/style.js';

// The app on which all things happen
const app = new VcsApp();
// The layer we wish to edit
const layer = new VectorLayer();
app.layers.add(layer);
await layer.activate();

/**
 * This will start a selection session on the layer indefinitly
 */
function selectLayerFeatures() {
  startSelectFeaturesSession(app, layer);
}

/**
 * In order to select specific features they can be set on the session.
 * The selection can also be cleared.
 * @param {string} featureId
 */
async function setAndClearTheCurrentFeatures(featureId) {
  const session = startSelectFeaturesSession(app, layer);
  const feature = layer.getFeatureById(featureId);
  await session.setCurrentFeatures([feature]);
  session.clearSelection();
}

/**
 * You can change the initial mode and change the mode afterwards.
 * Additionally you can listen to mode changes.
 */
function changingSelectionMode() {
  const session = startSelectFeaturesSession(
    app,
    layer,
    undefined,
    SelectionMode.SINGLE,
  );
  session.modeChanged.addEventListener((newMode) => {
    console.log(`The new selection mode is ${newMode}`);
  });
  session.setMode(SelectionMode.MULTI);
}

/**
 * You can change the selection style
 */
function startWithDifferentSelectionStyle() {
  const fill = new Fill({ color: 'rgba(153,204,255,0.2)' });
  const stroke = new Stroke({ color: '#0099ff', width: 2 });
  const style = new Style({
    fill,
    stroke,
    image: new Circle({ fill, stroke, radius: 14 }),
  });
  startSelectFeaturesSession(
    app,
    layer,
    undefined,
    SelectionMode.SINGLE,
    style,
  );
}

/**
 * You can sync information from the session with another structure.
 * @param {{ currentFeatures: Array<import("ol").Feature>}} info
 */
function snycInfo(info) {
  const session = startSelectFeaturesSession(app, layer);
  session.featuresChanged.addEventListener((features) => {
    info.currentFeatures = features;
  });
}
```

### Editing Feature Geometries

To edit the feature geometries in a layer, you must start the `EditGeometrySession` using
the `startEditGeometrySession` helper.
In order to edit the geometry of a feature, it must be set on the session.
For using this session with a select session, see the [Select and Edit Chapter](#selecting-and-editing-features).

When used without a select features session, the enableSwitch property of the oblique map must be set manually false while editing.

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
 * In order to edit a feature you need to use the setFeature function.
 * @param {string} featureId
 */
async function setTheCurrentFeature(featureId) {
  const session = startEditGeometrySession(app, layer);
  const feature = layer.getFeatureById(featureId);
  await session.setFeature(feature);
}

/**
 * You can finish editing a feature, if you set null as feature.
 * @param {VcsEvent<void>} finishEvent
 */
function finishEvent(finishEvent) {
  const session = startEditGeometrySession(app, layer);
  finishEvent.addEventListener(() => {
    if (session.feature) {
      session.setFeature(null);
    }
  });
}
```

### Transforming Features

There are four ways to transform features. This includes in all viewers 1) translate, 2)
scale and 3) rotate. In 3D, you can also extrude features. Transformations can be applied
to a selection set, as opposed to editing of geometries, which only works on single features.
In order to edit features, they must be set on the session.
For using this session with a select session, see the [Select and Edit Chapter](#selecting-and-editing-features).

Once you have started a session, the session will take care of handling map changes and trys to maintain the users selection set (of course this cannot
be done in oblique). You can also change the _mode_ of the current session
without clearing the selectiong set.
When used without a select features session, the enableSwitch property of the oblique map must be set manually false while editing.

```javascript
import {
  VcsApp,
  VectorLayer,
  startEditFeaturesSession,
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
 * In order to edit a feature you need to use the setFeatures function.
 * @param {string} featureId
 */
async function setTheCurrentFeatures(featureId) {
  const session = startEditFeaturesSession(app, layer);
  const feature = layer.getFeatureById(featureId);
  await session.setFeatures([feature]);
}

/**
 * You can change the initial mode
 */
function startWithRotate() {
  startEditFeaturesSession(app, layer, undefined, TransformationMode.ROTATE);
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

### Selecting and editing features

To edit selected features a SelectFeaturesSession must be started first. With the help of the featuresChanged event the features can then be passed to the Edit session. In the following this will be demonstrated using the `EditFeaturesSession`. Whe using `EditGeometrySession`, the mode of the feature selection should be `SelectionMode.SINGLE`.

```javascript
import {
  VcsApp,
  VectorLayer,
  startSelectFeaturesSession,
  startEditFeaturesSession,
} from '@vcmap/core';

/**
 * Set selected features for feature transformation session.
 */
function selectFeaturesForEditing() {
  const selectSession = startSelectFeaturesSession(app, layer);
  const editSession = startEditFeaturesSession(app, layer);

  selectSession.featuresChanged.addEventListener((features) => {
    editSession.setFeatures(features);
  });
}

/**
 * Stop edit session when select session is stopped.
 */
function listenToStop() {
  const selectSession = startSelectFeaturesSession(app, layer);
  const editSession = startEditFeaturesSession(app, layer);

  selectSession.stopped.addEventListener(() => {
    editSession.stop();
  });
}
```

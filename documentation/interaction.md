# Interactions

The interactions concept is an abstraction layer handling [pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) of the user interacting with the map and its content.
The combination of mouse pointer keys, modification keys and event types is called `Interaction`.
The [EventHandler](#event-handler) handles _ordered_ interactions within a chain and the `InteractionEvent` gets passed down from one event to the next in a specific order.

## Interaction types

All interactions are derived from the [AbstractInteraction](../src/interaction/abstractInteraction.ts) class.
An interaction is defined by

- an `id` making it unique
- an event type represented by a bitmask
- a modification key represented by a bitmask
- a pointer key represented by a bitmask and
- a `pipe` method defining the behavior of the interaction.

The state of the interaction can be changed by changing the active event type, the modification key or pointer key.
To let an interaction listen to a click event call:

```js
myInteraction.setActive(EventType.CLICK);
```

Every time the active event type of the interaction is raised, an `InteractionEvent` will be piped:

```js
/**
 * @typedef {MapEvent} InteractionEvent
 * @property {EventType} type
 * @property {undefined|import("ol").Feature<import("ol/geom/Geometry").default>|import("@vcmap-cesium/engine").Cesium3DTileFeature|import("@vcmap-cesium/engine").Cesium3DTilePointFeature|import("@vcmap-cesium/engine").Entity} feature - a potential feature at said location
 * @property {boolean|undefined} stopPropagation - if set to true, the event chain is interrupted
 * @property {undefined|ObliqueParameters} obliqueParameters - additional parameters from oblique if obliquemode is active
 * @property {import("@vcmap-cesium/engine").Ray|undefined} ray - potential ray
 * @property {boolean|undefined} exactPosition - whether the position is exact, eg with translucentDepthPicking on
 */
```

To define a behaviour of the interaction, the `pipe` method of [AbstractInteraction](../src/interaction/abstractInteraction.ts) must be implemented.
It can react on the InteractionEvent using its properties. Since interactions are chained and the event is passed down a specific order you can stop the event beeing passed on to the next interaction by stop propagation:

```js
async pipe(event) {
  // do something defining the behaviour of the interaction, e.g.:
  if (event.feature) {
    // ...
  }
  // prevent the event from beeing passed to the next interaction within the chain
  event.stopPropagation = true;
  return event;
}
```

To reset the interaction to its default behaviour call without parameters:

```js
myInteraction.setActive();
```

For the given example your interaction would stop now to listen to the click event.

## Event handler

All [maps](./maps.md) share a common event handler.
The event handler chains registered interactions and pipes the corresponding events to the interaction in a specific order.

Per default the event handler has base interactions already registered:

- [CoordinateAtPixelInteraction](../src/interaction/coordinateAtPixel.ts) providing a click position
- [FeatureAtPixelInteraction](../src/interaction/featureAtPixelInteraction.ts) providing a clicked feature
- [FeatureProviderInteraction](../src/interaction/featureProviderInteraction.ts) providing a clicked feature from a [FeatureProvider](../src/featureProvider/abstractFeatureProvider.ts).

Those interactions are lined up at the beginning of the chain and will enrich the `InteractionEvent` by a position and a feature, if available.

Apart from those, custom interactions can be implemented by extending [AbstractInteraction](../src/interaction/abstractInteraction.ts).
They can be registered at the event handler as [exclusive](#exclusive-interaction) or [persistent](#persistent-interaction) interaction.

### Exclusive interaction

The event handler supports one exclusive interaction to be registered.
This is the default methodology for user map interactions, such as drawing or measuring.
If another exclusive interaction is added, this interaction is removed and a provided callback is called.
Since an [InteractionChain](../src/interaction/interactionChain.ts) is also an interaction, multiple interactions can be added as an exclusive chain.

```js
const { eventHandler } = app.maps;
const listener = eventHandler.addExclusiveInteraction(
  interaction,
  () => {}, // callback executed on removing
);

// when done, call the returned function to unlisten
listener();
```

### Persistent interaction

Interactions can also be added permanently to the interaction chain.

> Only add non-interferring interactions in such a fashion (for instance for displaying the cursor position).

```js
const { eventHandler } = app.maps;
const listener = eventHandler.addPersistentInteraction(interaction);

// when done, call the returned function to unlisten
listener();
```

### Feature Detection

The `FeatureAtPixelInteraction` on the `EventHander` detects features
on the current map at adds them to the Event. Since this can
be costly, especially in 3D, picking is not active for `MOVE` events
by default. If you wish to enable feature picking on move, you
will have to do the following:

```js
const { eventHandler } = app.maps;
eventHandler.featureInteraction.setActive(EventType.ALL);
```

Furthermore, the position is only picked with respect to
features in 3D for `CLICK` events. To have the position
update to be the position on the feature instead of on the globe
for other event types, you will have to do the following:

```js
const { eventHandler } = app.maps;
eventHandler.pickPosition = EventType.CLICKMOVE; // pick on click and move
```

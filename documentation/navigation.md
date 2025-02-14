# Navigation

The [Navigation](../src/map/navigation/navigation.ts) class provides capabilities to navigate the camera through maps using keyboard or gamepad controller.
Navigation is available, if a map is active, which provides a [navigation implementation](#navigation-types-and-their-implementations).
For the KeyboardController additionally the map target has to be focused.

Navigation respects the `disableMovement` API of the [VcsMap](../src/map/vcsMap.ts) class.
You can disable navigation movement by requesting exclusive map controls.
Since navigation responds to key events, set this option in `DisableMapControlOptions` to true or disable entire map controls by passing true.

```js
app.maps.requestExclusiveMapControls(
  true, // boolean or DisableMapControlOptions
  () => {
    // remove callback, which is called when the control request is forcefully removed.
  },
  id, // optional id to identify the owner of the exclusive map controls.
);
```

If at least one controller is registered, navigation starts a loop to request controller inputs each at regular intervals.
If there are inputs, those are forwarded to the current navigation implementation.
When forwarding the inputs there is an easing step taking one second for a smoother navigation and better user experience.
The easing linearly interpolates from the current movement to the target movement.

## Navigation types and their implementations

For different map types there have to be different [NavigationImpl](../src/map/navigation/navigationImpl.ts), which contain the logic to navigate through the specific map.
There are three default navigation implementations:

- [CesiumNavigation](../src/map/navigation/cesiumNavigation.ts) for navigation in 3D
- [OpenlayersNavigation](../src/map/navigation/openlayersNavigation.ts) for navigation in 2D
- [ObliqueNavigation](../src/map/navigation/obliqueNavigation.ts) for navigation in oblique

Additionally custom navigation implementations can be registered.
This can be either done to override a default navigation implementation or to register a new implementation for another map type.

To register a new implementation, you have to provide three things:

- the map you want to register the custom navigation for,
- the custom navigation implementation itself, which has to extend [NavigationImpl](../src/map/navigation/navigationImpl.ts) and
- a remove callback, which is called when the navigation implementation is forcefully removed.

You receive a function as a return value, which you can call to remove the custom navigation.

For example:

```js
const removeCustomImpl = app.maps.navigation.setNavigationImplForMap(
  customMap,
  new CustomNavigationImpl(),
  rmCallback,
);
```

## Controller

To receive and handle user input there is a [Controller](../src/map/navigation/controller/controller.ts) class.
A controller instance is designed to map the user input to 6 directed [input](../src/map/navigation/controller/controllerInput.ts) axes:

- forward: amount translating the camera forward (positive amount) or backward (negative amount)
- right: amount translating the camera right (positive amount) or left (negative amount)
- up: amount translating the camera up (positive amount) or down (negative amount)
- tiltDown: amount tilting the camera down (positive amount) or up (negative amount) around pitch axis
- rollRight: amount rolling the camera right (positive amount) or left (negative amount) around roll axis
- turnRight: amount turning the camera right (positive amount) or left (negative amount) around yaw axis (heading)

Depending on the NavigationImpl and its corresponding map some axes maybe neglected (e.g. rotation is ignored in 2D and oblique).

Per default a [KeyboardController](../src/map/navigation/controller/keyboardController.ts) is provided, which maps keyboard keys to specific map movements.
Other controller can be easily implemented by extending the Controller class.
It has to implement the `getControllerInput` function, which defines the logic to derive [ControllerInputs](../src/map/navigation/controller/controllerInput.ts).
For a gamepad implementation you could use the [GamepadAPI](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API) and access a connected gamepad.
Gamepads provide buttons and axes. The relevant inputs can be mapped to a `ControllerInput` object, like the following snippet shows:

```typescript
/**
 * Maps controller inputs to NavigationAxes [x, y, z, rx, ry, rz]
 */
function getControllerInput(): ControllerInput | null {
  const gp = navigator?.getGamepads()[0]; // accessing first connected gamepad
  if (gp) {
    // You could choose other axes or buttons depending on your gamepad
    return {
      forward: gp.axes[0],
      right: gp.axes[1],
      up: gp.axes[2],
      tiltDown: gp.axes[3],
      rollRight: gp.axes[4],
      turnRight: gp.axes[5],
    };
  }
  return null;
}
```

To add a new controller you can use the corresponding API:

```js
app.maps.navigation.addController(new GamepadController({ id: 'PS Gamepad' }));
```

To remove a controller use:

```js
app.maps.navigation.removeController(myGamepadId);
```

Also added controllers can be accessed:

```js
app.maps.navigation.getControllers();
app.maps.navigation.getController(controllerId);
```

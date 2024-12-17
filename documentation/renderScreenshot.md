# Render Screenshot Utility Documentation

## Overview

print provides functionality to create screenshots from different map types (Cesium, Openlayers, Oblique) and handle the resulting image blob. The main function described here is `renderScreenshot`.

## Functions

### `renderScreenshot`

This function prepares the map for a screenshot and returns a canvas element with the rendered image.

#### Parameters

- `app` (`VcsApp`): The VcsApp instance.
- `width` (`number`): The width of the screenshot in pixels.

#### Returns

- `Promise<HTMLCanvasElement>`: A promise that resolves to the canvas element containing the screenshot.

#### Usage

```typescript
import { renderScreenshot } from './src/util/print';
import VcsApp from './src/vcsApp';

const app = new VcsApp();
const width = 1920;

renderScreenshot(app, width).then((canvas) => {
  // Use the canvas element
});
```

## Notes

- Ensure that the map instance is properly initialized before calling this function.
- The function supports different map types including Cesium, Openlayers, and Oblique.
- The function handles the preparation and resetting of the map state before and after taking the screenshot.

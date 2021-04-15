import { getFramework, destroy } from './framework.js';

function resetFramework() {
  destroy();
  getFramework().mapcontainer = document.getElementById('mapContainer');
}

export default resetFramework;

import { setLogLevel } from '@vcsuite/logger';
import {
  mercatorProjection,
  setDefaultProjectionOptions,
} from '../src/util/projection.js';
import { setupCesiumContextLimits } from './unit/helpers/cesiumHelpers.js';

export const mochaHooks = {
  beforeAll(done) {
    setLogLevel(false);
    setDefaultProjectionOptions(mercatorProjection.toJSON());
    setupCesiumContextLimits();
    done();
  },
};

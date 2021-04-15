import { fromRollup } from '@web/dev-server-rollup';
import rollupCommonjs from '@rollup/plugin-commonjs';
import rollupNodeResolve from '@rollup/plugin-node-resolve';

const commonjs = fromRollup(rollupCommonjs);
const nodeResolve = fromRollup(rollupNodeResolve);

export default {
  plugins: [
    nodeResolve({
      include: [
        // the commonjs plugin is slow, list the required packages explicitly:
        '**/node_modules/axios/**/*',
      ],
      browser: true,
    }),
    commonjs({
      include: [
        // the commonjs plugin is slow, list the required packages explicitly:
        '**/node_modules/axios/**/*',
        '**/node_modules/tinyqueue/**/*',
        '**/node_modules/rbush-knn/**/*',
        '**/node_modules/rbush/**/*',
        '**/node_modules/fast-deep-equal/**/*',
        '**/node_modules/underscore.template/**/*',
      ],
    }),
  ],
};

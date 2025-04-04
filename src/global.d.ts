import type VcsApp from './vcsApp.js';
import { mouseOverSymbol } from './util/editor/editorSymbols.js';
// eslint-disable-next-line import/no-named-default
import type { default as VcsModule, VcsModuleConfig } from './vcsModule.js';

declare global {
  interface Window {
    vcs: {
      apps: Map<string, VcsApp>;
      createModuleFromConfig: (config: VcsModuleConfig) => VcsModule;
      getFirstApp: () => VcsApp | undefined;
      workerBase?: string;
    };
    opera?: string;
  }
  interface CSSStyleDeclaration {
    [mouseOverSymbol]?: string;
  }
}

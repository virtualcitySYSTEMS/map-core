import type VcsApp from './vcsApp.js';
import { mouseOverSymbol } from './util/editor/editorSymbols.js';

declare global {
  interface Window {
    vcs: { apps: Map<string, VcsApp> };
    opera?: string;
  }
  interface CSSStyleDeclaration {
    [mouseOverSymbol]?: string;
  }
}

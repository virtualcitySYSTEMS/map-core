import jsdomGlobal from 'jsdom-global';

jsdomGlobal(undefined, {
  pretendToBeVisual: true,
  url: 'http://localhost',
  referrer: 'http://localhost',
});

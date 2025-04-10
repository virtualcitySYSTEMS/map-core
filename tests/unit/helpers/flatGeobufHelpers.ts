import type { ReplyFnContext, ReplyFnResult, Scope } from 'nock';
import nock from 'nock';
import fs from 'fs';

export function setupFgbNock(buffer?: Buffer): Scope {
  const bytes = buffer ?? fs.readFileSync('tests/data/wgs84Points.fgb');

  function cb(this: ReplyFnContext): ReplyFnResult {
    const header = this.req.headers;
    const range = header.range.split('=')[1].split('-').map(Number);
    range[1] = Math.min(range[1], bytes.length - 1);
    return [200, bytes.subarray(range[0], range[1] + 1)];
  }

  return nock('http://localhost').persist().get('/wgs84Points.fgb').reply(cb);
}

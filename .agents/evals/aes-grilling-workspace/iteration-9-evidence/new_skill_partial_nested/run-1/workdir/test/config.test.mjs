import assert from 'node:assert/strict';
import { loadConfig, resetConfigForTests } from '../src/config.mjs';

export function testLoadsDefaults() {
  resetConfigForTests();
  delete process.env.NODE_ENV;
  const cfg = loadConfig();
  assert.equal(cfg.port, 8080);
  assert.equal(cfg.forward.enabled, true);
  assert.equal(cfg.validate.rejectUnknownFields, false);
}

export function testCachesAcrossCalls() {
  resetConfigForTests();
  delete process.env.NODE_ENV;
  assert.equal(loadConfig(), loadConfig());
}

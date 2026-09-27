/* Tests for site/js/time.js — which lighting preset Tampa is in.
   Every case is a fixed UTC instant, so the result can't depend on the
   timezone of the machine running the tests, which is the whole point:
   a visitor in London sees Tampa's light, not London's. */
const test = require("node:test");
const assert = require("node:assert");
const { tampaHour, presetFor } = require("../site/js/time.js");

const at = (iso) => new Date(iso);

test("tampaHour reads the clock in Tampa, not the visitor's", () => {
  assert.strictEqual(tampaHour(at("2026-07-15T16:00:00Z")), 12);  // EDT, UTC-4
  assert.strictEqual(tampaHour(at("2026-01-15T17:00:00Z")), 12);  // EST, UTC-5
});

test("summer (EDT) boundaries", () => {
  assert.strictEqual(presetFor(at("2026-07-15T10:59:00Z")), "night"); // 06:59
  assert.strictEqual(presetFor(at("2026-07-15T11:00:00Z")), "day");   // 07:00
  assert.strictEqual(presetFor(at("2026-07-15T20:59:00Z")), "day");   // 16:59
  assert.strictEqual(presetFor(at("2026-07-15T21:00:00Z")), "dusk");  // 17:00
  assert.strictEqual(presetFor(at("2026-07-15T23:59:00Z")), "dusk");  // 19:59
  assert.strictEqual(presetFor(at("2026-07-16T00:00:00Z")), "night"); // 20:00
});

test("winter (EST) boundaries", () => {
  assert.strictEqual(presetFor(at("2026-01-15T11:59:00Z")), "night"); // 06:59
  assert.strictEqual(presetFor(at("2026-01-15T12:00:00Z")), "day");   // 07:00
  assert.strictEqual(presetFor(at("2026-01-15T22:00:00Z")), "dusk");  // 17:00
  assert.strictEqual(presetFor(at("2026-01-16T01:00:00Z")), "night"); // 20:00
});

test("the morning clocks change (2026-03-08) uses the new offset", () => {
  // 11:00Z is 07:00 EDT; before the change it would have read 06:00 EST.
  assert.strictEqual(presetFor(at("2026-03-08T11:00:00Z")), "day");
});

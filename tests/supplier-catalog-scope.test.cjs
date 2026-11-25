"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {scopedVendorCatalog} = require("../access-model.js");
const catalog = {
  vendors: ["a", "b", "cic"].map(id => ({id, name: {zh: id}, privateNote: "not public"})),
  testcodes: [
    {id: "A1", vendorIds: ["a"], itemIds: ["only-a", "shared", "deleted"]},
    {id: "B1", vendorIds: ["b"], itemIds: ["only-b", "shared"]},
    {id: "AB1", vendorIds: ["a", "b"], itemIds: ["shared"]},
    {id: "administrative", vendorIds: [], itemIds: ["not-assigned"]},
  ],
  items: [
    {id: "only-a", fixtures: [{key: "fa"}], equipment: [{key: "ea"}]},
    {id: "only-b", fixtures: [{key: "fb"}], equipment: [{key: "eb"}]},
    {id: "shared", fixtures: [{key: "shared"}], equipment: [{key: "es"}]},
    {id: "not-assigned", fixtures: [{key: "unassigned"}], equipment: []},
  ],
  parts: Object.fromEntries(["fa", "fb", "shared", "unassigned"].map(code => [code, {code}])),
  equipment: Object.fromEntries(["ea", "eb", "es"].map(code => [code, {code}])),
};
for (const own of ["a", "b"]) test("supplier " + own + " only receives its assigned references", () => {
  const upper = own.toUpperCase();
  const v = scopedVendorCatalog(catalog, own);
  assert.deepEqual(v.testcodes.map(p => p.id), [upper + "1", "AB1"]);
  assert.deepEqual(v.items.map(i => i.id), ["only-" + own, "shared"]);
  assert.deepEqual(Object.keys(v.parts), ["f" + own, "shared"]);
  assert.deepEqual(Object.keys(v.equipment), ["e" + own, "es"]);
  assert.ok(v.testcodes.every(p => p.vendorIds.length === 1 && p.vendorIds[0] === own));
  assert.deepEqual(Object.keys(v.vendor), ["id", "name"]);
});
test("registered CIC with no assignments and unknown valid vendor both receive zero catalog data", () => {
  for (const id of ["cic", "unrecognized"]) {
    const {testcodes, items, parts, equipment} = scopedVendorCatalog(catalog, id);
    assert.deepEqual({testcodes, items, parts, equipment}, {testcodes: [], items: [], parts: {}, equipment: {}});
  }
});
test("removing last project assignment removes shared data on next publish", () => {
  const next = structuredClone(catalog);
  next.testcodes = next.testcodes.map(p => ({...p, vendorIds:p.vendorIds.filter(id => id !== "a")}));
  assert.deepEqual(scopedVendorCatalog(next, "a").items, []);
  assert.deepEqual(scopedVendorCatalog(next, "a").parts, {});
  assert.equal(scopedVendorCatalog(next, "b").parts.shared.code, "shared");
});
test("anonymous/admin sentinel cannot produce a supplier view", () => {
  for (const v of ["admin", "anon", "anonymous", "", null]) assert.throws(() => scopedVendorCatalog(catalog, v));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { OBJECTS, MAX_FIELDS, MIN_FIELDS, buildListQuery, escapeSoql, isSfId, selectFields, toSfBody } from '../server/objects.js';

const describeFor = (names) => ({
  fields: names.map((name) => ({ name, label: name, type: name === 'Amount' ? 'currency' : 'string', createable: true, updateable: true, nillable: name !== 'Name', defaultedOnCreate: false, length: 80 })),
});

test('every configured object shows between 5 and 10 fields', () => {
  for (const [name, cfg] of Object.entries(OBJECTS)) {
    assert.ok(cfg.preferred.length >= MIN_FIELDS && cfg.preferred.length <= MAX_FIELDS, name);
  }
});

test('selectFields tops up to the minimum with other fields', () => {
  const fields = selectFields(describeFor(['Name', 'A', 'B', 'C', 'D', 'E', 'Id']), ['Name']);
  assert.equal(fields.length, MIN_FIELDS);
  assert.ok(!fields.some((f) => f.name === 'Id'));
});

test('escapeSoql neutralises quote and backslash injection', () => {
  assert.equal(escapeSoql("a' OR Name != '"), "a\\' OR Name != \\'");
  assert.equal(escapeSoql('x\\'), 'x\\\\');
});

test('buildListQuery uses keyset pagination and an extra row to detect more pages', () => {
  const q = buildListQuery({ object: 'Account', fieldNames: ['Name'], nameField: 'Name', cursor: '001000000000001AAA', search: "O'Neil_%", limit: 20 });
  assert.match(q, /WHERE Id > '001000000000001AAA' AND Name LIKE '%O\\'Neil\\_\\%%'/);
  assert.match(q, /ORDER BY Id ASC LIMIT 21$/);
});

test('isSfId only accepts 15 or 18 character ids', () => {
  assert.ok(isSfId('001000000000001AAA'));
  assert.ok(!isSfId("001' OR '1'='1"));
  assert.ok(!isSfId(undefined));
});

test('toSfBody validates and coerces input', () => {
  const fields = selectFields(describeFor(['Name', 'Amount', 'A', 'B', 'C']), ['Name', 'Amount', 'A', 'B', 'C']);
  assert.deepEqual(toSfBody({ Name: 'Acme', Amount: '12.5', A: '' }, fields, 'create'), { Name: 'Acme', Amount: 12.5 });
  assert.throws(() => toSfBody({ Amount: '1' }, fields, 'create'), /Name is required/);
  assert.throws(() => toSfBody({ Name: 'x', Evil: 'y' }, fields, 'create'), /Unknown field/);
  assert.throws(() => toSfBody({ Name: 'x', Amount: 'abc' }, fields, 'create'), /must be a number/);
  assert.deepEqual(toSfBody({ A: '' }, fields, 'update'), { A: null });
});

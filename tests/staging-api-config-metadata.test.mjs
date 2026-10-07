import test from 'node:test';
import assert from 'node:assert/strict';
import {API_CONFIG_FIELDS, apiConfigMetadata} from '../scripts/staging-api-config-metadata.mjs';

test('API capability exports only reviewed booleans and an explicit metadata-only basis', () => {
  const input = {...Object.fromEntries(API_CONFIG_FIELDS.map((field) => [field, false])),
    jwt_secret:'PRIVATE_CONTRACT_MARKER', role_config:['PRIVATE_CONTRACT_MARKER']};
  const output = apiConfigMetadata(input);
  assert.equal(output.ddl_executed, false);
  assert.equal(output.actual_config_change_verified, false);
  assert.equal(output.capability_basis, 'provider_source_and_read_only_metadata');
  assert.ok(!JSON.stringify(output).includes('PRIVATE_CONTRACT_MARKER'));
});

test('missing, null or nonboolean capability metadata cannot become false permission findings', () => {
  const input = Object.fromEntries(API_CONFIG_FIELDS.map((field) => [field, false]));
  for (const value of [undefined, null, 0, 'false', {}, []]) {
    assert.equal(apiConfigMetadata({...input, authenticator_exists:value}), null);
  }
  assert.equal(apiConfigMetadata(null), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedMailRecipient} from '../lib/domain/mail-recipient.mjs';

test('lokale mail is beperkt tot synthetische ontvangers', () => {
  assert.equal(isAllowedMailRecipient('persoon@example.test', {environment: 'local'}), true);
  assert.equal(isAllowedMailRecipient('persoon@cluvo.nl', {environment: 'local'}), false);
  assert.equal(isAllowedMailRecipient('persoon@example.test.evil', {environment: 'local'}), false);
});
test('staging gebruikt exacte ontvangers en weigert ontbrekende of ruimere regels', () => {
  const options = {environment: 'staging', allowlist: 'eerste@example.test; Tweede@EXAMPLE.test\n derde@example.test'};
  assert.equal(isAllowedMailRecipient('tweede@example.test', options), true);
  for (const email of ['andere@example.test', 'eerste+ander@example.test', 'eerste@example.test.evil']) assert.equal(isAllowedMailRecipient(email, options), false);
  assert.equal(isAllowedMailRecipient('eerste@example.test', {environment: 'staging'}), false);
  assert.equal(isAllowedMailRecipient('eerste@example.test', {environment: 'staging', allowlist: '*@example.test'}), false);
  assert.equal(isAllowedMailRecipient('eerste@example.test', {environment: 'production', allowlist: 'eerste@example.test'}), false);
});

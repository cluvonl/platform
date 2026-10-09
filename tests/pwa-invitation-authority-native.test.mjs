import test from 'node:test';
import assert from 'node:assert/strict';
import {runOwnedInvitationAuthorityFence} from './helpers/pwa-owned-invitation-authority.mjs';

test('owned PG17 mobile invitation rechecks authority after a proven household lock wait and retries once',
  {skip:process.env.CLUVO_PWA_UPGRADE_NATIVE_TESTS!=='owned-pg17',timeout:180000},async()=>{
    const proof=await runOwnedInvitationAuthorityFence();
    assert.equal(proof.passed,true);
    assert.equal(proof.owned_container_removed,true);
    assert.equal(proof.migrations,34);
    assert.equal(proof.scenarios.length,4);
    assert.equal(proof.scenarios[0].same_command_retry_proved,true);
    assert.equal(proof.scenarios[0].completed_key_retry_after_authority_revocation_refused,true);
    for(const row of proof.scenarios.slice(1)){
      assert.equal(row.sqlstate,'42501');
      assert.equal(row.readback.invitations,0);
      assert.equal(row.readback.household_version,1);
      assert.equal(row.wait_proof.actual_blocked_contenders,1);
      assert.equal(row.wait_proof.independent_observer_confirmations,2);
    }
  });

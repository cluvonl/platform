import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMobilePath} from '../lib/pwa/links.mjs';
const id='10000000-0000-4000-8000-000000000001';
test('legacy Dutch routes become tenant-bound mobile links with safe resource selectors',()=>{
  assert.equal(normalizeMobilePath('/app/diensten?id='+id,'club-a'),'/app/c/club-a/tasks?task='+id+'&tab=mine');
  assert.equal(normalizeMobilePath('/#/gezin','club-a'),'/app/c/club-a/agenda');
  assert.equal(normalizeMobilePath('#kanban?id='+id,'club-a'),'/app/c/club-a/committees?view='+id);
  assert.equal(normalizeMobilePath('/app/teams?team='+id,'club-a'),'/app/c/club-a/teams?team='+id);
});
test('cross-club, external and token links cannot restore another scope or identity',()=>{
  for(const path of ['/app/c/club-b/tasks?task='+id,'https://evil.example/app/c/club-a/tasks','//evil.example/tasks','/app/c/club-a/../club-b/tasks','/app/c/club-a/tasks#access_token=secret','/app/c/club-a\\tasks'])assert.equal(normalizeMobilePath(path,'club-a'),'/app/c/club-a/notifications');
  assert.equal(normalizeMobilePath('/app/c/club-a/tasks?task='+id+'&token=private&auth_user_id='+id,'club-a'),'/app/c/club-a/tasks?task='+id);
  assert.equal(normalizeMobilePath('/tasks?task='+id+'&task='+id,'club-a'),'/app/c/club-a/tasks');
});
test('actual mobile sheets and tabs remain typed by screen while card, document and committee selectors stay UUIDs',()=>{
  for(const view of ['handover','distribution','create','goal','deadlines','feedback','assign'])assert.equal(normalizeMobilePath('/app/teams?team='+id+'&tab=organize&view='+view,'club-a'),'/app/c/club-a/teams?team='+id+'&view='+view+'&tab=organize');
  assert.equal(normalizeMobilePath('/committees?committee='+id+'&card='+id+'&doc='+id+'&view=create-card&tab=documents','club-a'),'/app/c/club-a/committees?committee='+id+'&card='+id+'&doc='+id+'&view=create-card&tab=documents');
  assert.equal(normalizeMobilePath('/manage?tab=confirm&view=create','club-a'),'/app/c/club-a/manage?view=create&tab=confirm');
  for(const screen of ['tasks','home','committees'])assert.equal(normalizeMobilePath('/'+screen+'?view=handover&committee=not-an-id&doc=private-token','club-a'),'/app/c/club-a/'+screen);
  assert.equal(normalizeMobilePath('/teams?view=handover&view=assign&tab=organize&tab=tasks','club-a'),'/app/c/club-a/teams');
  assert.equal(normalizeMobilePath('/teams?view='+'a'.repeat(2001),'club-a'),'/app/c/club-a/notifications');
});
test('notification links retain the exact typed question and handover and open the team handover view',()=>{
  assert.equal(normalizeMobilePath('/app/actions?question='+id,'club-a'),'/app/c/club-a/actions?question='+id);
  assert.equal(normalizeMobilePath('/app/teams?team='+id+'&handover='+id,'club-a'),'/app/c/club-a/teams?team='+id+'&handover='+id+'&view=handover&tab=organize');
  for(const key of ['question','handover']) {
    assert.equal(normalizeMobilePath('/app/actions?'+key+'=private-token','club-a'),'/app/c/club-a/actions');
    assert.equal(normalizeMobilePath('/app/actions?'+key+'='+id+'&'+key+'='+id,'club-a'),'/app/c/club-a/actions');
  }
});

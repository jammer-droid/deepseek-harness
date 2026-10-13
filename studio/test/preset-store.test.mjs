import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PresetStore, studioStorePath } from '../src/host/preset-store.ts';
const request = {preset:'minimal',providers:['@deepseek-ai/dsh-persona'],tools:[],prompt:'Studio instruction',model:'test'};
function runtime() {
  const registrations = new Map(); let broken = false;
  const ctx = {agentPresets:{
    list:async()=>[{id:'minimal'},...registrations.values()],
    readDocument:async()=>({content:'- name: "@deepseek-ai/dsh-persona"\n  config: {complete: true}\n'}),
    register:async definition=> {if(registrations.has(definition.id))throw Error('duplicate');registrations.set(definition.id,definition);return async()=>{registrations.delete(definition.id);};},
    resolve:async id=>({...registrations.get(id),broken:broken?'activation failed':undefined}),
    acquireScope:async()=>({key:{},[Symbol.asyncDispose]:async()=>{}}),
  },tools:{schemas:()=>[]}};
  return {ctx,registrations,fail:()=>{broken=true;}};
}
test('profile persistence saves extras, applies policy, restores last applied snapshot, deletes only owned preset',async()=>{
  const file=join(await mkdtemp(join(tmpdir(),'studio-presets-')),'presets.json');
  const a=runtime();const store=new PresetStore(a.ctx,file);
  const draft=await store.save(JSON.stringify({name:'My preset',description:'Description',request,conveniences:{arbitrary:true},agents:[{name:'helper'}]}));
  assert.equal(draft.status,'draft');assert.deepEqual(draft.agents,[{name:'helper'}]);
  await assert.rejects(store.delete('minimal'),/Studio-owned/);
  const applied=await store.apply(draft.id);assert.equal(applied.status,'applied');assert.match(applied.applyWarning,/not applied/);
  const definition=a.registrations.get(draft.id);assert.equal(definition.plugins.at(-1).name,'@local/dsh-studio-shell/policy');assert.equal(definition.plugins.at(-1).config.prompt,request.prompt);
  await store.save(JSON.stringify({...draft,name:'New draft'}));
  assert.equal((await store.list())[0].status,'modified');
  await store.dispose();assert.equal(a.registrations.size,0);
  const b=runtime();const restored=new PresetStore(b.ctx,file);await restored.initialize();
  assert.equal(b.registrations.get(draft.id).name,'My preset');assert.equal((await restored.list())[0].name,'New draft');
  await restored.apply(draft.id);assert.equal(b.registrations.get(draft.id).name,'New draft');
  await restored.delete(draft.id);assert.equal(b.registrations.size,0);assert.deepEqual((await restored.list()),[]);
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')).presets,[]);
});
test('activation failure is not reported applied and concurrent saves retain both rows',async()=>{
  const file=join(await mkdtemp(join(tmpdir(),'studio-presets-')),'presets.json');const r=runtime();const store=new PresetStore(r.ctx,file);
  const rows=await Promise.all(['one','two'].map(name=>store.save(JSON.stringify({name,description:'',request}))));
  assert.equal((await store.list()).length,2);r.fail();await assert.rejects(store.apply(rows[0].id),/activation failed/);
  assert.equal((await store.list())[0].status,'draft');assert.equal(r.registrations.size,0);
  assert.throws(()=>studioStorePath({}),/requires a profile/);assert.equal(studioStorePath({DSH_PROFILE_DIR:'/profile'}),'/profile/studio-data/presets.json');
});

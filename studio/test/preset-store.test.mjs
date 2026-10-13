import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PresetStore, studioStorePath } from '../src/host/preset-store.ts';
const request = {preset:'minimal',providers:['@deepseek-ai/dsh-persona'],tools:[],prompt:'Studio instruction',model:'test'};
function runtime() {
  const registrations = new Map(); let broken = false;
  const ctx = {get:()=>({listProviders:()=>[],resolveCallConfig:async config=>config}),agentPresets:{
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
  assert.equal(draft.status,'draft');assert.equal(draft.agents[0].name,'helper');assert.equal(draft.agents[0].model,'inherit');
  await assert.rejects(store.delete('minimal'),/Studio-owned/);
  const applied=await store.apply(draft.id);assert.equal(applied.status,'applied');assert.match(applied.applyWarning,/not applied/);
  const definition=a.registrations.get(draft.id);assert.equal(definition.plugins.at(-1).name,'@local/dsh-studio-shell/policy');assert.equal(definition.plugins.at(-1).config.prompt,request.prompt);
  await store.save(JSON.stringify({...draft,name:'New draft'}));
  assert.equal((await store.list())[0].status,'modified');
  await store.dispose();assert.equal(a.registrations.size,0);
  const b=runtime();const restored=new PresetStore(b.ctx,file);await restored.initialize();
  assert.equal(b.registrations.get(draft.id).name,'My preset');assert.equal((await restored.list())[0].name,'New draft');
  await restored.apply(draft.id);assert.equal(b.registrations.get(draft.id).name,'New draft');
  await restored.unapply(draft.id); assert.equal(b.registrations.size,0); assert.equal((await restored.list())[0].status,'draft');
  await restored.dispose();
  const c=runtime(); const reopened=new PresetStore(c.ctx,file); await reopened.initialize();
  assert.equal(c.registrations.size,0); assert.equal((await reopened.list())[0].name,'New draft');
  await reopened.apply(draft.id); assert.equal(c.registrations.get(draft.id).name,'New draft');
  await reopened.dispose();
  await restored.delete(draft.id);assert.equal(b.registrations.size,0);assert.deepEqual((await restored.list()),[]);
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')).presets,[]);
});
test('roles persist legacy overrides but apply only supported settings and replace generic delegation',async()=>{
  const file=join(await mkdtemp(join(tmpdir(),'studio-roles-')),'presets.json');const r=runtime();const store=new PresetStore(r.ctx,file);
  const role={name:'Reviewer',role:'review',model:'inherit',reasoning:'inherit',spawn:'fork',persona:'Review',overrides:{arbitrary:{unsafe:true}}};
  const draft=await store.save(JSON.stringify({name:'Roles',description:'',request,agents:[role]}));
  const {overrides,...updated}=role;
  const saved=await store.save(JSON.stringify({...draft,agents:[updated]}));
  assert.deepEqual(saved.agents[0].overrides,overrides);
  await store.apply(draft.id);
  const plugins=r.registrations.get(draft.id).plugins;
  const roles=plugins.find(row=>row.name==='@local/dsh-studio-shell/roles');
  assert.deepEqual(roles.config.roles,[updated]);
  assert.deepEqual(plugins.at(-1).config.tools,['studio_role']);
  await assert.rejects(store.save(JSON.stringify({...draft,agents:[role,role]})),/unique/);
  await store.dispose();
});
test('invalid role can be saved but apply preserves the last working snapshot', async()=>{
  const file=join(await mkdtemp(join(tmpdir(),'studio-model-')),'presets.json');const r=runtime();const store=new PresetStore(r.ctx,file);
  const draft=await store.save(JSON.stringify({name:'Valid',description:'',request}));await store.apply(draft.id);
  const before=r.registrations.get(draft.id);
  await store.save(JSON.stringify({...draft,agents:[{name:'Worker',role:'worker',model:'missing/model',reasoning:'inherit',spawn:'fresh',persona:''}]}));
  await assert.rejects(store.apply(draft.id),/not registered/);
  assert.equal(r.registrations.get(draft.id),before);assert.equal((await store.list())[0].status,'modified');await store.dispose();
});
test('activation failure is not reported applied and concurrent saves retain both rows',async()=>{
  const file=join(await mkdtemp(join(tmpdir(),'studio-presets-')),'presets.json');const r=runtime();const store=new PresetStore(r.ctx,file);
  const rows=await Promise.all(['one','two'].map(name=>store.save(JSON.stringify({name,description:'',request}))));
  assert.equal((await store.list()).length,2);r.fail();await assert.rejects(store.apply(rows[0].id),/activation failed/);
  assert.equal((await store.list())[0].status,'draft');assert.equal(r.registrations.size,0);
  assert.throws(()=>studioStorePath({}),/requires a profile/);assert.equal(studioStorePath({DSH_PROFILE_DIR:'/profile'}),'/profile/studio-data/presets.json');
});

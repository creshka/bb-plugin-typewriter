import { expect, it } from 'vitest';
import { createFakePluginHost, experimental_scanPublicSdkOnly } from '@get-bb/plugin-sdk/testing';
import plugin from './server';
it('defaults to opt-in and rejects invalid volume values',async()=>{
 const {bb,harness}=createFakePluginHost({pluginId:'typewriter'});
 plugin(bb);
 await expect(harness.behavior.setSettings({volume:101})).rejects.toThrow();
 await expect(harness.behavior.setSettings({volume:-1})).rejects.toThrow();
 await harness.behavior.setSettings({enabled:true,volume:50});
 await harness.lifecycle.dispose();
});
it('depends only on public SDK and declared packages',async()=>{
 const result=await experimental_scanPublicSdkOnly(process.cwd(), {allow:[/^react$/, /^fake-indexeddb\/auto$/]});
 expect(result.violations).toEqual([]);expect(result.privateDependencies).toEqual([]);
});

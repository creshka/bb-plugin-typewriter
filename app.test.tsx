// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { expect,it } from 'vitest';
import {loadPluginApp,mountPluginContentScripts,renderSlot} from '@get-bb/plugin-sdk/testing/app';
it('registers cleanup-safe content scripts and a usable settings page without a nav takeover',async()=>{
 const app=await loadPluginApp(()=>import('./app'));
 const scripts=await mountPluginContentScripts(app,{pluginId:'typewriter',generation:1});
 expect(app.navPanels).toHaveLength(0);
 const section=app.settingsSections[0]!;
 const slot=renderSlot(section,{}, {settings:{enabled:false,volume:35}});
 await slot.findByText('Built-in synthesized sounds');
 expect(slot.getByLabelText('Try typewriter sounds')).toBeTruthy();
 expect(slot.getByText('Test Enter sound')).toBeTruthy();
 slot.lifecycle.unmount();await scripts.lifecycle.dispose();
});

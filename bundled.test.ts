import { expect,it } from 'vitest';
import {readFileSync} from 'node:fs';
import {bundledSoundPack,withBundledSounds} from './bundled';
import {validateWav} from './samples';
it('ships all five default WAV files byte-for-byte in the playback bundle',()=>{
 const pack=bundledSoundPack();
 expect(pack.map(s=>s.name)).toEqual(['key','key2','space','delete','enter']);
 for(const sample of pack){
  expect(new Uint8Array(sample.bytes)).toEqual(new Uint8Array(readFileSync(`resources/ibm-selectric/${sample.name}.wav`)));
  expect(validateWav(`${sample.name}.wav`,sample.bytes).size).toBe(sample.size);
 }
});
it('fills missing custom sounds from the default set without alternating an unrelated key sound',()=>{
 const key={name:'key' as const,bytes:new ArrayBuffer(48),size:48};
 const merged=withBundledSounds([key]);
 expect(merged.find(s=>s.name==='key')?.bytes).toBe(key.bytes);
 expect(merged.find(s=>s.name==='key2')?.bytes).toBe(key.bytes);
 expect(merged.find(s=>s.name==='enter')?.size).toBeGreaterThan(1000);
});

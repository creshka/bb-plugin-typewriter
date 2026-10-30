// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { readPack, validateWav, loadPack, savePack } from './samples';
function wav() {const b=new ArrayBuffer(48),v=new Uint8Array(b);v.set([82,73,70,70]);v.set([87,65,86,69],8);return b;}
function file(name:string,bytes=wav()): File {return {name,size:bytes.byteLength,arrayBuffer:async()=>bytes} as File;}
it('rejects bad headers, unsupported filenames and oversized files',()=>{
  expect(()=>validateWav('key.wav',new ArrayBuffer(48))).toThrow('header');
  expect(()=>validateWav('recording.mp3',wav())).toThrow('Use');
  expect(()=>validateWav('key.wav',new ArrayBuffer(1024*1024+1))).toThrow('1 MB');
});
it('requires a main key, rejects duplicate files and undecodable WAVs',async()=>{
  await expect(readPack([file('enter.wav')],async()=>{})).rejects.toThrow('key.wav');
  await expect(readPack([file('key.wav'),file('KEY.WAV')],async()=>{})).rejects.toThrow('Duplicate');
  await expect(readPack([file('key.wav')],async()=>{throw Error();})).rejects.toThrow('decode');
});
it('imports a pack atomically and preserves it after a failed validation',async()=>{
  const pack=await readPack([file('key.wav'),file('enter.wav')],async()=>{});
  await savePack(pack);expect((await loadPack()).map(s=>s.name)).toEqual(['key','enter']);
  await expect(readPack([file('key.wav'),file('enter.wav',new ArrayBuffer(44))],async()=>{})).rejects.toThrow();
  expect((await loadPack()).map(s=>s.name)).toEqual(['key','enter']);
  await savePack([]);expect(await loadPack()).toEqual([]);
});

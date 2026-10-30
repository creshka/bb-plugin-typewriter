// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { editableTarget, keyboardSound, inputSound, synthesize, mountTyping, TypewriterAudio } from './audio';

function event(key: string, extras: KeyboardEventInit = {}) { return new KeyboardEvent('keydown', { key, ...extras }); }
describe('Typing eligibility', () => {
  it('keeps passwords, readonly, disabled and non-text controls silent', () => {
    for (const type of ['password', 'checkbox', 'file', 'range']) {
      const input = document.createElement('input'); input.type = type;
      expect(editableTarget(input)).toBe(false);
    }
    const field = document.createElement('textarea');
    expect(editableTarget(field)).toBe(true);
    field.readOnly = true; expect(editableTarget(field)).toBe(false);
    field.readOnly = false; field.disabled = true; expect(editableTarget(field)).toBe(false);
    expect(editableTarget(document.createElement('button'))).toBe(false);
  });
  it('ignores shortcuts and composing keys, handles Russian and editing keys', () => {
    for (const flags of [{ctrlKey:true}, {metaKey:true}, {altKey:true}, {isComposing:true}])
      expect(keyboardSound(event('a', flags))).toBeNull();
    for (const key of ['ArrowLeft', 'Shift', 'Tab', 'Escape', 'Unidentified']) expect(keyboardSound(event(key))).toBeNull();
    expect(keyboardSound(event('я'))).toBe('key');
    expect(keyboardSound(event(' '))).toBe('space');
    expect(keyboardSound(event('Enter'))).toBe('enter');
    expect(keyboardSound(event('Backspace'))).toBe('delete');
  });
  it('ignores paste, history and composition input while supporting mobile edits', () => {
    for (const kind of ['insertFromPaste', 'historyUndo', 'insertCompositionText']) expect(inputSound(kind)).toBeNull();
    expect(inputSound('insertText')).toBe('key');
    expect(inputSound('deleteContentBackward')).toBe('delete');
    expect(inputSound('insertLineBreak')).toBe('enter');
  });
  it('produces finite, non-silent, bounded synthesized audio with distinct lengths', () => {
    const lengths: number[] = [];
    const ctx = { sampleRate: 48000, createBuffer: (_:number, length:number) => {
      const data = new Float32Array(length); lengths.push(length);
      return {getChannelData: () => data};
    }} as unknown as BaseAudioContext;
    for (const kind of ['key', 'space', 'delete', 'enter'] as const) {
      const data = synthesize(ctx,kind).getChannelData(0);
      expect(data.some(v => Math.abs(v) > .01)).toBe(true);
      expect(data.every(v => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
      expect(Math.abs(data[0]!)).toBe(0);
    }
    expect(lengths[3]).toBeGreaterThan(lengths[0]!);
  });
  it('rejects untrusted scripted keystrokes and releases listeners and audio', () => {
    const audio = {play:vi.fn(),dispose:vi.fn()}, controller = new AbortController();
    const cleanup = mountTyping(audio, controller.signal);
    const field=document.createElement('textarea'); document.body.append(field);
    field.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));
    expect(audio.play).not.toHaveBeenCalled();
    controller.abort(); cleanup();
    expect(audio.dispose).toHaveBeenCalledOnce(); field.remove();
  });
});

describe('Audio lifecycle', () => {
  it('opt-out creates no AudioContext, live disabling silences the master, teardown closes it', async () => {
    const gains: {gain:{value:number};connect:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>}[]=[];
    const source={connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};
    const close=vi.fn().mockResolvedValue(undefined);
    const context={state:'running',destination:{},sampleRate:48000,close,
      createGain:()=>{const g={gain:{value:0},connect:vi.fn(),disconnect:vi.fn()};g.connect.mockReturnValue(g);gains.push(g);return g;},
      createBuffer:(_:number,n:number)=>({getChannelData:()=>new Float32Array(n)}),
      createBufferSource:()=>{source.connect.mockReturnValue(gains.at(-1));return source;},
    };
    const constructor=vi.fn(function(){return context;});
    vi.stubGlobal('AudioContext',constructor);
    try {
      const audio=new TypewriterAudio();audio.play('key');expect(constructor).not.toHaveBeenCalled();
      audio.apply({enabled:true,volume:50});audio.play('key');expect(source.start).toHaveBeenCalledOnce();
      expect(gains[0]!.gain.value).toBeCloseTo(.325);
      audio.apply({enabled:false,volume:50});expect(gains[0]!.gain.value).toBe(0);
      audio.dispose();expect(source.stop).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();
      audio.play('key');expect(source.start).toHaveBeenCalledOnce();
    } finally {vi.unstubAllGlobals();}
  });
});
it('uses a saved WAV on the first key after a fresh mount, without preview',async()=>{
 const imported={duration:.123};
 let finishDecode!: (value:AudioBuffer)=>void;
 const decode = new Promise<AudioBuffer>(r=>{finishDecode=r;});
 const source={buffer:null as AudioBuffer|null,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};
 const gain=()=>{const g={gain:{value:0},connect:vi.fn(),disconnect:vi.fn()};g.connect.mockReturnValue(g);return g;};
 const context={state:'running',destination:{},createGain:gain,decodeAudioData:vi.fn(()=>decode),
  createBufferSource:()=>{source.connect.mockReturnValue(gain());return source;},close:vi.fn().mockResolvedValue(undefined)};
 vi.stubGlobal('AudioContext',vi.fn(function(){return context;}));
 try {
  const audio=new TypewriterAudio(Promise.resolve([{name:'key',bytes:new ArrayBuffer(48),size:48}]));
  audio.apply({enabled:true,volume:35});audio.play('key');
  expect(source.start).not.toHaveBeenCalled();
  await vi.waitFor(()=>expect(context.decodeAudioData).toHaveBeenCalledOnce());
  finishDecode(imported as AudioBuffer);
  await vi.waitFor(()=>expect(source.start).toHaveBeenCalledOnce());
  expect(source.buffer).toBe(imported);
  audio.dispose();
 } finally {vi.unstubAllGlobals();}
});

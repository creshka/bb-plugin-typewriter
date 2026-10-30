import type { Sample, SampleName } from './samples';
export type Sound = Exclude<SampleName, 'key2'>;
export type Preferences = { enabled: boolean; volume: number };
export function editableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const field = target.closest('input, textarea, [contenteditable]');
  if (!(field instanceof HTMLElement) || field.closest('[inert], [aria-disabled="true"]')) return false;
  if (field instanceof HTMLInputElement) return !field.disabled && !field.readOnly &&
    ['text', 'search', 'email', 'url', 'tel', 'number'].includes(field.type);
  if (field instanceof HTMLTextAreaElement) return !field.disabled && !field.readOnly;
  return field.isContentEditable;
}
export function keyboardSound(e: KeyboardEvent): Sound | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return null;
  if (e.key === 'Enter') return 'enter';
  if (e.key === 'Backspace' || e.key === 'Delete') return 'delete';
  if (e.key === ' ') return 'space';
  return e.key.length === 1 ? 'key' : null;
}
export function inputSound(inputType: string): Sound | null {
  if (inputType === 'insertText') return 'key';
  if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') return 'enter';
  if (inputType.startsWith('deleteContent')) return 'delete';
  return null;
}

/** Original synthesized audio: no recordings or third-party assets. */
export function synthesize(ctx: BaseAudioContext, kind: Sound): AudioBuffer {
  const seconds = kind === 'enter' ? .42 : kind === 'space' ? .08 : .055;
  const result = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = result.getChannelData(0);
  const pitch = kind === 'space' ? 600 : kind === 'delete' ? 1300 : 980;
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate, n = Math.random() * 2 - 1;
    const click = (n - prev * .65) * Math.exp(-t * 220) * .5;
    prev = n;
    const body = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t * 100) * .22;
    const rebound = t > .018 ? n * Math.exp(-(t - .018) * 170) * .18 : 0;
    const bell = kind === 'enter' ? Math.sin(2 * Math.PI * 2100 * t) * Math.exp(-t * 16) * .12 : 0;
    data[i] = Math.max(-1, Math.min(1, (click + body + rebound + bell) * Math.min(1, t / .0007)));
  }
  return result;
}

export class TypewriterAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private builtin = new Map<Sound, AudioBuffer>();
  private imported = new Map<SampleName, AudioBuffer>();
  private voices = new Set<AudioBufferSourceNode>();
  private version = 0;
  private disposed = false;
  private variant = false;
  private samples: Sample[] = [];
  private preparing: Promise<void> | null = null;
  private loading: Promise<void> | null = null;
  private decodedVersion = -1;
  private pending = 0;
  constructor(initialPack?: Promise<Sample[]>) {
    if (initialPack) this.loading = initialPack.then(p => this.setPack(p)).catch(() => {}).then(() => { this.loading = null; });
  }
  private prefs: Preferences = { enabled: false, volume: 35 };
  private context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.apply(this.prefs);
    }
    return this.ctx;
  }
  apply(prefs: Preferences) {
    this.prefs = prefs;
    if (this.master) this.master.gain.value = prefs.enabled ? Math.max(0, Math.min(100, prefs.volume)) / 100 * .65 : 0;
  }
  async setPack(samples: Sample[]) {
    this.samples = samples;
    this.imported.clear();
    this.version++;
    this.preparing = null;
    if (this.ctx) await this.prepare();
  }
  private async prepare(): Promise<void> {
    if (this.preparing) return this.preparing;
    const ctx = this.context(), version = this.version;
    this.preparing = (async () => {
      const decoded = await Promise.all(this.samples.map(async s =>
        [s.name, await ctx.decodeAudioData(s.bytes.slice(0))] as const));
      if (!this.disposed && this.version === version) {
        this.imported = new Map(decoded); this.decodedVersion = version;
      }
    })();
    try { await this.preparing; }
    catch {
      if (this.version === version) { this.preparing = null; this.decodedVersion = version; }
      /* Invalid stored pack falls back to synthesis. */
    }
  }
  async preview(): Promise<void> {
    if (this.disposed) return;
    const ctx = this.context();
    await ctx.resume();
    await this.prepare();
    this.play('enter', true);
  }
  async validate(bytes: ArrayBuffer) { return this.context().decodeAudioData(bytes); }
  play(kind: Sound, preview = false): void {
    if (this.disposed || (!preview && !this.prefs.enabled) || this.prefs.volume <= 0) return;
    try {
      const ctx = this.context();
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      if (this.loading || (this.samples.length && this.decodedVersion !== this.version)) {
        if (this.pending >= 24) return;
        this.pending++;
        const ready = this.loading ?? this.prepare();
        void ready.then(() => { this.pending--; this.play(kind, preview); });
        return;
      }
      if (this.voices.size >= 24) return;
      const source = ctx.createBufferSource();
      if (kind === 'key') this.variant = !this.variant;
      const name = kind === 'key' && this.variant && this.imported.has('key2') ? 'key2' : kind;
      let buffer = this.imported.get(name);
      if (!buffer) {
        buffer = this.builtin.get(kind);
        if (!buffer) { buffer = synthesize(ctx, kind); this.builtin.set(kind, buffer); }
      }
      source.buffer = buffer;
      // Preview is an explicit gesture and works while general sounds are off.
      const output = ctx.createGain();
      output.gain.value = preview ? Math.max(0, Math.min(100, this.prefs.volume)) / 100 * .65 : 1;
      source.connect(output).connect(preview ? ctx.destination : this.master!);
      this.voices.add(source);
      source.onended = () => { this.voices.delete(source); source.disconnect(); output.disconnect(); };
      source.start();
    } catch { /* Audio errors must never interrupt typing. */ }
  }
  dispose() {
    this.disposed = true; this.version++;
    for (const voice of this.voices) {
      voice.onended = null;
      try { voice.stop(); } catch { /* Already finished. */ }
      voice.disconnect();
    }
    this.voices.clear(); this.imported.clear(); this.builtin.clear();
    this.master?.disconnect();
    if (this.ctx) void this.ctx.close().catch(() => {});
    this.ctx = null;
  }
}

export function mountTyping(audio: Pick<TypewriterAudio, 'play' | 'dispose'>, signal: AbortSignal) {
  let lastKeyAt = -Infinity;
  const keydown = (e: KeyboardEvent) => {
    if (!e.isTrusted || !editableTarget(e.target)) return;
    const kind = keyboardSound(e);
    if (kind || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) lastKeyAt = performance.now();
    if (kind) audio.play(kind);
  };
  const beforeinput = (e: Event) => {
    if (!(e instanceof InputEvent) || !e.isTrusted || e.isComposing ||
        !editableTarget(e.target) || performance.now() - lastKeyAt < 80) return;
    const kind = inputSound(e.inputType);
    if (kind) audio.play(kind);
  };
  document.addEventListener('keydown', keydown, { capture: true, signal });
  document.addEventListener('beforeinput', beforeinput, { capture: true, signal });
  return () => {
    document.removeEventListener('keydown', keydown, true);
    document.removeEventListener('beforeinput', beforeinput, true);
    audio.dispose();
  };
}

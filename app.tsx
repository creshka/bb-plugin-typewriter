import { useEffect, useState, type ChangeEvent } from 'react';
import { definePluginApp, useSettings } from '@get-bb/plugin-sdk/app';
import { TypewriterAudio, mountTyping, type Preferences } from './audio';
import { loadPack, readPack, savePack, type Sample } from './samples';
import './app.css';
let preferences: Preferences = { enabled: false, volume: 35 };
let engine: TypewriterAudio | null = null;

function SettingsBridge() {
  const { values, isLoading } = useSettings();
  useEffect(() => {
    if (isLoading || !values) return;
    preferences = { enabled: values.enabled === true,
      volume: typeof values.volume === 'number' && Number.isFinite(values.volume) ? values.volume : 35 };
    engine?.apply(preferences);
  }, [values, isLoading]);
  return null;
}

function SoundSettings() {
  const [pack, setPack] = useState<Sample[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { let active = true;
    loadPack().then(p => { if (active) setPack(p); }, () => {
      if (active) setError('Local sound storage is unavailable. Built-in sounds still work.');
    });
    return () => { active = false; };
  }, []);
  async function importFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); e.target.value = '';
    if (!files.length || !engine) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const imported = await readPack(files, bytes => engine!.validate(bytes));
      await savePack(imported);
      await engine.setPack(imported);
      setPack(imported); setNotice('Sound pack saved on this device.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Import failed.'); }
    finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true); setError('');
    try { await savePack([]); await engine?.setPack([]); setPack([]); setNotice('Built-in sounds restored.'); }
    catch { setError('Could not reset the local pack.'); }
    finally { setBusy(false); }
  }
  return <section className="typewriter-settings">
    <p>Mechanical clicks for typing inside BB. No microphone access or macOS Input Monitoring permission is needed.</p>
    <p>Sounds start off. If another typewriter helper is running, turn it off before enabling this plugin to avoid duplicate clicks.</p>
    <div className="typewriter-pack">
      <strong>{pack.length ? 'Custom WAV pack' : 'Built-in synthesized sounds'}</strong>
      {pack.length > 0 && <ul>{pack.map(s => <li key={s.name}>{s.name}.wav · {Math.ceil(s.size / 1024)} KB</li>)}</ul>}
      <label className="typewriter-upload">Import your own WAV files
        <input type="file" accept=".wav,audio/wav" multiple disabled={busy} onChange={importFiles} />
      </label>
      <small>Include key.wav. Optional: key2.wav, space.wav, delete.wav, enter.wav. Up to 1 MB per file, 4 MB total. Missing sounds use the built-in ones.</small>
      <small>Files stay in this browser or app’s local storage. They are not uploaded or included in a published plugin. Import separately on each device. Use recordings you have permission to use.</small>
    </div>
    <div className="typewriter-actions">
      <button type="button" disabled={busy} onClick={() => {
        setError(''); void engine?.preview().catch(() => setError('Audio unavailable. Check site sound permissions and your output device.'));
      }}>Test Enter sound</button>
      <button type="button" disabled={busy || !pack.length} onClick={() => void reset()}>Restore built-in sounds</button>
    </div>
    <label>Try typing here<textarea aria-label="Try typewriter sounds" rows={3} placeholder="Enable typing sounds above, then type here…" /></label>
    {busy && <p role="status">Importing…</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

export default definePluginApp(app => {
  app.contentScripts.register({ id: 'typing-sounds', mount({ signal }) {
    const instance = new TypewriterAudio(loadPack()); engine = instance; instance.apply(preferences);
    const dispose = mountTyping(instance, signal);
    return () => { dispose(); if (engine === instance) engine = null; };
  }});
  app.slots.experimental_appOverlay({ id: 'settings-bridge', component: SettingsBridge });
  app.slots.settingsSection({ id: 'sound-pack', title: 'Sound pack', component: SoundSettings });
});

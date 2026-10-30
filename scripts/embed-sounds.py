from pathlib import Path
import base64
root = Path(__file__).resolve().parent.parent
names = ['key', 'key2', 'space', 'delete', 'enter']
lines = ['// Generated from resources/ibm-selectric; see ATTRIBUTION.md.', 'import type { Sample, SampleName } from "./samples";', 'const sounds: Record<SampleName, string> = {']
for name in names:
    data = base64.b64encode((root / 'resources/ibm-selectric' / (name + '.wav')).read_bytes()).decode()
    lines.append(f'  {name}: "{data}",')
lines += ['};', 'export function bundledSoundPack(): Sample[] {', '  return Object.entries(sounds).map(([name, encoded]) => {', '    const raw = atob(encoded), bytes = new Uint8Array(raw.length);', '    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);', '    return { name: name as SampleName, bytes: bytes.buffer, size: bytes.byteLength };', '  });', '}', 'export function withBundledSounds(custom: Sample[]): Sample[] {', '  const merged = new Map(bundledSoundPack().map(s => [s.name, s]));', '  for (const s of custom) merged.set(s.name, s);', '  const key = custom.find(s => s.name === "key");', '  if (key && !custom.some(s => s.name === "key2")) merged.set("key2", { ...key, name: "key2" });', '  return [...merged.values()];', '}', '']
(root / 'bundled.ts').write_text('\n'.join(lines))

# Typewriter for BB

Mechanical typing sounds inside BB. The five IBM Selectric WAV recordings are included, so no separate sound download is needed. See ATTRIBUTION.md and LICENSES/Click-Clack-MIT.txt for their source and upstream notice.

## Use

Install the plugin, then open Settings → Installed plugins → Typewriter. Sounds are enabled on a new install. Disable any separate typewriter helper to avoid duplicate sounds. Existing enable and volume preferences are preserved on update. Set volume from 0 to 100 and use Test Enter sound to check your audio output. Typing sounds follow the enable setting; the test button is an explicit preview and also works when typing sounds are off.

## Personal sound packs

Choose your own WAV files in the plugin settings. Include `key.wav`; optionally add `key2.wav`, `space.wav`, `delete.wav`, and `enter.wav`. Regular keys alternate between key and key2. Missing special sounds use the included IBM Selectric recordings. Limit: 1 MB per file and 4 MB for the entire pack. Only valid, browser-decodable WAV files are accepted.

Files stay in this client’s IndexedDB. They are not uploaded to the BB server, synced to other devices, or included in this package. Import separately on each device. Clearing browser/site data removes the pack. Use only recordings you are permitted to use. This project does not grant rights to imported files.

## Behavior and privacy

Audio plays locally in the BB client. The plugin does not read field values or store, log, or transmit typed text. Password fields, read-only/disabled controls, modifier shortcuts, navigation keys and IME composition are excluded. Mobile text input is supported where the browser emits beforeinput. No macOS Input Monitoring or microphone permission is needed. Browser autoplay rules may require an initial user gesture, and site mute/output settings still apply.

Enable and volume settings are shared through BB; imported sound files remain device-local. Other open clients load their imported pack at startup; reload them after replacing a pack in another tab on the same origin.

## Development

Run `npm ci --include=dev`, `npm run typecheck`, `npm test`, and `bb plugin build`. Install the local directory with `bb plugin install .`; `bb plugin dev` rebuilds and reloads while editing. The plugin needs the BB/SDK versions declared in package.json.

The application entry uses a lifecycle-managed content script for keyboard events, an app overlay for live settings, and a settings section for preview/import. Cleanup removes listeners and closes the audio context. No private BB modules are imported.

## Publication

BB integration and fallback synthesis code: MIT. Included IBM Selectric WAV recordings match the MIT-declared upstream Click Clack repository; its copyright notice and Writemonkey 3 attribution are preserved in LICENSES/Click-Clack-MIT.txt and ATTRIBUTION.md. Personal sound imports are excluded from releases. Releases: https://github.com/creshka/bb-plugin-typewriter/tags .

To regenerate the embedded default WAV data after editing resources, run `python3 scripts/embed-sounds.py` before building.

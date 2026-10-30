# Acceptance contract

- Default-on typing sounds in text editors; silence in password, disabled and readonly fields, shortcuts and composition.
- Physical keydown and mobile beforeinput do not double-play; no text values are inspected.
- Included IBM Selectric recordings and fallback synthesized sounds need no network, microphone or OS keyboard permission.
- Imported key.wav, optional key2.wav, space.wav, delete.wav and enter.wav stay in IndexedDB on the viewing device.
- Validate imports by filename, WAV signature, size and successful audio decoding; replace a pack atomically.
- Enable/volume apply live, disable silences active voices; teardown releases audio and event listeners.
- Public package includes the five verified IBM Selectric WAV files, upstream license and attribution, with no personal filesystem paths.
- TypeScript, meaningful behavioral tests, production build and installed settings page pass.

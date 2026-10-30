import type { BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';
export default function plugin(bb: BbPluginApi) {
  bb.settings.define({
    enabled: { type: 'boolean', label: 'Enable typing sounds', default: true },
    volume: { type: 'number', label: 'Volume (0–100)', default: 35,
      experimental_schema: z.number().finite().min(0).max(100) },
  });
}

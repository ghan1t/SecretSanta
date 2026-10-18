import example from '../../../config/family.example.json';
import { parseFamily, parseDraw } from './exchange.js';

// Synthetic fixtures are used ONLY in explicitly enabled local development mode.
export const family = parseFamily(example);
export const exampleDraw = parseDraw({
	eventId: family.eventId,
	recipients: { alex: 'morgan', jamie: 'sam', morgan: 'jamie', sam: 'alex' }
}, family);

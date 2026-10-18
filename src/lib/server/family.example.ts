import example from '../../../config/family.example.json';
import { parseFamily, parseDraw } from './exchange.js';

// Fictional people and this fixed draw are used only in fictional development mode.
export const family = parseFamily(example);
export const exampleDraw = parseDraw({
	eventId: family.eventId,
	recipients: { alex: 'morgan', jamie: 'sam', morgan: 'jamie', sam: 'alex' }
}, family);

/**
 * Tests del mapper de historial para el backend Claude.
 * El historial local se guarda como { type:'user'|'bot', text } y el backend
 * espera { role:'user'|'assistant', content } con los turnos más recientes.
 */
import { mapHistoryForBackend } from './chat-history.js';

describe('mapHistoryForBackend', () => {
    test('entrada no-array → []', () => {
        expect(mapHistoryForBackend(undefined)).toEqual([]);
        expect(mapHistoryForBackend(null)).toEqual([]);
        expect(mapHistoryForBackend('nope')).toEqual([]);
    });

    test('mapea type/text → role/content (user→user, bot→assistant)', () => {
        const messages = [
            { type: 'user', text: '¿food cost?' },
            { type: 'bot', text: 'Es 32%.' },
        ];
        expect(mapHistoryForBackend(messages)).toEqual([
            { role: 'user', content: '¿food cost?' },
            { role: 'assistant', content: 'Es 32%.' },
        ]);
    });

    test('descarta entradas vacías, en blanco o con tipo inválido', () => {
        const messages = [
            { type: 'user', text: '' },
            { type: 'user', text: '   ' },
            { type: 'system', text: 'no' },
            { type: 'bot' },
            { foo: 'bar' },
            { type: 'user', text: 'válida' },
        ];
        expect(mapHistoryForBackend(messages)).toEqual([
            { role: 'user', content: 'válida' },
        ]);
    });

    test('acota a los últimos `limit` mensajes', () => {
        const messages = [];
        for (let i = 1; i <= 20; i++) {
            messages.push({ type: 'user', text: `q${i}` });
            messages.push({ type: 'bot', text: `a${i}` });
        }
        const out = mapHistoryForBackend(messages, 4);
        expect(out).toHaveLength(4);
        expect(out.map(m => m.content)).toEqual(['q19', 'a19', 'q20', 'a20']);
    });

    test('preserva el orden cronológico', () => {
        const messages = [
            { type: 'user', text: 'uno' },
            { type: 'bot', text: 'dos' },
            { type: 'user', text: 'tres' },
        ];
        expect(mapHistoryForBackend(messages).map(m => m.content))
            .toEqual(['uno', 'dos', 'tres']);
    });
});

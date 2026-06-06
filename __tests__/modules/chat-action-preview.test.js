/**
 * Tests para el modal de validación previa del chat (chat-action-preview.js).
 *
 * Blinda el flujo de doble confirmación: cuando el chat devuelve un
 * [ACTION:...], el usuario pulsa "Confirmar" debajo del mensaje y SE
 * ABRE un modal flotante con valor actual → valor nuevo. El cambio NO
 * se aplica hasta que pulsa "Aplicar cambio".
 *
 * Sin este test, alguien podría eliminar showActionConfirmModal o
 * desconectarlo de chat-messages.js y el flujo volvería al estado
 * pre-2026-06-06 (aplicación inmediata sin previsualización).
 */

import { describeAction, showActionConfirmModal } from '../../src/modules/chat/chat-action-preview.js';

describe('chat-action-preview · describeAction', () => {
    test('parsea action update|ingrediente|TOMATE|precio|2.50 correctamente', () => {
        const desc = describeAction('update|ingrediente|TOMATE|precio|2.50');
        expect(desc.parsed.action).toBe('update');
        expect(desc.parsed.entity).toBe('ingrediente');
        expect(desc.parsed.name).toBe('TOMATE');
        expect(desc.parsed.field).toBe('precio');
        expect(desc.parsed.value).toBe('2.50');
        expect(desc.objeto).toBe('TOMATE');
        expect(desc.campo).toBe('precio');
    });

    test('parsea action update|receta|spaghetti|precio_venta|16 (caso del usuario 06-jun)', () => {
        const desc = describeAction('update|receta|spaghetti|precio_venta|16');
        expect(desc.parsed.entity).toBe('receta');
        expect(desc.parsed.field).toBe('precio_venta');
        expect(desc.campo).toBe('precio de venta');
    });

    test('tolera input vacío sin reventar', () => {
        const desc = describeAction('');
        expect(desc.parsed.action).toBe('');
        expect(desc.parsed.entity).toBe('');
    });
});

describe('chat-action-preview · showActionConfirmModal', () => {
    afterEach(() => {
        // Cleanup defensivo entre tests
        document.body.innerHTML = '';
    });

    test('si action es desconocida (vacía), resuelve true sin abrir modal — no bloquea legacy', async () => {
        const result = await showActionConfirmModal('');
        expect(result).toBe(true);
        expect(document.getElementById('chat-action-preview-modal')).toBeNull();
    });

    test('action válida: monta el overlay con id chat-action-preview-modal en el body', async () => {
        // No await — necesitamos comprobar el DOM mientras el modal está abierto
        const promise = showActionConfirmModal('update|ingrediente|TOMATE|precio|2.50');
        const modal = document.getElementById('chat-action-preview-modal');
        expect(modal).not.toBeNull();
        // Cleanup: simular cancelar
        modal.querySelector('[data-action="cancel"]').click();
        const result = await promise;
        expect(result).toBe(false);
        // Tras cerrar, el modal debe haber sido removido
        expect(document.getElementById('chat-action-preview-modal')).toBeNull();
    });

    test('botón "Cancelar" resuelve la promesa con false', async () => {
        const promise = showActionConfirmModal('update|receta|spaghetti|precio_venta|16');
        const modal = document.getElementById('chat-action-preview-modal');
        modal.querySelector('[data-action="cancel"]').click();
        await expect(promise).resolves.toBe(false);
    });

    test('botón "Aplicar cambio" resuelve la promesa con true', async () => {
        const promise = showActionConfirmModal('update|receta|spaghetti|precio_venta|16');
        const modal = document.getElementById('chat-action-preview-modal');
        modal.querySelector('[data-action="apply"]').click();
        await expect(promise).resolves.toBe(true);
    });

    test('Esc cierra el modal y resuelve con false (no aplica el cambio)', async () => {
        const promise = showActionConfirmModal('update|ingrediente|TOMATE|precio|3');
        const escEvent = new window.KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(escEvent);
        await expect(promise).resolves.toBe(false);
        expect(document.getElementById('chat-action-preview-modal')).toBeNull();
    });

    test('el modal muestra "Valor nuevo" con el valor que va a aplicar', async () => {
        const promise = showActionConfirmModal('update|receta|spaghetti|precio_venta|16');
        const modal = document.getElementById('chat-action-preview-modal');
        // No conocemos el valor actual (no hay window.recetas en jsdom), pero
        // el "Valor nuevo" debe aparecer como 16
        expect(modal.textContent).toContain('16');
        modal.querySelector('[data-action="cancel"]').click();
        await promise;
    });

    test('si hay window.recetas con el plato, muestra comparación valor actual → valor nuevo', async () => {
        // Simular cache global que tendría el frontend en runtime
        window.recetas = [
            { nombre: 'Spaghetti con Tomate', precio_venta: 15 }
        ];
        const promise = showActionConfirmModal('update|receta|spaghetti|precio_venta|16');
        const modal = document.getElementById('chat-action-preview-modal');
        // Debe aparecer el bloque de comparación (no el single-value)
        expect(modal.querySelector('.cap-compare')).not.toBeNull();
        // Cleanup
        modal.querySelector('[data-action="cancel"]').click();
        await promise;
        delete window.recetas;
    });
});

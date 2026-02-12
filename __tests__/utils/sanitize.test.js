/**
 * Tests reales para el módulo sanitize
 * Verifica que escapeHTML, sanitizeHTML y sanitizeURL funcionan correctamente
 */

import { escapeHTML, sanitizeHTML, sanitizeURL } from '../../src/utils/sanitize.js';

// ============================================
// escapeHTML
// ============================================
describe('escapeHTML', () => {
    test('escapa caracteres HTML peligrosos', () => {
        const result = escapeHTML('<script>alert("xss")</script>');
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;script&gt;');
    });

    test('escapa comillas y ampersands', () => {
        const result = escapeHTML('"quotes" & <tags>');
        expect(result).toContain('&amp;');
        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
    });

    test('retorna string vacio para null/undefined/empty', () => {
        expect(escapeHTML(null)).toBe('');
        expect(escapeHTML(undefined)).toBe('');
        expect(escapeHTML('')).toBe('');
    });

    test('no modifica texto plano sin caracteres especiales', () => {
        expect(escapeHTML('Harina de trigo')).toBe('Harina de trigo');
    });

    test('escapa tags HTML como img completamente', () => {
        const result = escapeHTML('<img src=x onerror=alert(1)>');
        // escapeHTML convierte todo a entidades — el tag no se renderiza como HTML
        expect(result).not.toContain('<img');
        expect(result).toContain('&lt;img');
    });
});

// ============================================
// sanitizeHTML (DOMPurify)
// ============================================
describe('sanitizeHTML', () => {
    test('elimina tags script', () => {
        const result = sanitizeHTML('<p>Texto</p><script>alert(1)</script>');
        expect(result).toContain('<p>Texto</p>');
        expect(result).not.toContain('script');
    });

    test('preserva tags seguros (strong, em, p)', () => {
        const html = '<p><strong>Negrita</strong> y <em>cursiva</em></p>';
        const result = sanitizeHTML(html);
        expect(result).toContain('<strong>');
        expect(result).toContain('<em>');
        expect(result).toContain('<p>');
    });

    test('elimina atributos onclick', () => {
        const result = sanitizeHTML('<div onclick="alert(1)">Click</div>');
        expect(result).not.toContain('onclick');
        expect(result).toContain('Click');
    });

    test('elimina atributo style (prevencion CSS injection)', () => {
        const result = sanitizeHTML('<span style="background:url(evil)">text</span>');
        expect(result).not.toContain('style=');
    });

    test('retorna string vacio para inputs no-string', () => {
        expect(sanitizeHTML(null)).toBe('');
        expect(sanitizeHTML(undefined)).toBe('');
        expect(sanitizeHTML(123)).toBe('');
    });

    test('preserva tablas HTML', () => {
        const html = '<table><tr><td>Dato</td></tr></table>';
        const result = sanitizeHTML(html);
        expect(result).toContain('<table>');
        expect(result).toContain('<td>');
    });
});

// ============================================
// sanitizeURL
// ============================================
describe('sanitizeURL', () => {
    test('acepta URLs https', () => {
        expect(sanitizeURL('https://example.com')).toBe('https://example.com');
    });

    test('acepta URLs http', () => {
        expect(sanitizeURL('http://example.com')).toBe('http://example.com');
    });

    test('rechaza javascript: URLs', () => {
        expect(sanitizeURL('javascript:alert(1)')).toBe('');
    });

    test('rechaza javascript: con mayusculas', () => {
        expect(sanitizeURL('JavaScript:alert(1)')).toBe('');
    });

    test('rechaza data: URLs', () => {
        expect(sanitizeURL('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    test('retorna string vacio para null/undefined/empty', () => {
        expect(sanitizeURL(null)).toBe('');
        expect(sanitizeURL(undefined)).toBe('');
        expect(sanitizeURL('')).toBe('');
    });

    test('acepta URLs relativas', () => {
        expect(sanitizeURL('/path/to/resource')).toBe('/path/to/resource');
    });

    test('retorna string vacio para no-strings', () => {
        expect(sanitizeURL(123)).toBe('');
    });
});

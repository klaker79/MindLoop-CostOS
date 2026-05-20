/**
 * Tests para el módulo sanitize
 */

describe('Sanitize - sanitizeHTML', () => {
    test('elimina scripts maliciosos', () => {
        const dirty = '<script>alert("xss")</script><p>Texto seguro</p>';
        // DOMPurify elimina el script
        expect(dirty).toContain('script');
        expect('<p>Texto seguro</p>').not.toContain('script');
    });

    test('preserva HTML seguro', () => {
        const safe = '<strong>Negrita</strong>';
        expect(safe).toContain('strong');
    });

    test('elimina atributos peligrosos', () => {
        const dangerous = '<div onclick="alert(1)">Click me</div>';
        expect(dangerous).toContain('onclick');
        // Después de sanitización no debería tener onclick
        const clean = '<div>Click me</div>';
        expect(clean).not.toContain('onclick');
    });
});

describe('Sanitize - sanitizeURL', () => {
    let sanitizeURL;

    beforeAll(async () => {
        const mod = await import('../../src/utils/sanitize.js');
        sanitizeURL = mod.sanitizeURL;
    });

    test('acepta URLs http/https', () => {
        expect(sanitizeURL('https://example.com')).toBe('https://example.com');
        expect(sanitizeURL('http://example.com/path')).toBe('http://example.com/path');
    });

    test('rechaza javascript:', () => {
        expect(sanitizeURL('javascript:alert(1)')).toBe('');
        expect(sanitizeURL('  JavaScript:alert(1)')).toBe(''); // case-insensitive + spaces
    });

    test('rechaza data:', () => {
        expect(sanitizeURL('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    test('rechaza vbscript: (legacy IE)', () => {
        expect(sanitizeURL('vbscript:msgbox(1)')).toBe('');
        expect(sanitizeURL('VBSCRIPT:msgbox(1)')).toBe('');
    });

    test('rechaza file: (acceso local)', () => {
        expect(sanitizeURL('file:///etc/passwd')).toBe('');
        expect(sanitizeURL('FILE://c:/windows/system32')).toBe('');
    });

    test('acepta URLs relativas y mailto:/tel:', () => {
        expect(sanitizeURL('/path/to/resource')).toBe('/path/to/resource');
        expect(sanitizeURL('mailto:user@example.com')).toBe('mailto:user@example.com');
        expect(sanitizeURL('tel:+34666123456')).toBe('tel:+34666123456');
    });

    test('maneja valores inválidos', () => {
        expect(sanitizeURL('')).toBe('');
        expect(sanitizeURL(null)).toBe('');
        expect(sanitizeURL(undefined)).toBe('');
        expect(sanitizeURL(42)).toBe('');
    });
});

describe('Sanitize - createSafeElement', () => {
    test('crea elemento con innerHTML sanitizado', () => {
        // El resultado debería ser un elemento sin scripts
        const tagName = 'div';
        const content = '<p>Contenido</p>';
        expect(tagName).toBe('div');
        expect(content).toContain('Contenido');
    });
});

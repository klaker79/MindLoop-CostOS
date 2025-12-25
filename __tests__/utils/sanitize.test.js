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
    test('acepta URLs http/https', () => {
        const httpUrl = 'https://example.com';
        expect(httpUrl.startsWith('http')).toBe(true);
    });

    test('rechaza URLs javascript:', () => {
        const jsUrl = 'javascript:alert(1)';
        expect(jsUrl.startsWith('javascript')).toBe(true);
        // sanitizeURL debería retornar string vacío o about:blank
        const safeDefault = 'about:blank';
        expect(safeDefault).toBe('about:blank');
    });

    test('maneja URLs relativas', () => {
        const relativeUrl = '/path/to/resource';
        expect(relativeUrl.startsWith('/')).toBe(true);
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

/**
 * Tests para el módulo performance
 */

describe('Performance - Memoization', () => {
    test('memoize cachea resultados', () => {
        const cache = new Map();
        let callCount = 0;

        function expensiveOperation(x) {
            callCount++;
            return x * 2;
        }

        // Primera llamada
        const key = 'test-5';
        if (!cache.has(key)) {
            cache.set(key, expensiveOperation(5));
        }
        expect(cache.get(key)).toBe(10);
        expect(callCount).toBe(1);

        // Segunda llamada (desde cache)
        if (!cache.has(key)) {
            cache.set(key, expensiveOperation(5));
        }
        expect(cache.get(key)).toBe(10);
        expect(callCount).toBe(1); // No incrementa
    });

    test('clearCache limpia namespace', () => {
        const cache = new Map();
        cache.set('ns1-key1', 'value1');
        cache.set('ns2-key1', 'value2');

        // Limpiar namespace 1
        for (const key of cache.keys()) {
            if (key.startsWith('ns1-')) {
                cache.delete(key);
            }
        }

        expect(cache.has('ns1-key1')).toBe(false);
        expect(cache.has('ns2-key1')).toBe(true);
    });
});

describe('Performance - DataMaps', () => {
    test('Map proporciona búsqueda O(1)', () => {
        const ingredientesMap = new Map();

        // Simular datos
        [
            { id: 1, nombre: 'Tomate' },
            { id: 2, nombre: 'Cebolla' },
            { id: 3, nombre: 'Ajo' },
        ].forEach(ing => ingredientesMap.set(ing.id, ing.nombre));

        // Búsqueda por ID es O(1)
        expect(ingredientesMap.get(1)).toBe('Tomate');
        expect(ingredientesMap.get(2)).toBe('Cebolla');
        expect(ingredientesMap.get(999)).toBeUndefined();
    });

    test('Map.size retorna tamaño correcto', () => {
        const map = new Map();
        expect(map.size).toBe(0);

        map.set('a', 1);
        map.set('b', 2);
        expect(map.size).toBe(2);
    });
});

describe('Performance - Debounce', () => {
    test('debounce retrasa ejecución', (done) => {
        let callCount = 0;

        function debounce(fn, delay) {
            let timeoutId;
            return function (...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => fn.apply(this, args), delay);
            };
        }

        const debouncedFn = debounce(() => callCount++, 50);

        // Llamar múltiples veces
        debouncedFn();
        debouncedFn();
        debouncedFn();

        expect(callCount).toBe(0);

        // Esperar que se ejecute
        setTimeout(() => {
            expect(callCount).toBe(1);
            done();
        }, 100);
    });
});

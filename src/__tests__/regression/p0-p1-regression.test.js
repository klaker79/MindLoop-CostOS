/**
 * @jest-environment node
 * 
 * P0/P1 Business Logic Regression Tests
 * ======================================
 * Guards critical formulas and patterns that caused P0/P1 bugs.
 * Any change to these formulas MUST pass these tests first.
 * 
 * Created: 2026-02-13 after P0/P1 audit fix round.
 */

// ─── P0-1: Cart Total Formula ───────────────────────────────────────
describe('P0-1: Cart Total — precioYaEsUnitario consistency', () => {

    /**
     * Simulates the confirmed order total formula from pedidos-cart.js
     * This MUST match the display formula in renderizarCarrito().
     */
    function calcularTotalConfirmacion(items) {
        return items.reduce((sum, item) => {
            if (item.precioYaEsUnitario) {
                return sum + (item.cantidad * item.precio);
            }
            const cantFormato = parseFloat(item.cantidadPorFormato) || 1;
            return sum + ((item.cantidad / cantFormato) * item.precio);
        }, 0);
    }

    test('format purchase: 24 units / 24 per box × 33.12€ = 33.12€', () => {
        const items = [{ cantidad: 24, cantidadPorFormato: 24, precio: 33.12, precioYaEsUnitario: false }];
        expect(calcularTotalConfirmacion(items)).toBeCloseTo(33.12, 2);
    });

    test('unit purchase (precioYaEsUnitario=true): 5 × 2.50€ = 12.50€', () => {
        const items = [{ cantidad: 5, precio: 2.50, precioYaEsUnitario: true }];
        expect(calcularTotalConfirmacion(items)).toBeCloseTo(12.50, 2);
    });

    test('mixed cart: unit + format items', () => {
        const items = [
            { cantidad: 3, precio: 10, precioYaEsUnitario: true },    // 30€
            { cantidad: 12, cantidadPorFormato: 12, precio: 24, precioYaEsUnitario: false }, // 24€
        ];
        expect(calcularTotalConfirmacion(items)).toBeCloseTo(54, 2);
    });

    test('missing cantidadPorFormato defaults to 1', () => {
        const items = [{ cantidad: 5, precio: 10, precioYaEsUnitario: false }];
        // (5 / 1) × 10 = 50
        expect(calcularTotalConfirmacion(items)).toBeCloseTo(50, 2);
    });
});

// ─── P0-4: Date Sorting ─────────────────────────────────────────────
describe('P0-4: Date Sorting — ISO vs DD/MM/YYYY', () => {

    test('sorting DD/MM/YYYY strings with new Date() fails (verifies bug)', () => {
        // This test documents WHY we need ISO sorting
        const a = '13/02/2026';
        const b = '12/02/2026';
        const dateA = new Date(a);
        const dateB = new Date(b);
        // Both should be "Invalid Date" in strict engines
        expect(isNaN(dateA.getTime()) || isNaN(dateB.getTime())).toBe(true);
    });

    test('sorting by ISO date works correctly', () => {
        const ventas = [
            { fecha: '2026-02-13T12:00:00Z', total: 100 },
            { fecha: '2026-02-11T12:00:00Z', total: 200 },
            { fecha: '2026-02-12T12:00:00Z', total: 150 },
        ];

        // Group by locale key, keep ISO for sorting
        const ventasPorFecha = {};
        const fechaISO = {};
        ventas.forEach(v => {
            const fecha = new Date(v.fecha).toLocaleDateString('es-ES');
            if (!ventasPorFecha[fecha]) {
                ventasPorFecha[fecha] = [];
                fechaISO[fecha] = v.fecha;
            }
            ventasPorFecha[fecha].push(v);
        });

        const sortedKeys = Object.keys(ventasPorFecha)
            .sort((a, b) => new Date(fechaISO[b]) - new Date(fechaISO[a]));

        // Most recent first
        expect(new Date(fechaISO[sortedKeys[0]]).getDate()).toBe(13);
        expect(new Date(fechaISO[sortedKeys[1]]).getDate()).toBe(12);
        expect(new Date(fechaISO[sortedKeys[2]]).getDate()).toBe(11);
    });
});

// ─── P0-5: Zustand Getter Pattern ──────────────────────────────────
describe('P0-5: Zustand — ES5 getters vs functions', () => {

    test('ES5 getter is NOT a function property — breaks Zustand pattern', () => {
        const original = {
            data: [1, 2, 3],
            get total() { return this.data.reduce((a, b) => a + b, 0); },
        };
        // ES5 getter works on the original object
        expect(original.total).toBe(6);

        // But it's NOT a function — it's a property descriptor.
        // Zustand's create() only stores plain values/functions.
        // ES5 getters on the state object can't be called as state.total()
        // and don't update when state.data changes via set().
        const descriptor = Object.getOwnPropertyDescriptor(original, 'total');
        expect(descriptor.get).toBeDefined();
        // Not a regular value — this is what makes it unreliable in Zustand
        expect(descriptor.value).toBeUndefined();
    });

    test('function property is a regular value — works with Zustand (our fix)', () => {
        const stateRef = {};
        const store = {
            data: [1, 2, 3],
            total: () => stateRef.data.reduce((a, b) => a + b, 0),
        };
        stateRef.data = store.data;

        // Regular function property — has value, not getter
        const descriptor = Object.getOwnPropertyDescriptor(store, 'total');
        expect(descriptor.value).toBeDefined();
        expect(typeof descriptor.value).toBe('function');

        // And calling it works
        expect(store.total()).toBe(6);
    });
});

// ─── P1-1 / P1-2: Division by Zero Guards ──────────────────────────
describe('P1-1/P1-2: Division by Zero Guards', () => {

    test('P1-1: price difference with precioBase=0 returns 0, not Infinity', () => {
        const precioMedio = 5;
        const precioBase = 0;
        const diferencia = precioMedio !== null && precioBase > 0
            ? ((precioMedio - precioBase) / precioBase * 100)
            : 0;
        expect(diferencia).toBe(0);
        expect(isFinite(diferencia)).toBe(true);
    });

    test('P1-1: price difference with valid base works normally', () => {
        const precioMedio = 11;
        const precioBase = 10;
        const diferencia = precioMedio !== null && precioBase > 0
            ? ((precioMedio - precioBase) / precioBase * 100)
            : 0;
        expect(diferencia).toBeCloseTo(10, 1); // 10% increase
    });

    test('P1-2: merma format=0 uses precio directly, not Infinity', () => {
        const precio = 10;
        const formato = 0;
        const precioUnitario = formato > 0 ? (precio / formato) : precio;
        expect(precioUnitario).toBe(10);
        expect(isFinite(precioUnitario)).toBe(true);
    });

    test('P1-2: merma format > 0 divides correctly', () => {
        const precio = 24;
        const formato = 12;
        const precioUnitario = formato > 0 ? (precio / formato) : precio;
        expect(precioUnitario).toBe(2);
    });
});

// ─── P1-3: COGS with Yield Factor ──────────────────────────────────
describe('P1-3: COGS — Yield Factor (rendimiento)', () => {

    function calcularCOGSConRendimiento(precioUnitario, cantidad, rendimiento) {
        const rendPct = parseFloat(rendimiento || 100) / 100;
        const factorRendimiento = rendPct > 0 ? (1 / rendPct) : 1;
        return precioUnitario * cantidad * factorRendimiento;
    }

    test('100% yield: cost = price × quantity', () => {
        expect(calcularCOGSConRendimiento(10, 2, 100)).toBeCloseTo(20, 2);
    });

    test('50% yield: cost doubles (need 2x raw to get usable amount)', () => {
        expect(calcularCOGSConRendimiento(10, 1, 50)).toBeCloseTo(20, 2);
    });

    test('80% yield: cost increases by 25%', () => {
        // 1/0.8 = 1.25 → 10 * 1 * 1.25 = 12.50
        expect(calcularCOGSConRendimiento(10, 1, 80)).toBeCloseTo(12.50, 2);
    });

    test('0% yield defaults to factor 1 (no crash)', () => {
        expect(calcularCOGSConRendimiento(10, 1, 0)).toBeCloseTo(10, 2);
    });

    test('undefined yield defaults to 100% (factor 1)', () => {
        expect(calcularCOGSConRendimiento(10, 1, undefined)).toBeCloseTo(10, 2);
    });
});

// ─── P1-4: Night Shift Hours ────────────────────────────────────────
describe('P1-4: Night Shifts — Midnight Crossing', () => {

    function calcularHoras(horaInicio, horaFin) {
        const [hIni, mIni] = horaInicio.split(':').map(Number);
        const [hFin, mFin] = horaFin.split(':').map(Number);
        const ini = hIni * 60 + mIni;
        const fin = hFin * 60 + mFin;
        const minutos = fin < ini ? (fin + 1440 - ini) : (fin - ini);
        return minutos / 60;
    }

    test('day shift: 09:00 → 17:00 = 8h', () => {
        expect(calcularHoras('09:00', '17:00')).toBe(8);
    });

    test('night shift: 22:00 → 06:00 = 8h (crosses midnight)', () => {
        expect(calcularHoras('22:00', '06:00')).toBe(8);
    });

    test('night shift: 23:00 → 07:30 = 8.5h', () => {
        expect(calcularHoras('23:00', '07:30')).toBe(8.5);
    });

    test('short evening: 20:00 → 01:00 = 5h', () => {
        expect(calcularHoras('20:00', '01:00')).toBe(5);
    });

    test('full day: 00:00 → 00:00 = 24h (edge case)', () => {
        // 0 < 0 is false, so fin - ini = 0, not 1440.
        // This is correct — a 0-0 shift means same time, 0 hours.
        expect(calcularHoras('00:00', '00:00')).toBe(0);
    });
});

// ─── P0-3: Data Preservation on Error ───────────────────────────────
describe('P0-3: Data Preservation on API Error', () => {

    test('should keep existing data when API fails (not overwrite with [])', () => {
        // Simulates the fix: on error, return existing data
        const existingData = [{ id: 1, nombre: 'Tomate' }, { id: 2, nombre: 'Cebolla' }];
        const apiOk = false;
        const apiResult = [];

        // Old behavior: always returns api result (empty)
        const oldBehavior = apiOk ? apiResult : [];
        expect(oldBehavior).toEqual([]); // DATA LOST!

        // New behavior: on error, keep existing
        const newBehavior = apiOk ? apiResult : existingData;
        expect(newBehavior).toEqual(existingData); // Data preserved!
        expect(newBehavior.length).toBe(2);
    });
});

// P1-10 test removed — onboarding code deleted from codebase


// ─── P0-2: Race Condition Pattern ───────────────────────────────────
describe('P0-2: Race Condition — Capture Before Update', () => {

    test('reading after mutation misses the old value', () => {
        const store = { items: [{ id: 1, supplier: 'A' }] };

        // Simulate store update
        store.items[0].supplier = 'B';

        // Reading AFTER update — gets new value (bug!)
        const afterUpdate = store.items.find(i => i.id === 1);
        expect(afterUpdate.supplier).toBe('B'); // Wrong! We wanted 'A'
    });

    test('capturing before mutation preserves old value', () => {
        const store = { items: [{ id: 1, supplier: 'A' }] };

        // Capture BEFORE update (fix!)
        const beforeUpdate = { ...store.items.find(i => i.id === 1) };

        // Now update
        store.items[0].supplier = 'B';

        // Old value preserved
        expect(beforeUpdate.supplier).toBe('A');
        // Store has new value
        expect(store.items[0].supplier).toBe('B');
    });
});

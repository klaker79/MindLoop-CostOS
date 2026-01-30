// Código JavaScript completo (por brevedad, incluyo versión funcional comprimida)
// El código completo está disponible en el archivo descargable

(function () {
    window.ingredientes = [];
    window.recetas = [];
    window.proveedores = [];
    window.pedidos = [];
    let editandoIngredienteId = null;
    let editandoRecetaId = null;
    let editandoProveedorId = null;
    let recetaProduciendo = null;
    let chartRentabilidad = null;
    let chartIngredientes = null;



    // === SEGURIDAD: Escape HTML para prevenir XSS ===
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    // Exponer globalmente para uso en otros archivos legacy
    window.escapeHTML = escapeHTML;

    // === EXPORT A EXCEL ===
    function exportarAExcel(datos, nombreArchivo, columnas) {
        // Preparar datos para Excel
        const datosExcel = datos.map(item => {
            const fila = {};
            columnas.forEach(col => {
                fila[col.header] = col.key ? item[col.key] : col.value(item);
            });
            return fila;
        });

        // Crear libro y hoja
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(datosExcel);

        // Ajustar ancho de columnas
        ws['!cols'] = columnas.map(() => ({ wch: 20 }));

        XLSX.utils.book_append_sheet(wb, ws, 'Datos');

        // Descargar
        XLSX.writeFile(wb, `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.xlsx`);

        showToast('Excel descargado correctamente', 'success');
    }

    // === DOM HELPERS SEGUROS ===
    // Previene crashes por elementos null/undefined

    /**
     * Obtiene elemento por ID de forma segura
     * @param {string} id - ID del elemento
     * @param {string} context - Contexto para debugging
     * @returns {HTMLElement|null}
     */
    function getElement(id, context = '') {
        const element = document.getElementById(id);
        if (!element && context) {
            console.warn(`[DOM] Elemento '${id}' no encontrado en contexto: ${context}`);
        }
        return element;
    }

    /**
     * Establece texto de un elemento de forma segura
     * @param {string} id - ID del elemento
     * @param {string} text - Texto a establecer
     * @param {string} fallback - Texto por defecto si elemento no existe
     */
    function setElementText(id, text, fallback = '') {
        const element = getElement(id);
        if (element) {
            element.textContent = text;
        } else if (fallback) {
            console.warn(`[DOM] No se pudo actualizar '${id}', usando fallback`);
        }
    }

    /**
     * Establece HTML de un elemento de forma segura
     * @param {string} id - ID del elemento
     * @param {string} html - HTML a establecer
     */
    function setElementHTML(id, html) {
        const element = getElement(id);
        if (element) {
            element.innerHTML = html;
        }
    }

    /**
     * Obtiene valor de un input de forma segura
     * @param {string} id - ID del input
     * @param {*} defaultValue - Valor por defecto
     * @returns {string}
     */
    function getInputValue(id, defaultValue = '') {
        const element = getElement(id);
        return element?.value ?? defaultValue;
    }

    /**
     * Establece valor de un input de forma segura
     * @param {string} id - ID del input
     * @param {*} value - Valor a establecer
     */
    function setInputValue(id, value) {
        const element = getElement(id);
        if (element) {
            element.value = value;
        }
    }

    /**
     * Añade clase a elemento de forma segura
     * @param {string} id - ID del elemento
     * @param {string} className - Clase a añadir
     */
    function addElementClass(id, className) {
        const element = getElement(id);
        if (element) {
            element.classList.add(className);
        }
    }

    /**
     * Elimina clase de elemento de forma segura
     * @param {string} id - ID del elemento
     * @param {string} className - Clase a eliminar
     */
    function removeElementClass(id, className) {
        const element = getElement(id);
        if (element) {
            element.classList.remove(className);
        }
    }

    /**
     * Toggle clase de elemento de forma segura
     * @param {string} id - ID del elemento
     * @param {string} className - Clase a toggle
     */
    function toggleElementClass(id, className) {
        const element = getElement(id);
        if (element) {
            element.classList.toggle(className);
        }
    }

    /**
     * Muestra elemento (display)
     * @param {string} id - ID del elemento
     * @param {string} displayType - Tipo de display ('block', 'flex', etc)
     */
    function showElement(id, displayType = 'block') {
        const element = getElement(id);
        if (element) {
            element.style.display = displayType;
        }
    }

    /**
     * Oculta elemento
     * @param {string} id - ID del elemento
     */
    function hideElement(id) {
        const element = getElement(id);
        if (element) {
            element.style.display = 'none';
        }
    }

    // === HELPER MULTI-TENANT ===
    function getRestaurantNameForFile() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const name = user.restaurante || user.nombre || 'MiRestaurante';
            return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]/g, '');
        } catch {
            return 'MiRestaurante';
        }
    }

    // === EXPORTACIONES ESTANDARIZADAS (Formato TPV) ===
    // === BALANCE ===
    // === P&L UNIFICADO (Cuenta de Resultados) ===
    window.renderizarBalance = async function () {
        try {
            // 1. Cargar gastos fijos desde la BD (fuente de verdad)
            try {
                const gastosFijos = await window.API.getGastosFijos();
                if (gastosFijos && gastosFijos.length > 0) {
                    // Mapear gastos fijos a los inputs
                    gastosFijos.forEach(gasto => {
                        const concepto = gasto.concepto.toLowerCase();
                        const monto = parseFloat(gasto.monto_mensual) || 0;
                        if (concepto.includes('alquiler')) {
                            const el = document.getElementById('pl-input-alquiler');
                            if (el) el.value = monto;
                        } else if (concepto.includes('personal')) {
                            const el = document.getElementById('pl-input-personal');
                            if (el) el.value = monto;
                        } else if (concepto.includes('suministro')) {
                            const el = document.getElementById('pl-input-suministros');
                            if (el) el.value = monto;
                        } else if (concepto.includes('otros')) {
                            const el = document.getElementById('pl-input-otros');
                            if (el) el.value = monto;
                        }
                    });
                }
            } catch (error) {
                console.warn('Using localStorage for gastos fijos:', error.message);
                // Fallback a localStorage si falla la BD
                let savedOpex = {};
                try {
                    savedOpex = JSON.parse(localStorage.getItem('opex_inputs') || '{}');
                } catch (parseError) {
                    console.warn('opex_inputs corrupto:', parseError.message);
                }
                const alquilerEl = document.getElementById('pl-input-alquiler');
                const personalEl = document.getElementById('pl-input-personal');
                const suministrosEl = document.getElementById('pl-input-suministros');
                const otrosEl = document.getElementById('pl-input-otros');
                if (alquilerEl && savedOpex.alquiler) alquilerEl.value = savedOpex.alquiler;
                if (personalEl && savedOpex.personal) personalEl.value = savedOpex.personal;
                if (suministrosEl && savedOpex.suministros) {
                    suministrosEl.value = savedOpex.suministros;
                }
                if (otrosEl && savedOpex.otros) otrosEl.value = savedOpex.otros;
            }

            // 2. Obtener Datos Reales (Ventas y Costes)
            const ventas = await api.getSales();

            // Filtrar ventas del mes actual
            const ahora = new Date();
            const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
                .toISOString()
                .split('T')[0];
            const ventasMes = ventas.filter(v => v.fecha >= inicioMes);

            const ingresos = ventasMes.reduce((sum, v) => sum + parseFloat(v.total), 0);

            // Calcular COGS (Coste de lo vendido) - Optimizado con Maps O(1)
            const recetasMap = new Map(window.recetas.map(r => [r.id, r]));
            const ingredientesMap = new Map(window.ingredientes.map(i => [i.id, i]));

            let cogs = 0;
            ventasMes.forEach(venta => {
                const receta = recetasMap.get(venta.receta_id);
                if (receta && receta.ingredientes) {
                    const costeReceta = receta.ingredientes.reduce((sum, item) => {
                        const ing = ingredientesMap.get(item.ingredienteId);
                        if (!ing) return sum;
                        const cantidadFormato = parseFloat(ing.cantidad_por_formato) || 1;
                        const precioUnitario = parseFloat(ing.precio) / cantidadFormato;
                        return sum + (precioUnitario * item.cantidad);
                    }, 0);
                    cogs += costeReceta * venta.cantidad;
                }
            });

            // 3. Actualizar UI (Parte Superior)
            document.getElementById('pl-ingresos').textContent = ingresos.toFixed(2) + ' €';
            document.getElementById('pl-cogs').textContent = cogs.toFixed(2) + ' €';

            const cogsPct = ingresos > 0 ? (cogs / ingresos) * 100 : 0;
            document.getElementById('pl-cogs-pct').textContent =
                cogsPct.toFixed(1) + '% sobre ventas';

            const margenBruto = ingresos - cogs;
            document.getElementById('pl-margen-bruto').textContent = margenBruto.toFixed(2) + ' €';

            // KPIs Adicionales
            const margenPct = ingresos > 0 ? (margenBruto / ingresos) * 100 : 0;
            document.getElementById('pl-kpi-margen').textContent = margenPct.toFixed(1) + '%';

            // Ventas diarias promedio (del mes)
            const diaDelMes = ahora.getDate();
            const ventasDiarias = ingresos / diaDelMes;
            document.getElementById('pl-kpi-ventas-diarias').textContent =
                ventasDiarias.toFixed(2) + ' €';

            // 4. Calcular Resto (OPEX y Neto)
            window.calcularPL();
        } catch (error) {
            console.error('Error renderizando P&L:', error);
            showToast('Error cargando datos financieros', 'error');
        }
    };

    window.calcularPL = function () {
        // Validar que los elementos existan antes de acceder
        const ingresosEl = document.getElementById('pl-ingresos');
        const cogsEl = document.getElementById('pl-cogs');
        const alquilerEl = document.getElementById('pl-input-alquiler');
        const personalEl = document.getElementById('pl-input-personal');
        const suministrosEl = document.getElementById('pl-input-suministros');
        const otrosEl = document.getElementById('pl-input-otros');

        if (!ingresosEl || !cogsEl || !alquilerEl || !personalEl || !suministrosEl || !otrosEl) {
            console.warn('Inputs de P&L no cargados aún');
            return;
        }

        // 1. Leer Valores
        const ingresosStr = ingresosEl.textContent.replace(' €', '').replace(',', '.');
        const cogsStr = cogsEl.textContent.replace(' €', '').replace(',', '.');

        const ingresos = parseFloat(ingresosStr) || 0;
        const cogs = parseFloat(cogsStr) || 0;
        const margenBruto = ingresos - cogs;

        // Leer Inputs OPEX
        const alquiler = parseFloat(alquilerEl.value) || 0;
        const personal = parseFloat(personalEl.value) || 0;
        const suministros = parseFloat(suministrosEl.value) || 0;
        const otros = parseFloat(otrosEl.value) || 0;

        // Guardar en LocalStorage
        localStorage.setItem(
            'opex_inputs',
            JSON.stringify({ alquiler, personal, suministros, otros })
        );

        const opexTotal = alquiler + personal + suministros + otros;
        document.getElementById('pl-opex-total').textContent = opexTotal.toFixed(2) + ' €';

        // 2. Calcular Neto
        const beneficioNeto = margenBruto - opexTotal;
        const netoEl = document.getElementById('pl-neto');

        netoEl.textContent = beneficioNeto.toFixed(2) + ' €';
        netoEl.style.color = beneficioNeto >= 0 ? '#10b981' : '#ef4444'; // Verde o Rojo

        const rentabilidad = ingresos > 0 ? (beneficioNeto / ingresos) * 100 : 0;
        document.getElementById('pl-neto-pct').textContent =
            rentabilidad.toFixed(1) + '% Rentabilidad';

        // 3. Análisis Break-Even (Punto de Equilibrio)
        // BEP = Costes Fijos / (Margen Contribución %)
        // Margen Contribución % = (Ventas - Costes Variables) / Ventas
        let margenContribucionPct = 0.7; // Default 70% si no hay ventas
        if (ingresos > 0) {
            margenContribucionPct = margenBruto / ingresos;
        }

        // Evitar división por cero o márgenes negativos locos
        if (margenContribucionPct <= 0) margenContribucionPct = 0.1;

        const breakEven = opexTotal / margenContribucionPct;
        document.getElementById('pl-breakeven').textContent = breakEven.toFixed(2) + ' €';

        // 4. Actualizar Termómetro y Estado
        const estadoBadge = document.getElementById('pl-badge-estado');
        const termometroFill = document.getElementById('pl-termometro-fill');
        const mensajeAnalisis = document.getElementById('pl-mensaje-analisis');

        // Porcentaje de cumplimiento del Break Even
        // Si BreakEven es 1000 y Ingresos son 500 -> 50% (Zona Pérdidas)
        // Si BreakEven es 1000 y Ingresos son 1000 -> 100% (Equilibrio)
        // Si BreakEven es 1000 y Ingresos son 1500 -> 150% (Beneficios)

        let porcentajeCumplimiento = 0;
        if (breakEven > 0) {
            porcentajeCumplimiento = (ingresos / breakEven) * 100;
        } else if (opexTotal === 0) {
            porcentajeCumplimiento = 100; // Si no hay gastos, todo es beneficio
        }

        // Mapear porcentaje a altura del termómetro (0-100%)
        // Queremos que el 100% (Equilibrio) esté en la mitad (50%)
        // 0% cumplimiento -> 0% altura
        // 100% cumplimiento -> 50% altura
        // 200% cumplimiento -> 100% altura
        let alturaTermometro = porcentajeCumplimiento / 2;
        if (alturaTermometro > 100) alturaTermometro = 100;

        termometroFill.style.height = `${alturaTermometro}%`;

        // Colores y Mensajes
        if (ingresos < breakEven) {
            // PÉRDIDAS
            estadoBadge.textContent = 'EN PÉRDIDAS';
            estadoBadge.style.background = '#fee2e2';
            estadoBadge.style.color = '#991b1b';

            const falta = breakEven - ingresos;
            mensajeAnalisis.innerHTML = `Te faltan <strong>${falta.toFixed(0)}€</strong> para cubrir gastos.<br>Estás al <strong>${porcentajeCumplimiento.toFixed(0)}%</strong> del objetivo.`;
        } else {
            // BENEFICIOS
            estadoBadge.textContent = 'EN BENEFICIOS';
            estadoBadge.style.background = '#d1fae5';
            estadoBadge.style.color = '#065f46';

            const sobra = ingresos - breakEven;
            mensajeAnalisis.innerHTML = `¡Enhorabuena! Cubres gastos y generas <strong>${beneficioNeto.toFixed(0)}€</strong> de beneficio.<br>Superas el equilibrio por <strong>${sobra.toFixed(0)}€</strong>.`;
        }
    };

    // ========== AUTENTICACIÓN ==========
    // ⚡ Multi-tenant: usa config global si existe
    const API_AUTH_URL = (window.API_CONFIG?.baseUrl || 'https://lacaleta-api.mindloop.cloud') + '/api/auth';

    function checkAuth() {
        const token = localStorage.getItem('token');
        if (token) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';
            return true;
        }
        return false;
    }

    document.getElementById('login-form').addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');

        try {
            const res = await fetch(API_AUTH_URL + '/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                errorEl.textContent = data.error || 'Error al iniciar sesión';
                return;
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';

            init();
        } catch (err) {
            errorEl.textContent = 'Error de conexión';
        }
    });


    // ========== SIMULADOR FINANCIERO ==========
    window.actualizarSimulador = function () {
        const alquiler = parseInt(document.getElementById('input-alquiler').value) || 0;
        const personal = parseInt(document.getElementById('input-personal').value) || 0;
        const suministros = parseInt(document.getElementById('input-suministros').value) || 0;

        // Actualizar etiquetas
        document.getElementById('label-alquiler').textContent =
            alquiler.toLocaleString('es-ES') + ' €';
        document.getElementById('label-personal').textContent =
            personal.toLocaleString('es-ES') + ' €';
        document.getElementById('label-suministros').textContent =
            suministros.toLocaleString('es-ES') + ' €';

        // Obtener Margen Bruto (Ingresos - Coste Recetas)
        // Usamos el valor calculado previamente en renderizarBalance
        const margenBrutoElem = document.getElementById('balance-ganancia');
        let margenBruto = 0;

        if (margenBrutoElem) {
            // El valor en balance-ganancia viene de .toFixed(2) + '€' -> "2172.01€"
            // OJO: Si se cambia el locale, esto podría variar. Asumimos formato standard JS (punto decimal)
            // Si fuera locale string (con puntos de mil), habría que limpiar puntos y cambiar coma por punto.
            // Para seguridad, limpiamos todo excepto dígitos, punto y menos.
            const text = margenBrutoElem.textContent;
            // Si contiene "€", lo quitamos.
            // Si el formato es "2.172,01" (ES) vs "2172.01" (US/JS)
            // renderizarBalance usa .toFixed(2) -> "2172.01" (US format)
            const cleanText = text.replace('€', '').trim();
            margenBruto = parseFloat(cleanText);

            if (isNaN(margenBruto)) margenBruto = 0;
        }

        const costosFijos = alquiler + personal + suministros;
        const neto = margenBruto - costosFijos;

        // Actualizar UI Simulador
        document.getElementById('sim-margen-bruto').textContent =
            margenBruto.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';
        document.getElementById('sim-costos-fijos').textContent =
            costosFijos.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';

        const netoElem = document.getElementById('sim-resultado-neto');
        netoElem.textContent = neto.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';

        // Color Dinámico y Barra Progreso
        const progressBar = document.getElementById('sim-progreso-fill');
        const analytics = document.getElementById('sim-analytics');

        let porcentajeCubierto = 0;
        if (costosFijos > 0) {
            porcentajeCubierto = (margenBruto / costosFijos) * 100;
        } else {
            porcentajeCubierto = 100; // Si no hay costos, cubrimos "todo"
        }

        // Limitamos visualmente al 100% para la barra interna (aunque conceptualmente puede pasar)
        const widthPct = Math.min(Math.max(porcentajeCubierto, 0), 100);
        progressBar.style.width = widthPct + '%';

        if (neto >= 0) {
            netoElem.style.color = '#10b981'; // Verde
            progressBar.style.background = 'linear-gradient(90deg, #10b981 0%, #34d399 100%)';
            analytics.innerHTML =
                '<span>🚀</span> ¡Beneficio! Cubres el <strong>' +
                porcentajeCubierto.toFixed(0) +
                '%</strong> de tus costes fijos.';
            analytics.style.color = '#059669';
        } else {
            netoElem.style.color = '#ef4444'; // Rojo
            progressBar.style.background = 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)';
            analytics.innerHTML =
                '<span>🚑</span> Pérdidas. Solo cubres el <strong>' +
                porcentajeCubierto.toFixed(0) +
                '%</strong> de tus costos fijos.';
            analytics.style.color = '#dc2626';
        }

        // Break-Even Display
        // Punto Equilibrio (Ingresos) = Costos Fijos / %Margen
        // Primero calculamos el % de Margen real
        const ingresosElem = document.getElementById('balance-ingresos');
        let ingresos = 0;
        if (ingresosElem) {
            // Mismo fix de parsing
            const textIng = ingresosElem.textContent.replace('€', '').trim();
            ingresos = parseFloat(textIng) || 0;
        }

        let breakEven = 0;
        if (ingresos > 0) {
            const margenPorcentaje = margenBruto / ingresos;
            if (margenPorcentaje > 0) {
                breakEven = costosFijos / margenPorcentaje;
            }
        }
        document.getElementById('break-even-display').textContent =
            breakEven.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';

        // Barra de Progreso (Visualización simple: % de cubrimiento de costos fijos)
        const progresoFill = document.getElementById('sim-progreso-fill');
        let porcentajeCobertura = 0;
        if (costosFijos > 0) {
            porcentajeCobertura = (margenBruto / costosFijos) * 100;
        } else if (margenBruto > 0) {
            porcentajeCobertura = 100;
        }

        if (porcentajeCobertura > 100) porcentajeCobertura = 100;
        progresoFill.style.width = porcentajeCobertura + '%';

        // Actualizar también la Card de Beneficio Neto superior
        document.getElementById('balance-neto').textContent =
            neto.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';

        if (neto >= 0) {
            document.getElementById('balance-mensaje-neto').textContent = 'Pérdida Real';
            document.getElementById('balance-mensaje-neto').style.color = '#ffccc7';
        }
    };

    async function init() {
        // Mostrar nombre del restaurante
        let user = {};
        try {
            user = JSON.parse(localStorage.getItem('user') || '{}');
        } catch (parseError) {
            console.warn('user localStorage corrupto en init:', parseError.message);
        }
        if (user.restaurante) {
            document.getElementById('user-restaurant').textContent = user.restaurante;
        }

        await cargarDatos();

        // Usar optional chaining para evitar errores si main.js aún no ha cargado
        if (typeof window.renderizarIngredientes === 'function') window.renderizarIngredientes();
        if (typeof window.renderizarRecetas === 'function') window.renderizarRecetas();
        if (typeof window.renderizarProveedores === 'function') window.renderizarProveedores();
        if (typeof window.renderizarPedidos === 'function') window.renderizarPedidos();
        if (typeof window.renderizarInventario === 'function') window.renderizarInventario();
        if (typeof window.renderizarVentas === 'function') window.renderizarVentas();
        // renderizarBalance(); // DESACTIVADO - Sección P&L eliminada
        if (typeof window.actualizarKPIs === 'function') window.actualizarKPIs();
        window.actualizarDashboardExpandido();


        document.getElementById('form-venta').addEventListener('submit', async e => {
            e.preventDefault();

            // ⚡ ANTI-DOBLE-CLICK: Evitar envío duplicado
            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn.disabled) return; // Ya se está procesando
            submitBtn.disabled = true;
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Procesando...';

            const recetaId = document.getElementById('venta-receta').value;
            const cantidad = parseInt(document.getElementById('venta-cantidad').value);

            // ⚡ NUEVO: Capturar variante seleccionada (copa/botella)
            const varianteSelect = document.getElementById('venta-variante');
            const varianteId = varianteSelect?.value ? parseInt(varianteSelect.value) : null;
            const varianteData = varianteSelect?.selectedOptions?.[0];
            const precioVariante = varianteData?.dataset?.precio ? parseFloat(varianteData.dataset.precio) : null;

            // Validaciones
            if (!recetaId) {
                showToast('Selecciona un plato', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                return;
            }
            if (!cantidad || cantidad <= 0) {
                showToast('La cantidad debe ser mayor que 0', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                return;
            }

            try {
                // ⚡ CORREGIDO: Pasar variante y precio a createSale
                await api.createSale({
                    recetaId,
                    cantidad,
                    varianteId,
                    precioVariante
                });
                await cargarDatos();
                renderizarVentas();
                renderizarInventario();
                renderizarIngredientes();
                window.actualizarKPIs();
                e.target.reset();
                showToast('Venta registrada correctamente', 'success');
            } catch (error) {
                alert('Error: ' + error.message);
            } finally {
                // Re-habilitar botón después de procesar
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });

        // Configurar fecha de hoy por defecto
        const hoy = new Date().toISOString().split('T')[0];
        if (document.getElementById('ped-fecha')) {
            document.getElementById('ped-fecha').value = hoy;
        }

        // ✅ PRODUCTION FIX #2: Recuperar draft de inventario al cargar
        setTimeout(() => {
            const draft = localStorage.getItem('inventory_draft');
            if (draft) {
                try {
                    const changes = JSON.parse(draft);
                    if (changes && changes.length > 0) {
                        if (
                            confirm(
                                `Tienes ${changes.length} cambios de inventario sin guardar. ¿Continuar donde lo dejaste?`
                            )
                        ) {
                            // Rellenar inputs con valores del draft
                            changes.forEach(c => {
                                const input = document.querySelector(
                                    `.input-stock-real[data-id="${c.id}"]`
                                );
                                if (input) input.value = c.stock_real;
                            });
                            showToast(
                                `Recuperados ${changes.length} cambios de inventario`,
                                'info'
                            );
                        } else {
                            localStorage.removeItem('inventory_draft');
                        }
                    }
                } catch (e) {
                    console.error('Error recuperando draft:', e);
                    localStorage.removeItem('inventory_draft');
                }
            }
        }, 2000); // Esperar 2s para que la tabla se renderice
    }
    // API helper para balance
    // ⚡ Multi-tenant: usa config global si existe
    const API_BASE = (window.API_CONFIG?.baseUrl || 'https://lacaleta-api.mindloop.cloud') + '/api';

    function getAuthHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            Authorization: token ? 'Bearer ' + token : '',
        };
    }

    // 🔧 FIX: Wrapper para incluir credentials en todos los fetch
    async function fetchWithCreds(url, options = {}) {
        return fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
                ...getAuthHeaders(),
                ...(options.headers || {})
            }
        });
    }

    window.api = {
        // --- Team Management ---
        getTeam: async () => {
            const res = await fetchWithCreds(API_BASE + '/team', { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Error cargando equipo');
            return await res.json();
        },
        inviteUser: async (nombre, email, password, rol) => {
            const res = await fetchWithCreds(API_BASE + '/team/invite', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ nombre, email, password, rol }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error invitando usuario');
            return data;
        },
        deleteUser: async id => {
            const res = await fetchWithCreds(API_BASE + `/team/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error eliminando usuario');
            return data;
        },
        async getIngredientes() {
            const res = await fetchWithCreds(API_BASE + '/ingredients', {
                headers: getAuthHeaders(),
            });
            return await res.json();
        },

        async createIngrediente(ingrediente) {
            const res = await fetchWithCreds(API_BASE + '/ingredients', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(ingrediente),
            });
            if (!res.ok) throw new Error('Error creando ingrediente');
            return await res.json();
        },

        async updateIngrediente(id, ingrediente) {
            const res = await fetchWithCreds(API_BASE + `/ingredients/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(ingrediente),
            });
            if (!res.ok) throw new Error('Error actualizando ingrediente');
            return await res.json();
        },

        async deleteIngrediente(id) {
            const res = await fetchWithCreds(API_BASE + `/ingredients/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Error eliminando ingrediente');
            return await res.json();
        },

        async getRecetas() {
            const res = await fetchWithCreds(API_BASE + '/recipes', {
                headers: getAuthHeaders(),
            });
            return await res.json();
        },

        async createReceta(receta) {
            const res = await fetchWithCreds(API_BASE + '/recipes', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(receta),
            });
            if (!res.ok) throw new Error('Error creando receta');
            return await res.json();
        },

        async updateReceta(id, receta) {
            const res = await fetchWithCreds(API_BASE + `/recipes/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(receta),
            });
            if (!res.ok) throw new Error('Error actualizando receta');
            return await res.json();
        },

        async deleteReceta(id) {
            const res = await fetchWithCreds(API_BASE + `/recipes/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Error eliminando receta');
            return await res.json();
        },

        async getProveedores() {
            const res = await fetchWithCreds(API_BASE + '/suppliers', {
                headers: getAuthHeaders(),
            });
            return await res.json();
        },

        async createProveedor(proveedor) {
            const res = await fetchWithCreds(API_BASE + '/suppliers', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(proveedor),
            });
            if (!res.ok) throw new Error('Error creando proveedor');
            return await res.json();
        },

        async updateProveedor(id, proveedor) {
            const res = await fetchWithCreds(API_BASE + `/suppliers/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(proveedor),
            });
            if (!res.ok) throw new Error('Error actualizando proveedor');
            return await res.json();
        },

        async deleteProveedor(id) {
            const res = await fetchWithCreds(API_BASE + `/suppliers/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Error eliminando proveedor');
            return await res.json();
        },

        async getPedidos() {
            const res = await fetchWithCreds(API_BASE + '/orders', {
                headers: getAuthHeaders(),
            });
            return await res.json();
        },

        async createPedido(pedido) {
            const res = await fetchWithCreds(API_BASE + '/orders', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(pedido),
            });
            if (!res.ok) throw new Error('Error creando pedido');
            return await res.json();
        },

        async updatePedido(id, pedido) {
            const res = await fetchWithCreds(API_BASE + `/orders/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(pedido),
            });
            if (!res.ok) throw new Error('Error actualizando pedido');
            return await res.json();
        },

        async deletePedido(id) {
            const res = await fetchWithCreds(API_BASE + `/orders/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Error eliminando pedido');
            return await res.json();
        },

        async getSales(fecha = null) {
            const url = fecha ? API_BASE + `/sales?fecha=${fecha}` : API_BASE + '/sales';
            const res = await fetch(url, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Error al cargar ventas');
            return await res.json();
        },

        async createSale(saleData) {
            const res = await fetchWithCreds(API_BASE + '/sales', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(saleData),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Error al registrar venta');
            }
            return await res.json();
        },

        async deleteSale(id) {
            const res = await fetchWithCreds(API_BASE + `/sales/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Error al eliminar venta');
            return await res.json();
        },

        // INVENTARIO AVANZADO
        async getInventoryComplete() {
            const res = await fetchWithCreds(API_BASE + '/inventory/complete', {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Error cargando inventario');
            return await res.json();
        },

        async updateStockReal(id, stock_real) {
            const res = await fetchWithCreds(API_BASE + `/inventory/${id}/stock-real`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ stock_real }),
            });
            if (!res.ok) throw new Error('Error actualizando stock real');
            return await res.json();
        },

        async bulkUpdateStockReal(stocks) {
            const res = await fetchWithCreds(API_BASE + '/inventory/bulk-update-stock', {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ stocks }),
            });
            if (!res.ok) throw new Error('Error en actualización masiva');
            return await res.json();
        },

        async consolidateStock(adjustments, snapshots = [], finalStock = []) {
            const res = await fetchWithCreds(API_BASE + '/inventory/consolidate', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ adjustments, snapshots, finalStock }),
            });
            if (!res.ok) throw new Error('Error en consolidación de stock');
            return await res.json();
        },

        async getMenuEngineering() {
            const res = await fetchWithCreds(API_BASE + '/analysis/menu-engineering', {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Error al obtener ingeniería de menú');
            return await res.json();
        },

        // GASTOS FIJOS (Fixed Expenses) - Database backed
        async getGastosFijos() {
            try {
                const res = await fetchWithCreds(API_BASE + '/gastos-fijos', {
                    headers: getAuthHeaders(),
                });
                if (!res.ok) throw new Error('Error cargando gastos fijos');
                return await res.json();
            } catch (error) {
                console.warn('Error loading gastos fijos from API:', error);
                return [];
            }
        },

        async createGastoFijo(concepto, monto_mensual) {
            const res = await fetchWithCreds(API_BASE + '/gastos-fijos', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ concepto, monto_mensual: parseFloat(monto_mensual) }),
            });
            if (!res.ok) throw new Error('Error creando gasto fijo');
            return await res.json();
        },

        async updateGastoFijo(id, concepto, monto_mensual) {
            const res = await fetchWithCreds(API_BASE + `/gastos-fijos/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ concepto, monto_mensual: parseFloat(monto_mensual) }),
            });
            if (!res.ok) throw new Error('Error actualizando gasto fijo');
            return await res.json();
        },

        async deleteGastoFijo(id) {
            const res = await fetchWithCreds(API_BASE + `/gastos-fijos/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error('Error eliminando gasto fijo');
            return await res.json();
        },

        // MERMAS - Historial completo
        async getMermas(mes, ano) {
            try {
                const mesParam = mes || (new Date().getMonth() + 1);
                const anoParam = ano || new Date().getFullYear();
                const url = API_BASE + `/mermas?mes=${mesParam}&ano=${anoParam}`;
                console.log('📡 GET getMermas URL:', url);

                const res = await fetch(url, {
                    headers: getAuthHeaders(),
                });

                console.log('📡 GET getMermas response status:', res.status);

                if (!res.ok) {
                    const errorText = await res.text();
                    console.error('❌ Error getMermas:', res.status, errorText);
                    throw new Error('Error cargando mermas: ' + res.status);
                }

                const data = await res.json();
                console.log('✅ getMermas data:', data);
                return data;
            } catch (error) {
                console.error('❌ getMermas exception:', error);
                return [];
            }
        },

        // MERMAS (Pérdidas de producto) - Para KPI
        async getMermasResumen() {
            try {
                const res = await fetchWithCreds(API_BASE + '/mermas/resumen', {
                    headers: getAuthHeaders(),
                });
                if (!res.ok) throw new Error('Error cargando resumen de mermas');
                return await res.json();
            } catch (error) {
                console.warn('Error loading mermas resumen:', error);
                return { totalPerdida: 0, totalProductos: 0, totalRegistros: 0 };
            }
        },

        async resetMermas(motivo = 'subida_inventario') {
            const res = await fetchWithCreds(API_BASE + '/mermas/reset', {
                method: 'DELETE',
                headers: getAuthHeaders(),
                body: JSON.stringify({ motivo }),
            });
            if (!res.ok) throw new Error('Error reseteando mermas');
            return await res.json();
        },
    };

    // Crear alias en mayúsculas para compatibilidad
    window.API = window.api;

    // 🔧 FIX: Lock para prevenir llamadas concurrentes a cargarDatos()
    let _legacyCargarDatosLock = false;
    let _legacyCargarDatosPromise = null;

    async function cargarDatos() {
        // 🔧 FIX: Si ya hay una carga en progreso, esperar a que termine
        if (_legacyCargarDatosLock && _legacyCargarDatosPromise) {
            console.log('⏳ [legacy] cargarDatos() ya en progreso, esperando...');
            return _legacyCargarDatosPromise;
        }

        _legacyCargarDatosLock = true;
        _legacyCargarDatosPromise = _cargarDatosInternal();

        try {
            await _legacyCargarDatosPromise;
        } finally {
            _legacyCargarDatosLock = false;
            _legacyCargarDatosPromise = null;
        }
    }

    async function _cargarDatosInternal() {
        try {
            // ⚡ OPTIMIZACIÓN: Carga paralela con Promise.all() - 75% más rápido
            const [ingredientes, recetas, proveedores, pedidos] = await Promise.all([
                api.getIngredientes(),
                api.getRecetas(),
                api.getProveedores(),
                api.getPedidos(),
            ]);

            window.ingredientes = ingredientes.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
            window.recetas = recetas.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
            window.proveedores = proveedores.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
            window.pedidos = pedidos;

            // ⚡ Actualizar mapas de búsqueda optimizados
            if (window.dataMaps) {
                window.dataMaps.update();
            }
        } catch (error) {
            console.error('Error cargando datos:', error);
            showToast('Error conectando con la API', 'error');
        }
    }

    // Exponer cargarDatos globalmente para los módulos CRUD
    window.cargarDatos = cargarDatos;

    // ═══════════════════════════════════════════════════════════════
    // 🗓️ FUNCIONES DE CALENDARIO Y PERÍODO
    // ═══════════════════════════════════════════════════════════════

    let periodoVistaActual = 'semana';

    // Inicializa el banner de fecha actual
    function inicializarFechaActual() {
        const fechaTexto = document.getElementById('fecha-hoy-texto');
        const periodoInfo = document.getElementById('periodo-info');

        if (fechaTexto && typeof window.getFechaHoyFormateada === 'function') {
            const fechaFormateada = window.getFechaHoyFormateada();
            // Capitalizar primera letra
            fechaTexto.textContent =
                fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
        }

        if (periodoInfo && typeof window.getPeriodoActual === 'function') {
            const periodo = window.getPeriodoActual();
            periodoInfo.textContent = `Semana ${periodo.semana} · ${periodo.mesNombre.charAt(0).toUpperCase() + periodo.mesNombre.slice(1)} ${periodo.año}`;
        }
    }

    // Cambia el período de vista y actualiza KPIs
    window.cambiarPeriodoVista = function (periodo) {
        periodoVistaActual = periodo;

        // Actualizar botones activos
        document.querySelectorAll('.periodo-btn').forEach(btn => {
            if (btn.dataset.periodo === periodo) {
                btn.style.background = '#0ea5e9';
                btn.style.color = 'white';
            } else {
                btn.style.background = 'white';
                btn.style.color = '#0369a1';
            }
        });

        // Actualizar KPIs según período
        actualizarKPIsPorPeriodo(periodo);
    };

    // Actualiza KPIs filtrados por período
    function actualizarKPIsPorPeriodo(periodo) {
        try {
            const ventas = window.ventas || [];

            if (typeof window.filtrarPorPeriodo === 'function') {
                const ventasFiltradas = window.filtrarPorPeriodo(ventas, 'fecha', periodo);
                const totalVentas = ventasFiltradas.reduce(
                    (acc, v) => acc + (parseFloat(v.total) || 0),
                    0
                );

                const kpiIngresos = document.getElementById('kpi-ingresos');
                if (kpiIngresos) {
                    kpiIngresos.textContent = totalVentas.toFixed(2) + '€';
                }

                // Actualizar comparativa con período anterior
                if (
                    typeof window.compararConSemanaAnterior === 'function' &&
                    periodo === 'semana'
                ) {
                    const comparativa = window.compararConSemanaAnterior(ventas, 'fecha', 'total');
                    const trendEl = document.getElementById('kpi-ingresos-trend');
                    if (trendEl) {
                        const signo = comparativa.tendencia === 'up' ? '+' : '';
                        trendEl.textContent = `${signo}${comparativa.porcentaje}% vs anterior`;
                        trendEl.parentElement.className = `kpi-trend ${comparativa.tendencia === 'up' ? 'positive' : 'negative'}`;
                    }
                }
            }
        } catch (error) {
            console.error('Error actualizando KPIs por período:', error);
        }
    }

    // Exponer funciones globalmente
    window.inicializarFechaActual = inicializarFechaActual;
    window.actualizarKPIsPorPeriodo = actualizarKPIsPorPeriodo;


    // ========== INVENTARIO ==========
    // Cache para persistir valores de stock introducidos por el usuario
    window.stockRealCache = window.stockRealCache || {};

    window.renderizarInventario = async function () {
        try {
            const inventario = await api.getInventoryComplete();
            const busqueda = document.getElementById('busqueda-inventario').value.toLowerCase();
            const filtrados = inventario.filter(ing => ing.nombre.toLowerCase().includes(busqueda));

            const container = document.getElementById('tabla-inventario');

            // Calcular alertas
            let stockBajo = 0;
            let stockCritico = 0;

            window.ingredientes.forEach(ing => {
                const stockActual = parseFloat(ing.stock_actual) || 0;
                const stockMinimo = parseFloat(ing.stock_minimo) || 0;
                // Solo contar si tiene mínimo configurado
                if (stockActual <= 0) {
                    stockCritico++;
                } else if (stockMinimo > 0 && stockActual <= stockMinimo) {
                    stockBajo++;
                }
            });

            // Actualizar badge
            const totalAlertas = stockBajo + stockCritico;
            const badge = document.getElementById('badge-inventario');
            if (totalAlertas > 0) {
                badge.textContent = totalAlertas;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }

            // Actualizar resumen
            const resumen = document.getElementById('resumen-inventario');
            if (stockBajo > 0 || stockCritico > 0) {
                resumen.innerHTML = `
            <div style="color: #f59e0b;">⚠️ Stock bajo: <strong>${stockBajo}</strong></div>
            <div style="color: #ef4444;">🔴 Stock crítico: <strong>${stockCritico}</strong></div>
          `;
                resumen.style.display = 'flex';
            } else {
                resumen.style.display = 'none';
            }

            if (filtrados.length === 0) {
                container.innerHTML = `
            <div class="empty-state">
              <div class="icon">📦</div>
              <h3>No hay ingredientes</h3>
              <p>Añade ingredientes para gestionar el inventario</p>
            </div>
          `;
                return;
            }

            let html = '<table><thead><tr>';
            html +=
                '<th>Estado</th><th>Ingrediente</th><th>Stock Virtual</th><th>Stock Real</th><th>Diferencia</th><th>Precio Medio</th><th>Valor Stock</th><th>Unidad</th>';
            html += '</tr></thead><tbody>';

            filtrados.forEach(ing => {
                let estadoClass = 'stock-ok';
                let estadoIcon = '🟢';

                const stockActual = parseFloat(ing.stock_virtual) || 0;
                const stockMinimo = parseFloat(ing.stock_minimo) || 0;

                if (stockActual <= 0) {
                    estadoClass = 'stock-critico';
                    estadoIcon = '🔴';
                } else if (stockMinimo > 0 && stockActual <= stockMinimo) {
                    estadoClass = 'stock-bajo';
                    estadoIcon = '🟡';
                }

                const precioMedio = parseFloat(ing.precio_medio || 0);
                const valorStock = parseFloat(ing.valor_stock || 0);
                const diferencia = parseFloat(ing.diferencia || 0);
                // Usar cache si existe, sino usar el valor de la BD
                const cachedValue = window.stockRealCache[ing.id];
                const stockReal = cachedValue !== undefined
                    ? cachedValue
                    : (ing.stock_real !== null ? parseFloat(ing.stock_real).toFixed(2) : '');

                html += '<tr>';
                html += `<td><span class="stock-indicator ${estadoClass}"></span>${estadoIcon}</td>`;
                html += `<td><strong>${escapeHTML(ing.nombre)}</strong></td>`;
                html += `<td><span class="stock-value">${parseFloat(ing.stock_virtual || 0).toFixed(2)} <small style="color:#64748b;">${ing.unidad || ''}</small></span></td>`;

                // Input con evento ONINPUT para cálculo dinámico y guardar en cache
                // Mostrar siempre el botón de conversión 📦
                const tieneFormato = ing.formato_compra && ing.cantidad_por_formato;
                const btnColor = tieneFormato ? '#f59e0b' : '#94a3b8';
                const btnTitle = tieneFormato
                    ? `Calcular desde ${ing.formato_compra}s`
                    : 'Configura formato de compra para usar conversión';
                const formatoData = tieneFormato
                    ? `'${escapeHTML(ing.formato_compra)}', ${ing.cantidad_por_formato}`
                    : `null, null`;

                const formatoHelper = `<div style="display:flex;align-items:center;gap:4px;">
                     <input type="number" step="0.01" value="${stockReal}" placeholder="Sin datos" 
                        class="input-stock-real" 
                        data-id="${ing.id}" 
                        data-stock-virtual="${ing.stock_virtual || 0}" 
                        data-precio="${precioMedio}"
                        data-cantidad-formato="${ing.cantidad_por_formato || 1}"
                        id="stock-real-${ing.id}"
                        oninput="window.updateDifferenceCell(this); window.stockRealCache[${ing.id}] = this.value;"
                        style="width:70px;padding:5px;border:1px solid #ddd;border-radius:4px;">
                     <button type="button" onclick="window.mostrarCalculadoraFormato(${ing.id}, ${formatoData}, '${ing.unidad}', '${escapeHTML(ing.nombre)}')" 
                        style="padding:4px 8px;background:${btnColor};color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;" 
                        title="${btnTitle}">📦</button>
                   </div>`;

                html += `<td>${formatoHelper}</td>`;

                // Celda de Diferencia con ID único para actualizar
                let diffDisplay = '-';
                let diffColor = '#666';

                // Si viene calculado de backend (porque había stock_real guardado)
                if (ing.diferencia !== null && ing.diferencia !== undefined) {
                    const d = parseFloat(ing.diferencia);
                    diffDisplay = d.toFixed(2);
                    if (d < 0) {
                        diffColor = '#ef4444';
                    } // Negativo (Falta) -> Rojo
                    else if (d > 0) diffColor = '#10b981'; // Positivo (Sobra) -> Verde
                }

                html += `<td id="diff-cell-${ing.id}" style="color:${diffColor}; font-weight:bold;">${diffDisplay}</td>`;

                html += `<td>${precioMedio.toFixed(2)}€/${ing.unidad}</td>`;

                // Valor Stock: Por defecto usa Virtual. Si hay Real guardado, usa Real.
                const cantidadParaValor =
                    stockReal !== '' && stockReal !== null
                        ? parseFloat(stockReal)
                        : parseFloat(ing.stock_virtual || 0);
                const valorStockDisplay = (cantidadParaValor * precioMedio).toFixed(2);

                html += `<td id="val-cell-${ing.id}"><strong>${valorStockDisplay}€</strong></td>`;
                html += `<td>${ing.unidad}</td>`;
                html += '</tr>';
            });

            container.innerHTML = html;
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('tabla-inventario').innerHTML =
                '<p style="color:#ef4444;">Error cargando inventario</p>';
        }
    };

    window.updateDifferenceCell = function (input) {
        const id = input.dataset.id;
        const virtual = parseFloat(input.dataset.stockVirtual) || 0;
        const val = input.value;
        const cellDiff = document.getElementById(`diff-cell-${id}`);
        const cellVal = document.getElementById(`val-cell-${id}`);

        // Precio Medio (lo extraemos de la celda vecina o mejor, lo pasamos por data attribute.
        // Hack rápido: obtenemos valor de la celda de precio (indice 5, pero variable)
        // Mejor: Agregamos data-precio al input
        const precio = parseFloat(input.dataset.precio || 0);

        if (val === '' || val === null) {
            cellDiff.textContent = '-';
            cellDiff.style.color = '#666';
            // Si borra, volvemos a mostrar valor VIRTUAL
            cellVal.innerHTML = `<strong>${(virtual * precio).toFixed(2)}€</strong>`;
            return;
        }

        const real = parseFloat(val);
        const diff = real - virtual;

        cellDiff.textContent = diff.toFixed(2);
        if (diff < 0) cellDiff.style.color = '#ef4444';
        else if (diff > 0) cellDiff.style.color = '#10b981';
        else cellDiff.style.color = '#666';

        // Actualizar Valor Stock (REAL * Precio)
        cellVal.innerHTML = `<strong>${(real * precio).toFixed(2)}€</strong>`;
    };

    // Función para mostrar calculadora de conversión de formato
    window.mostrarCalculadoraFormato = function (ingredienteId, formato, cantidadPorFormato, unidad, nombreIngrediente) {
        // Si no tiene formato configurado, permitir introducción manual
        if (!formato || !cantidadPorFormato) {
            const respuesta = prompt(`${nombreIngrediente || 'Este ingrediente'} no tiene formato de compra configurado.\n\nIntroduce manualmente:\n1. Nombre del formato (ej: bote, caja, garrafa)\n2. Cantidad por formato en ${unidad}\n\nEjemplo: "bote,0.5" significa 1 bote = 0.5 ${unidad}\n\nEscribe formato,cantidad:`);

            if (!respuesta) return;

            const partes = respuesta.split(',');
            if (partes.length !== 2) {
                showToast('Formato inválido. Usa: nombre,cantidad (ej: bote,0.5)', 'error');
                return;
            }

            formato = partes[0].trim();
            cantidadPorFormato = parseFloat(partes[1].trim());

            if (isNaN(cantidadPorFormato) || cantidadPorFormato <= 0) {
                showToast('Cantidad por formato inválida', 'error');
                return;
            }
        }

        const cantidad = prompt(`¿Cuántos ${formato}s tienes?\n\n(Cada ${formato} = ${cantidadPorFormato} ${unidad})`);

        if (cantidad === null || cantidad === '') return;

        const numCantidad = parseFloat(cantidad);
        if (isNaN(numCantidad) || numCantidad < 0) {
            showToast('Cantidad inválida', 'error');
            return;
        }

        // Calcular el stock en unidad base
        const stockCalculado = (numCantidad * cantidadPorFormato).toFixed(2);

        // Actualizar el input
        const input = document.getElementById(`stock-real-${ingredienteId}`) ||
            document.querySelector(`.input-stock-real[data-id="${ingredienteId}"]`);
        if (input) {
            input.value = stockCalculado;
            window.updateDifferenceCell(input);
            window.stockRealCache[ingredienteId] = stockCalculado;
            showToast(`${numCantidad} ${formato}s = ${stockCalculado} ${unidad}`, 'success');
        }
    };

    // Función global para actualizar stock real
    // Función para guardar stock masivo
    // Función para guardar stock masivo con lógica de mermas
    window.guardarCambiosStock = async function () {
        const inputs = document.querySelectorAll('.input-stock-real');
        const adjustments = [];
        const mermas = [];

        inputs.forEach(input => {
            const val = input.value;
            if (val !== '' && val !== null) {
                const nuevoReal = parseFloat(val);
                const dataId = parseInt(input.dataset.id);
                const stockVirtual = parseFloat(input.dataset.stockVirtual || 0);

                // Solo nos importa si hay cambios (aunque la lógica pide ajustar si es positivo,
                // asumimos que si el usuario escribe algo es porque quiere fijarlo)
                // Pero podemos optimizar enviando solo lo que difiere o todo lo escrito.
                // El usuario dijo "Update Stock" button allow users to edit multiple...
                // Enviamos todo lo que tenga valor explícito en el input.

                const item = {
                    id: dataId,
                    stock_real: nuevoReal,
                };
                adjustments.push(item);

                // Detectar mermas (Real < Ficticio)
                // Nota: Javascript floats pueden ser tricky, usamos una pequeña tolerancia o simple comparación
                if (nuevoReal < stockVirtual) {
                    const nombreIng =
                        window.ingredientes.find(i => i.id === dataId)?.nombre ||
                        'Ingrediente ' + dataId;
                    mermas.push({
                        id: dataId,
                        nombre: nombreIng,
                        diferencia: (stockVirtual - nuevoReal).toFixed(2),
                    });
                }
            }
        });

        if (adjustments.length === 0) {
            showToast('No hay datos para guardar', 'info');
            return;
        }

        // Lógica de confirmación
        if (mermas.length > 0) {
            // Abrir modal de gestión de mermas
            window.mostrarModalConfirmarMermas(adjustments, mermas);
            return;
        }

        let mensajeConfirmacion = `¿Actualizar stock de ${adjustments.length} ingredientes?`;
        mensajeConfirmacion += `\n\nEl stock ficticio se ajustará automáticamente al stock real ingresado.`;

        if (!confirm(mensajeConfirmacion)) return;

        try {
            showLoading();
            // Usamos el endpoint de consolidación que actualiza AMBOS (read y actual)
            await api.consolidateStock(adjustments);
            // Limpiar cache después de guardar exitosamente
            window.stockRealCache = {};
            await window.renderizarInventario();
            hideLoading();
            showToast('Inventario consolidado correctamente', 'success');
        } catch (error) {
            hideLoading();
            showToast('Error: ' + error.message, 'error');
        }
    };

    // Variables para el modal de mermas (Snapshot y Ajustes)
    let currentSnapshots = [];
    let currentAdjustmentsMap = {}; // Map ingId -> Array of reasons

    window.mostrarModalConfirmarMermas = function (snapshotsData) {
        currentSnapshots = snapshotsData;
        currentAdjustmentsMap = {};

        // Inicializar ajustes vacíos
        currentSnapshots.forEach(snap => {
            const diff = snap.stock_real - snap.stock_virtual;
            // Si falta stock (diff negativa), proponemos una fila inicial por defecto
            if (diff < 0) {
                currentAdjustmentsMap[snap.id] = [
                    {
                        id: Date.now() + Math.random(),
                        cantidad: Math.abs(diff), // Sugerimos todo como una causa inicial
                        motivo: 'Caduco',
                        notas: '',
                    },
                ];
            } else {
                // Si sobra stock (diff positiva), también se debe justificar
                currentAdjustmentsMap[snap.id] = [
                    {
                        id: Date.now() + Math.random(),
                        cantidad: diff,
                        motivo: 'Error de Inventario', // Default positivo
                        notas: '',
                    },
                ];
            }
        });

        window.renderTablaSplits();
        document.getElementById('modal-confirmar-mermas').classList.add('active');
    };

    window.renderTablaSplits = function () {
        const tbody = document.getElementById('tabla-mermas-body');
        tbody.innerHTML = '';

        let totalValid = true;

        currentSnapshots.forEach(snap => {
            const ing = ingredientes.find(i => i.id === snap.id);
            const nombre = ing ? ing.nombre : 'Unknown';
            const diffTotal = snap.stock_real - snap.stock_virtual;
            const isNegative = diffTotal < 0;
            const sign = isNegative ? '-' : '+';
            const color = isNegative ? '#ef4444' : '#10b981';

            // Calcular cuánto llevamos asignado
            const asignado = currentAdjustmentsMap[snap.id].reduce(
                (sum, adj) => sum + parseFloat(adj.cantidad || 0),
                0
            );
            // La suma de ajustes (siempre positivos en input) debe igualar el valor absoluto de la diferencia
            const target = Math.abs(diffTotal);
            const restante = target - asignado;
            const isMatch = Math.abs(restante) < 0.01;

            if (!isMatch) totalValid = false;

            // Fila Cabecera Ingrediente
            const trHeader = document.createElement('tr');
            trHeader.style.background = '#f1f5f9';
            trHeader.innerHTML = `
                    <td colspan="4" style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <strong>${nombre}</strong>
                            <span>Diff: <strong style="color:${color}">${sign}${Math.abs(diffTotal).toFixed(2)} ${ing.unidad}</strong></span>
                        </div>
                         <div style="font-size:12px; color: ${isMatch ? '#059669' : '#dc2626'}; margin-top:4px;">
                            ${isMatch ? '✓ Cuadrado' : `⚠️ Faltan por asignar: ${restante.toFixed(2)} ${ing.unidad}`}
                        </div>
                    </td>
                `;
            tbody.appendChild(trHeader);

            // Filas de Ajustes (Splits)
            currentAdjustmentsMap[snap.id].forEach((adj, idx) => {
                const trAdj = document.createElement('tr');
                trAdj.innerHTML = `
                        <td style="padding-left: 20px;">
                            <span style="color:#aaa; font-size:12px;">↳ Ajuste ${idx + 1}</span>
                        </td>
                         <td style="padding: 5px;">
                            <input type="number" step="0.01" value="${adj.cantidad || 0}" 
                                onchange="window.updateSplitAmount(${snap.id}, ${adj.id}, this.value)"
                                style="width: 80px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;"> 
                            <span style="font-size:11px">${ing.unidad}</span>
                        </td>
                        <td style="padding: 5px;">
                            <select onchange="window.updateSplitReason(${snap.id}, ${adj.id}, this.value)"
                                style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                                <option value="Caduco" ${adj.motivo === 'Caduco' ? 'selected' : ''}>Caduco</option>
                                <option value="Invitacion" ${adj.motivo === 'Invitacion' ? 'selected' : ''}>Invitación</option>
                                <option value="Accidente" ${adj.motivo === 'Accidente' ? 'selected' : ''}>Accidente</option>
                                <option value="Error Cocina" ${adj.motivo === 'Error Cocina' ? 'selected' : ''}>Error Cocina</option>
                                <option value="Error Inventario" ${adj.motivo === 'Error Inventario' ? 'selected' : ''}>Error Conteo</option>
                                <option value="Otros" ${adj.motivo === 'Otros' ? 'selected' : ''}>Otros</option>
                            </select>
                        </td>
                        <td style="padding: 5px; display: flex; gap: 5px;">
                            <input type="text" value="${adj.notas}" placeholder="Nota..."
                                onchange="window.updateSplitNote(${snap.id}, ${adj.id}, this.value)"
                                style="flex:1; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                            <button onclick="window.removeSplit(${snap.id}, ${adj.id})" style="background:none; border:none; cursor:pointer;">❌</button>
                        </td>
                    `;
                tbody.appendChild(trAdj);
            });

            // Botón añadir split
            const trAdd = document.createElement('tr');
            trAdd.innerHTML = `
                    <td colspan="4" style="text-align:right; padding:5px; border-bottom: 2px solid #e2e8f0;">
                        <button onclick="window.addSplit(${snap.id})" style="font-size:12px; color:#3b82f6; background:none; border:none; cursor:pointer; font-weight:600;">+ Dividir diferencia</button>
                    </td>
                 `;
            tbody.appendChild(trAdd);
        });

        const btn = document.getElementById('btn-confirmar-split');
        const alertBox = document.getElementById('mermas-alert-box');

        if (totalValid) {
            btn.disabled = false;
            btn.style.opacity = 1;
            alertBox.style.display = 'none';
        } else {
            btn.disabled = true;
            btn.style.opacity = 0.5;
            alertBox.textContent =
                '⚠️ Debes asignar la cantidad exacta total para todos los ingredientes antes de confirmar.';
            alertBox.style.display = 'block';
        }
    };

    window.updateSplitAmount = (ingId, adjId, val) => {
        const adj = currentAdjustmentsMap[ingId].find(a => a.id === adjId);
        // Si val es vacío o inválido, usamos 0
        if (adj) adj.cantidad = parseFloat(val) || 0;
        window.renderTablaSplits();
    };

    window.updateSplitReason = (ingId, adjId, val) => {
        const adj = currentAdjustmentsMap[ingId].find(a => a.id === adjId);
        if (adj) adj.motivo = val;
    };

    window.updateSplitNote = (ingId, adjId, val) => {
        const adj = currentAdjustmentsMap[ingId].find(a => a.id === adjId);
        if (adj) adj.notas = val;
    };

    window.addSplit = ingId => {
        currentAdjustmentsMap[ingId].push({
            id: Date.now(),
            cantidad: 0,
            motivo: 'Caduco',
            notas: '',
        });
        window.renderTablaSplits();
    };

    window.removeSplit = (ingId, adjId) => {
        currentAdjustmentsMap[ingId] = currentAdjustmentsMap[ingId].filter(a => a.id !== adjId);
        window.renderTablaSplits();
    };

    window.confirmarMermasFinal = async function () {
        // Flatten de todos los ajustes para enviar
        const finalAdjustments = [];

        Object.keys(currentAdjustmentsMap).forEach(ingIdStr => {
            const ingId = parseInt(ingIdStr);
            currentAdjustmentsMap[ingId].forEach(adj => {
                // Importante: Si la diferencia original era NEGATIVA, los ajustes son SALIDAS (negativos).
                // Si era POSITIVA, son ENTRADAS (positivos).
                // La UI muestra valores absolutos para simplificar, aquí aplicamos el signo.
                const snap = currentSnapshots.find(s => s.id === ingId);
                const isNegative = snap.stock_real - snap.stock_virtual < 0;

                finalAdjustments.push({
                    ingrediente_id: ingId,
                    cantidad: isNegative ? -Math.abs(adj.cantidad) : Math.abs(adj.cantidad),
                    motivo: adj.motivo,
                    notas: adj.notas,
                });
            });
        });

        // Preparar payload para consolidate (Snapshots + Splits)
        // FinalStock is just the target state for updating the master table
        const finalStock = currentSnapshots.map(s => ({
            id: s.id,
            stock_real: s.stock_real,
        }));

        try {
            document.getElementById('modal-confirmar-mermas').classList.remove('active');
            showLoading();

            await api.consolidateStock(finalAdjustments, currentSnapshots, finalStock);

            // Limpiar cache después de guardar exitosamente
            window.stockRealCache = {};
            await window.renderizarInventario();
            hideLoading();
            showToast('Ajustes de inventario registrados correctamente', 'success');
        } catch (error) {
            hideLoading();
            showToast('Error: ' + error.message, 'error');
        }
    };

    // MODIFICACION EN CLAVE: guardarCambiosStock (Nueva Lógica)
    window.guardarCambiosStock = async function () {
        const inputs = document.querySelectorAll('.input-stock-real');
        const changes = [];

        inputs.forEach(input => {
            const id = parseInt(input.dataset.id);
            // Validación anti-NaN: Si dataset.stockVirtual falla, asumimos 0
            const virtual = parseFloat(input.dataset.stockVirtual) || 0;
            const real = parseFloat(input.value);

            // Solo procesamos si hay cambio real
            if (!isNaN(real) && Math.abs(real - virtual) > 0.001) {
                changes.push({
                    id: id,
                    stock_virtual: virtual,
                    stock_real: real,
                });
            }
        });

        if (changes.length === 0) {
            showToast('No hay cambios en el stock para registrar', 'info');
            return;
        }

        // ABRIMOS DIRECTAMENTE EL CHECKER (Modal Split)
        window.mostrarModalConfirmarMermas(changes);
    };

    // Event listener para búsqueda de inventario
    document
        .getElementById('busqueda-inventario')
        .addEventListener('input', window.renderizarInventario);

    // Dashboard expandido - actualizar datos
    window.actualizarDashboardExpandido = async function () {
        try {
            // Verificar que los elementos existan antes de continuar
            const ventasHoyEl = document.getElementById('ventas-hoy');
            const ingresosHoyEl = document.getElementById('ingresos-hoy');
            const platoEstrellaEl = document.getElementById('plato-estrella-hoy');
            const alertasListaEl = document.getElementById('alertas-stock-lista');
            const topRecetasEl = document.getElementById('top-recetas-lista');

            if (!ventasHoyEl || !ingresosHoyEl || !platoEstrellaEl || !alertasListaEl) {
                console.warn('Dashboard elements not loaded yet');
                return;
            }

            const ventas = await api.getSales();
            const hoy = new Date().toISOString().split('T')[0];
            const ventasHoy = ventas.filter(v => v.fecha.split('T')[0] === hoy);

            ventasHoyEl.textContent = ventasHoy.length;
            const ingresosHoy = ventasHoy.reduce((sum, v) => sum + parseFloat(v.total), 0);
            ingresosHoyEl.textContent = ingresosHoy.toFixed(0) + '€';

            const platosHoy = {};
            ventasHoy.forEach(v => {
                platosHoy[v.receta_nombre] = (platosHoy[v.receta_nombre] || 0) + v.cantidad;
            });
            const platoEstrella = Object.entries(platosHoy).sort((a, b) => b[1] - a[1])[0];
            platoEstrellaEl.textContent = platoEstrella
                ? platoEstrella[0].substring(0, 10)
                : 'Sin ventas';

            // Alertas Stock
            const alertas = window.ingredientes.filter(ing => {
                const stockActual = parseFloat(ing.stock_actual) || 0;
                const stockMinimo = parseFloat(ing.stock_minimo) || 0;
                return stockMinimo > 0 && stockActual <= stockMinimo;
            }).slice(0, 4); // Limitar a 4 para compacto

            if (alertas.length === 0) {
                alertasListaEl.innerHTML = '<p style="color: #10B981; margin: 0; font-size: 12px;">✅ Stock OK</p>';
            } else {
                alertasListaEl.innerHTML = alertas
                    .map(ing => '<div style="padding: 4px 0; border-bottom: 1px solid #fee2e2;"><strong>' + escapeHTML(ing.nombre) + '</strong>: ' + parseFloat(ing.stock_actual).toFixed(1) + ' ' + ing.unidad + '</div>')
                    .join('');
            }

            // Top Recetas por margen
            if (topRecetasEl && window.recetas && window.recetas.length > 0) {
                const recetasConMargen = window.recetas
                    .filter(r => r.precio_venta > 0)
                    .map(r => {
                        const coste = calcularCosteRecetaCompleto(r);
                        const margen = ((r.precio_venta - coste) / r.precio_venta) * 100;
                        return { nombre: r.nombre, margen };
                    })
                    .sort((a, b) => b.margen - a.margen)
                    .slice(0, 3);

                if (recetasConMargen.length > 0) {
                    topRecetasEl.innerHTML = recetasConMargen
                        .map((r, i) =>
                            '<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9;">' +
                            '<span>' + (i + 1) + '. ' + escapeHTML(r.nombre.substring(0, 12)) + '</span>' +
                            '<span style="color: ' + (r.margen >= 60 ? '#10B981' : r.margen >= 40 ? '#F59E0B' : '#EF4444') + '; font-weight: 600;">' + r.margen.toFixed(0) + '%</span></div>'
                        )
                        .join('');
                } else {
                    topRecetasEl.innerHTML = '<p style="color: #64748B; margin: 0; font-size: 12px;">Sin recetas</p>';
                }
            }
        } catch (e) {
            console.error('Error dashboard:', e);
        }
    };

    // Verificar autenticación al cargar
    if (checkAuth()) {
        init();
    }
})();

// === FUNCIONES DE AUTENTICACIÓN ===
window.mostrarRegistro = function () {
    window.showToast(
        'Para registrar tu restaurante, contacta con soporte: hola@mindloop.cloud',
        'info'
    );
};

window.mostrarLogin = function () {
    // Recargar la página para volver al login
    window.location.reload();
};

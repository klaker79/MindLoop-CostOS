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


    // ========== INGREDIENTES (código completo pero resumido visualmente) ==========
    window.mostrarFormularioIngrediente = function () {
        actualizarSelectProveedores();
        document.getElementById('formulario-ingrediente').style.display = 'block';
        document.getElementById('ing-nombre').focus();
    };

    window.cerrarFormularioIngrediente = function () {
        document.getElementById('formulario-ingrediente').style.display = 'none';
        document.querySelector('#formulario-ingrediente form').reset();
        // 🔧 FIX CRÍTICO: Resetear AMBAS variables (local Y global)
        editandoIngredienteId = null;
        window.editandoIngredienteId = null;
        document.getElementById('form-title-ingrediente').textContent = 'Nuevo Ingrediente';
        document.getElementById('btn-text-ingrediente').textContent = 'Añadir';
    };

    function actualizarSelectProveedores() {
        const select = document.getElementById('ing-proveedor-select');
        select.innerHTML = '<option value="">Sin proveedor</option>';
        proveedores.forEach(prov => {
            select.innerHTML += `<option value="${prov.id}">${escapeHTML(prov.nombre)}</option>`;
        });
    }

    function getNombreProveedor(proveedorId) {
        if (!proveedorId) return '-';
        const prov = proveedores.find(p => p.id == proveedorId);
        return prov ? prov.nombre : '-';
    }

    // Variable para la página actual de ingredientes
    let paginaIngredientesActual = 1;

    // Función para cambiar de página
    window.cambiarPaginaIngredientes = function (delta) {
        paginaIngredientesActual += delta;
        window.renderizarIngredientes();
        document.getElementById('tabla-ingredientes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.renderizarIngredientes = function () {
        const busqueda = document.getElementById('busqueda-ingredientes').value.toLowerCase();

        // Obtener filtro de familia activo
        const filtroFamilia = window.filtroIngredientesFamilia || 'todas';

        const filtrados = ingredientes.filter(ing => {
            const nombreProv = getNombreProveedor(ing.proveedorId).toLowerCase();
            const matchBusqueda = ing.nombre.toLowerCase().includes(busqueda) || nombreProv.includes(busqueda);
            const matchFamilia = filtroFamilia === 'todas' || ing.familia === filtroFamilia;
            return matchBusqueda && matchFamilia;
        });

        const container = document.getElementById('tabla-ingredientes');

        // === PAGINACIÓN ===
        const ITEMS_PER_PAGE = 25;
        const totalItems = filtrados.length;
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

        // Asegurar página válida
        if (paginaIngredientesActual > totalPages) paginaIngredientesActual = totalPages;
        if (paginaIngredientesActual < 1) paginaIngredientesActual = 1;

        const startIndex = (paginaIngredientesActual - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const ingredientesPagina = filtrados.slice(startIndex, endIndex);

        if (filtrados.length === 0) {
            container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🥕</div>
      <h3>${busqueda ? '¡No encontramos nada!' : '¡No hay ingredientes aún!'}</h3>
      <p>${busqueda ? 'Intenta con otra búsqueda o añade tu primer ingrediente' : 'Añade tu primer ingrediente para empezar a gestionar tu inventario'}</p>
    </div>
  `;
            document.getElementById('resumen-ingredientes').style.display = 'none';
            return;
        } else {
            let html = '<table><thead><tr>';
            html +=
                '<th>Ingrediente</th><th>Familia</th><th>Proveedor</th><th>Precio</th><th>Stock</th><th>Stock Mínimo</th><th>Acciones</th>';
            html += '</tr></thead><tbody>';

            ingredientesPagina.forEach(ing => {
                const stockActual = parseFloat(ing.stock_actual) || 0;
                const stockMinimo = parseFloat(ing.stock_minimo) || 0;
                const stockBajo = stockMinimo > 0 && stockActual <= stockMinimo;

                html += '<tr>';
                html += `<td><strong style="cursor: pointer;" onclick="window.editarIngrediente(${ing.id})">${escapeHTML(ing.nombre)}</strong></td>`;
                const familiaLower = (ing.familia || 'alimento').toLowerCase();
                const esBebida = familiaLower === 'bebida' || familiaLower === 'bebidas';
                html += `<td><span class="badge ${esBebida ? 'badge-info' : 'badge-success'}">${ing.familia || 'alimento'}</span></td>`;
                html += `<td>${getNombreProveedor(ing.proveedor_id)}</td>`;
                html += `<td>${ing.precio ? parseFloat(ing.precio).toFixed(2) + ' €/' + ing.unidad + ' -' : ''}</td>`;
                html += `<td>`;
                if (ing.stock_actual) {
                    html += `<span class="stock-badge ${stockBajo ? 'stock-low' : 'stock-ok'}">${ing.stock_actual} ${ing.unidad}</span>`;
                    if (stockBajo && ing.stock_minimo) html += ` ⚠️`;
                } else {
                    html += '-';
                }
                html += `</td>`;
                html += '<td>' + parseFloat(ing.stock_minimo) + ' ' + ing.unidad + '-' + '</td>';
                html +=
                    '<td><button class="icon-btn edit" onclick="window.editarIngrediente(' +
                    ing.id +
                    ')">✏️</button> <button class="icon-btn delete" onclick="window.eliminarIngrediente(' +
                    ing.id +
                    ')">🗑️</button></td>';
                html += '</tr>';
            });

            html += '</tbody></table>';

            // === CONTROLES DE PAGINACIÓN ===
            html += `
            <div style="display: flex; justify-content: center; align-items: center; gap: 16px; padding: 20px 0; border-top: 1px solid #e2e8f0; margin-top: 16px;">
                <button onclick="window.cambiarPaginaIngredientes(-1)" 
                    ${paginaIngredientesActual === 1 ? 'disabled' : ''} 
                    style="padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${paginaIngredientesActual === 1 ? '#f1f5f9' : 'white'}; color: ${paginaIngredientesActual === 1 ? '#94a3b8' : '#475569'}; cursor: ${paginaIngredientesActual === 1 ? 'not-allowed' : 'pointer'}; font-weight: 500;">
                    ← Anterior
                </button>
                <span style="font-size: 14px; color: #475569;">
                    Página <strong>${paginaIngredientesActual}</strong> de <strong>${totalPages}</strong>
                </span>
                <button onclick="window.cambiarPaginaIngredientes(1)" 
                    ${paginaIngredientesActual === totalPages ? 'disabled' : ''} 
                    style="padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${paginaIngredientesActual === totalPages ? '#f1f5f9' : 'white'}; color: ${paginaIngredientesActual === totalPages ? '#94a3b8' : '#475569'}; cursor: ${paginaIngredientesActual === totalPages ? 'not-allowed' : 'pointer'}; font-weight: 500;">
                    Siguiente →
                </button>
            </div>`;

            container.innerHTML = html;

            document.getElementById('resumen-ingredientes').innerHTML = `
            <div>Total: <strong>${ingredientes.length}</strong></div>
            <div>Filtrados: <strong>${filtrados.length}</strong></div>
            <div>Mostrando: <strong>${startIndex + 1}-${Math.min(endIndex, totalItems)}</strong></div>
          `;
            document.getElementById('resumen-ingredientes').style.display = 'flex';
        }
    };
    /* ======================================== */

    // ========== RECETAS (resumido) ==========

    /* ========================================
         * CÓDIGO LEGACY - RECETAS (COMENTADO)
         * ✅ AHORA EN: src/modules/recetas/
         * Fecha migración: 2025-12-21
         * NO BORRAR hasta validar 100% producción
         * ======================================== 
        window.mostrarFormularioReceta = function () {
          if (ingredientes.length === 0) {
            showToast('Primero añade ingredientes', 'warning');
            window.cambiarTab('ingredientes');
            window.mostrarFormularioIngrediente();
            return;
          }
          document.getElementById('formulario-receta').style.display = 'block';
          window.agregarIngredienteReceta();
          document.getElementById('rec-nombre').focus();
        };

        window.cerrarFormularioReceta = function () {
          document.getElementById('formulario-receta').style.display = 'none';
          document.querySelector('#formulario-receta form').reset();
          document.getElementById('lista-ingredientes-receta').innerHTML = '';
          document.getElementById('coste-calculado-form').style.display = 'none';
          editandoRecetaId = null;
          // Limpiar campos del formulario
          document.getElementById('rec-nombre').value = '';
          document.getElementById('rec-codigo').value = ''; // Reset código
          document.getElementById('rec-categoria').value = 'alimentos';
          document.getElementById('rec-precio_venta').value = '';
          document.getElementById('rec-porciones').value = '1';
          document.getElementById('lista-ingredientes-receta').innerHTML = '';
          document.getElementById('form-title-receta').textContent = 'Nueva Receta';
          document.getElementById('btn-text-receta').textContent = 'Guardar';
        };

        // Agregar fila de ingrediente en formulario de receta
        window.agregarIngredienteReceta = function () {
          const lista = document.getElementById('lista-ingredientes-receta');
          const item = document.createElement('div');
          item.className = 'ingrediente-item';
          item.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px;';

          // Ordenar ingredientes alfabéticamente
          const ingredientesOrdenados = [...(window.ingredientes || [])].sort((a, b) => 
            a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
          );

          let optionsHtml = '<option value="">Selecciona ingrediente...</option>';
          ingredientesOrdenados.forEach(ing => {
            const precio = parseFloat(ing.precio || 0).toFixed(2);
            const unidad = ing.unidad || 'ud';
            optionsHtml += `<option value="${ing.id}">${escapeHTML(ing.nombre)} (${precio}€/${unidad})</option>`;
          });

          item.innerHTML = `
            <select style="flex: 2; padding: 8px; border: 1px solid #ddd; border-radius: 6px;" onchange="window.calcularCosteReceta()">
              ${optionsHtml}
            </select>
            <input type="number" step="0.001" min="0" placeholder="Cantidad" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px;" onchange="window.calcularCosteReceta()">
            <button type="button" onclick="this.parentElement.remove(); window.calcularCosteReceta();" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">✕</button>
          `;

          lista.appendChild(item);
        };

        // Calcular coste de receta desde ingredientes seleccionados
        window.calcularCosteReceta = function () {
          const items = document.querySelectorAll('#lista-ingredientes-receta .ingrediente-item');
          let costeTotal = 0;

          items.forEach(item => {
            const select = item.querySelector('select');
            const input = item.querySelector('input');
            if (select.value && input.value) {
              const ing = window.ingredientes.find(i => i.id === parseInt(select.value));
              if (ing) {
                costeTotal += parseFloat(ing.precio || 0) * parseFloat(input.value || 0);
              }
            }
          });

          const costeDiv = document.getElementById('coste-calculado-form');
          if (costeDiv) {
            costeDiv.style.display = costeTotal > 0 ? 'block' : 'none';
            const costeSpan = document.getElementById('coste-receta-valor');
            if (costeSpan) costeSpan.textContent = costeTotal.toFixed(2) + '€';

            const precioVenta = parseFloat(document.getElementById('rec-precio_venta')?.value || 0);
            const margenSpan = document.getElementById('margen-receta-valor');
            if (margenSpan && precioVenta > 0) {
              const margen = ((precioVenta - costeTotal) / precioVenta * 100);
              margenSpan.textContent = margen.toFixed(1) + '%';
              margenSpan.style.color = margen >= 60 ? '#10b981' : margen >= 40 ? '#f59e0b' : '#ef4444';
            }
          }

          return costeTotal;
        };

        /* ⚠️ COMENTADO: Usar src/modules/recetas/recetas-crud.js que soporta subrecetas
        window.guardarReceta = async function (event) {
          event.preventDefault();

          const items = document.querySelectorAll('#lista-ingredientes-receta .ingrediente-item');
          const ingredientesReceta = [];

          items.forEach(item => {
            const select = item.querySelector('select');
            const input = item.querySelector('input');
            if (select.value && input.value) {
              ingredientesReceta.push({
                ingredienteId: parseInt(select.value),
                cantidad: parseFloat(input.value)
              });
            }
          });

          if (ingredientesReceta.length === 0) {
            showToast('Añade ingredientes a la receta', 'warning');
            return;
          }

          const receta = {
            nombre: document.getElementById('rec-nombre').value,
            codigo: document.getElementById('rec-codigo').value, // Guardar código
            categoria: document.getElementById('rec-categoria').value,
            precio_venta: parseFloat(document.getElementById('rec-precio_venta').value) || 0,
            porciones: parseInt(document.getElementById('rec-porciones').value) || 1,
            ingredientes: ingredientesReceta
          };

          showLoading();

          try {
            if (editandoRecetaId !== null) {
              await api.updateReceta(editandoRecetaId, receta);
            } else {
              await api.createReceta(receta);
            }
            await cargarDatos();
            renderizarRecetas();
            hideLoading();
            showToast(editandoRecetaId ? 'Receta actualizada' : 'Receta creada', 'success');
            window.cerrarFormularioReceta();
          } catch (error) {
            hideLoading();
            console.error('Error:', error);
            showToast('Error guardando receta: ' + error.message, 'error');
          }
        };
        */

    /* ⚠️ COMENTADO: Usar src/modules/recetas/recetas-crud.js que soporta subrecetas
    window.editarReceta = function (id) {
        const rec = recetas.find(r => r.id === id);
        if (!rec) return;

        document.getElementById('rec-nombre').value = rec.nombre;
        document.getElementById('rec-codigo').value = rec.codigo || ''; // Cargar código
        document.getElementById('rec-categoria').value = rec.categoria;
        document.getElementById('rec-precio_venta').value = rec.precio_venta;
        document.getElementById('rec-porciones').value = rec.porciones;

        document.getElementById('lista-ingredientes-receta').innerHTML = '';
        rec.ingredientes.forEach(item => {
            window.agregarIngredienteReceta();
            const lastItem = document.querySelector('#lista-ingredientes-receta .ingrediente-item:last-child');
            lastItem.querySelector('select').value = item.ingredienteId;
            lastItem.querySelector('input').value = item.cantidad;
        });

        window.calcularCosteReceta();
        editandoRecetaId = id;
        document.getElementById('form-title-receta').textContent = 'Editar';
        document.getElementById('btn-text-receta').textContent = 'Guardar';
        window.mostrarFormularioReceta();
    };
    */

    // ... (eliminarReceta y calcularCosteRecetaCompleto sin cambios)

    window.renderizarRecetas = function () {
        const busqueda = document.getElementById('busqueda-recetas').value.toLowerCase();
        const filtradas = recetas.filter(r =>
            r.nombre.toLowerCase().includes(busqueda) ||
            (r.codigo && r.codigo.toString().includes(busqueda)) // Buscar por código
        );

        const container = document.getElementById('tabla-recetas');

        if (filtradas.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
              <div class="icon">👨‍🍳</div>
              <h3>${busqueda ? 'No encontradas' : 'Aún no hay recetas'}</h3>
            </div>
          `;
            document.getElementById('resumen-recetas').style.display = 'none';
        } else {
            let html = '<table><thead><tr>';
            html += '<th>Cód.</th><th>Plato</th><th>Categoría</th><th>Coste</th><th>Precio</th><th>Margen</th><th>Acciones</th>';
            html += '</tr></thead><tbody>';

            filtradas.forEach(rec => {
                const coste = calcularCosteRecetaCompleto(rec);
                const margen = rec.precio_venta - coste;
                const pct = rec.precio_venta > 0 ? ((margen / rec.precio_venta) * 100).toFixed(0) : 0;

                html += '<tr>';
                html += `<td><span style="color:#666;font-size:12px;">${rec.codigo || '-'}</span></td>`;
                html += `<td><strong>${escapeHTML(rec.nombre)}</strong></td>`;
                html += `<td><span class="badge badge-success">${rec.categoria}</span></td>`;
                html += `<td>${coste.toFixed(2)} €</td>`;
                html += `<td>${rec.precio_venta ? parseFloat(rec.precio_venta).toFixed(2) : '0.00'} €</td>`;
                html += `<td><span class="badge ${margen > 0 ? 'badge-success' : 'badge-warning'}">${margen.toFixed(2)} € (${pct}%)</span></td>`;
                html += `<td><div class="actions">`;
                html += `<button class="icon-btn produce" onclick="window.abrirModalProducir(${rec.id})">⬇️</button>`;
                html += `<button class="icon-btn edit" onclick="window.editarReceta(${rec.id})">✏️</button>`;
                html += `<button class="icon-btn delete" onclick="window.eliminarReceta(${rec.id})">🗑️</button>`;
                html += '</div></td>';
                html += '</tr>';
            });


            html += '</tbody></table>';
            container.innerHTML = html;

            document.getElementById('resumen-recetas').innerHTML = `
            <div>Total: <strong>${recetas.length}</strong></div>
            <div>Mostrando: <strong>${filtradas.length}</strong></div>
          `;
            document.getElementById('resumen-recetas').style.display = 'flex';
        }
    };

    // ========== PRODUCCIÓN ==========
    window.abrirModalProducir = function (id) {
        recetaProduciendo = id;
        const rec = recetas.find(r => r.id === id);
        document.getElementById('modal-plato-nombre').textContent = rec.nombre;
        document.getElementById('modal-cantidad').value = 1;
        window.actualizarDetalleDescuento();
        document.getElementById('modal-producir').classList.add('active');
    };

    window.cerrarModalProducir = function () {
        document.getElementById('modal-producir').classList.remove('active');
        recetaProduciendo = null;
    };

    window.actualizarDetalleDescuento = function () {
        if (recetaProduciendo === null) return;
        const cant = parseInt(document.getElementById('modal-cantidad').value) || 1;
        const rec = recetas.find(r => r.id === recetaProduciendo);
        let html = '<ul style="margin:0;padding-left:20px;">';
        rec.ingredientes.forEach(item => {
            const ing = ingredientes.find(i => i.id === item.ingredienteId);
            if (ing) html += `<li>${ing.nombre}: -${item.cantidad * cant} ${ing.unidad}</li>`;
        });
        html += '</ul>';
        document.getElementById('modal-descuento-detalle').innerHTML = html;
    };


    // ========== PROVEEDORES (resumido) ==========

    /* ========================================
         * CÓDIGO LEGACY - PROVEEDORES (COMENTADO)
         * ✅ AHORA EN: src/modules/proveedores/
         * Fecha migración: 2025-12-21
         * NO BORRAR hasta validar 100% producción
         * ======================================== 
        window.mostrarFormularioProveedor = function () {
          document.getElementById('formulario-proveedor').style.display = 'block';
          cargarIngredientesProveedor();
          document.getElementById('prov-nombre').focus();
        };

        window.cerrarFormularioProveedor = function () {
          document.getElementById('formulario-proveedor').style.display = 'none';
          document.querySelector('#formulario-proveedor form').reset();
          editandoProveedorId = null;
          document.getElementById('form-title-proveedor').textContent = 'Nuevo Proveedor';
          document.getElementById('btn-text-proveedor').textContent = 'Añadir';
        };

        function cargarIngredientesProveedor(seleccionados = []) {
          const container = document.getElementById('lista-ingredientes-proveedor');
          if (ingredientes.length === 0) {
            container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Primero añade ingredientes</p>';
            return;
          }

          const busqueda = document.getElementById('buscar-ingredientes-proveedor').value.toLowerCase();
          const filtrados = ingredientes.filter(ing => ing.nombre.toLowerCase().includes(busqueda));

          let html = '';
          filtrados.forEach(ing => {
            const checked = seleccionados.includes(ing.id) ? 'checked' : '';
            html += `
            <div class="ingrediente-checkbox">
              <input type="checkbox" id="check-ing-${ing.id}" value="${ing.id}" ${checked}>
              <label for="check-ing-${ing.id}">${escapeHTML(ing.nombre)}</label>
            </div>
          `;
          });

          container.innerHTML = html || '<p style="color:#999;padding:10px;">Sin resultados</p>';
        }

        window.filtrarIngredientesProveedor = function () {
          const checks = document.querySelectorAll('#lista-ingredientes-proveedor input[type="checkbox"]:checked');
          const seleccionados = Array.from(checks).map(c => parseInt(c.value));
          cargarIngredientesProveedor(seleccionados);
        };


    window.renderizarProveedores = function () {
        const busqueda = document.getElementById('busqueda-proveedores').value.toLowerCase();
        const filtrados = proveedores.filter(p => p.nombre.toLowerCase().includes(busqueda));

        const container = document.getElementById('tabla-proveedores');

        if (filtrados.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
              <div class="icon">🚚</div>
              <h3>${busqueda ? 'No encontrados' : 'Aún no hay proveedores'}</h3>
            </div>
          `;
            document.getElementById('resumen-proveedores').style.display = 'none';
        } else {
            let html = '<table><thead><tr>';
            html += '<th>Proveedor</th><th>Contacto</th><th>Teléfono</th><th>Ingredientes</th><th>Acciones</th>';
            html += '</tr></thead><tbody>';

            filtrados.forEach(prov => {
                const numIng = prov.ingredientes ? prov.ingredientes.length : 0;

                html += '<tr>';
                html += `<td><strong>${escapeHTML(prov.nombre)}</strong></td>`;
                html += `<td>${prov.contacto || '-'}</td>`;
                html += `<td>${prov.telefono || '-'}</td>`;
                html += `<td><span class="badge badge-info">${numIng}</span></td>`;
                html += `<td><div class="actions">`;
                html += `<button class="icon-btn view" onclick="window.verProveedorDetalles(${prov.id})">👁️</button>`;
                html += `<button class="icon-btn edit" onclick="window.editarProveedor(${prov.id})">✏️</button>`;
                html += `<button class="icon-btn delete" onclick="window.eliminarProveedor(${prov.id})">🗑️</button>`;
                html += '</div></td>';
                html += '</tr>';
            });

            html += '</tbody></table>';
            container.innerHTML = html;

            document.getElementById('resumen-proveedores').innerHTML = `
            <div>Total: <strong>${proveedores.length}</strong></div>
            <div>Mostrando: <strong>${filtrados.length}</strong></div>
          `;
            document.getElementById('resumen-proveedores').style.display = 'flex';
        }
    };
    /* ======================================== */

    // ========== PEDIDOS ==========

    /* ========================================
     * CÓDIGO LEGACY - PEDIDOS (COMENTADO)
     * ✅ AHORA EN: src/modules/pedidos/
     * Fecha migración: 2025-12-21
     * NO BORRAR hasta validar 100% producción
     * ======================================== */

    window.cerrarFormularioPedido = function () {
        document.getElementById('formulario-pedido').style.display = 'none';
        document.querySelector('#formulario-pedido form').reset();
        document.getElementById('container-ingredientes-pedido').style.display = 'none';
        document.getElementById('lista-ingredientes-pedido').innerHTML = '';
        document.getElementById('total-pedido-form').style.display = 'none';
    };

    window.cargarIngredientesPedido = function () {
        const proveedorId = parseInt(document.getElementById('ped-proveedor').value);
        if (!proveedorId) {
            document.getElementById('container-ingredientes-pedido').style.display = 'none';
            return;
        }

        const proveedor = proveedores.find(p => p.id === proveedorId);
        if (!proveedor || !proveedor.ingredientes || proveedor.ingredientes.length === 0) {
            document.getElementById('container-ingredientes-pedido').style.display = 'none';
            showToast('Este proveedor no tiene ingredientes asignados', 'warning');
            return;
        }

        document.getElementById('container-ingredientes-pedido').style.display = 'block';
        document.getElementById('lista-ingredientes-pedido').innerHTML = '';
        window.agregarIngredientePedido();
    };

    window.agregarIngredientePedido = function () {
        const proveedorId = parseInt(document.getElementById('ped-proveedor').value);
        if (!proveedorId) return;

        const proveedor = proveedores.find(p => p.id === proveedorId);
        const ingredientesProveedor = ingredientes.filter(ing =>
            proveedor.ingredientes.includes(ing.id)
        );

        const container = document.getElementById('lista-ingredientes-pedido');
        const div = document.createElement('div');
        div.className = 'ingrediente-item';

        let opciones = '<option value="">Seleccionar...</option>';
        ingredientesProveedor.forEach(ing => {
            opciones += `<option value="${ing.id}">${escapeHTML(ing.nombre)} (${parseFloat(ing.precio || 0).toFixed(2)}€/${ing.unidad})</option>`;
        });

        div.innerHTML = `
          <select onchange="window.calcularTotalPedido()">${opciones}</select>
          <input type="number" placeholder="Cantidad" step="0.01" min="0" oninput="window.calcularTotalPedido()">
          <span style="font-size: 12px; color: #666;"></span>
          <button type="button" onclick="this.parentElement.remove(); window.calcularTotalPedido()">×</button>
        `;

        container.appendChild(div);
    };

    window.calcularTotalPedido = function () {
        const items = document.querySelectorAll('#lista-ingredientes-pedido .ingrediente-item');
        let total = 0;
        let hayDatos = false;

        items.forEach(item => {
            const select = item.querySelector('select');
            const input = item.querySelector('input');
            const span = item.querySelector('span');

            if (select.value && input.value) {
                hayDatos = true;
                const ing = ingredientes.find(i => i.id == select.value);
                const cantidad = parseFloat(input.value);
                const subtotal = ing.precio * cantidad;
                total += subtotal;
                span.textContent = `${subtotal.toFixed(2)} €`;
            } else {
                span.textContent = '';
            }
        });

        if (hayDatos) {
            document.getElementById('total-pedido-form').style.display = 'block';
            document.getElementById('total-pedido-value').textContent = total.toFixed(2) + ' €';
        } else {
            document.getElementById('total-pedido-form').style.display = 'none';
        }
    };


    // Función auxiliar para calcular coste completo de receta
    window.calcularCosteRecetaCompleto = function (receta) {
        if (!receta || !receta.ingredientes) return 0;

        // 💰 Crear maps para búsquedas O(1)
        const inventario = window.inventarioCompleto || [];
        const invMap = new Map(inventario.map(i => [i.id, i]));

        const costeTotalLote = receta.ingredientes.reduce((total, item) => {
            const ing = window.ingredientes.find(i => i.id === item.ingredienteId);
            if (!ing) return total;

            const invItem = invMap.get(item.ingredienteId);

            // 💰 Prioridad: precio_medio del inventario, luego precio/cantidad_por_formato
            let precioUnitario = 0;
            if (invItem?.precio_medio) {
                precioUnitario = parseFloat(invItem.precio_medio);
            } else {
                const precioFormato = parseFloat(ing.precio) || 0;
                // 🔧 FIX: Usar 1 como default si cantidad_por_formato es NULL/0
                const cantidadPorFormato = parseFloat(ing.cantidad_por_formato) || 1;
                precioUnitario = precioFormato / cantidadPorFormato;
            }

            return total + precioUnitario * (item.cantidad || 0);
        }, 0);

        // 🔧 FIX: Dividir por porciones para obtener coste POR PORCIÓN
        const porciones = parseInt(receta.porciones) || 1;
        return parseFloat((costeTotalLote / porciones).toFixed(2));
    };

    window.descargarPedidoPDF = function () {
        if (pedidoViendoId === null) return;

        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const pedido = pedidos.find(p => p.id === pedidoViendoId);
        const prov = proveedores.find(p => p.id === pedido.proveedorId);

        // Crear HTML para imprimir
        let htmlPrint = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Pedido - ${getRestaurantNameForFile()}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #c35a3f; padding-bottom: 20px; }
    .header h1 { color: #c35a3f; margin: 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f8f8f8; padding: 20px; border-radius: 5px; }
    .info-item { margin-bottom: 10px; }
    .info-item strong { display: block; color: #666; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f8f8f8; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-size: 12px; color: #666; }
    td { padding: 12px; border-bottom: 1px solid #eee; }
    .total-box { background: #f0fdf4; border: 2px solid #10b981; padding: 20px; border-radius: 5px; text-align: right; }
    .total-box strong { font-size: 24px; color: #059669; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; }
    .badge-received { background: #d1fae5; color: #059669; }
    .badge-pending { background: #fef3c7; color: #d97706; }
    .varianza { font-size: 11px; }
    .varianza.pos { color: #10b981; }
    .varianza.neg { color: #ef4444; }
    @media print {
      body { padding: 20px; }
      button { display: none; }
    }
    /* === RESPONSIVE MOBILE === */
        @media(max - width: 768px) {
  /* Container */
  .container { padding: 12px; }

  /* Header */
  .header {
            padding: 8px 32px;
            flex - direction: column;
            text - align: center;
            gap: 12px;
          }
  
  .header h1 { font - size: 32px; }
  .header p { font - size: 14px; }

  /* KPI Dashboard */
  .kpi - dashboard {
            grid - template - columns: repeat(2, 1fr);
            gap: 12px;
            padding: 0 12px;
            margin: 16px 0;
          }
  
  .kpi - card {
            padding: 16px;
          }
  
  .kpi - icon { font - size: 24px; margin - bottom: 8px; }
  .kpi - label { font - size: 11px; }
  .kpi - value { font - size: 28px; }
  .kpi - trend { font - size: 12px; }

  /* Tabs */
  .tabs {
            overflow - x: auto;
            overflow - y: hidden;
            white - space: nowrap;
            padding: 12px 12px 0;
            gap: 8px;
            -webkit - overflow - scrolling: touch;
            scrollbar - width: none;
          }
  
  .tabs:: -webkit - scrollbar { display: none; }
  
  .tab {
            padding: 10px 16px;
            font - size: 13px;
            display: inline - block;
          }

  /* Main Card */
  .main - card {
            padding: 16px;
            border - radius: 16px 16px 0 0;
          }

  /* Top Bar */
  .top - bar {
            flex - direction: column;
            align - items: flex - start;
            gap: 12px;
            margin - bottom: 20px;
          }
  
  .top - bar h2 { font - size: 22px; }
  .top - bar p { font - size: 13px; }

  /* Buttons */
  .btn {
            width: 100 %;
            justify - content: center;
            padding: 14px 20px;
            font - size: 14px;
          }
  
  .btn - small {
            width: auto;
            padding: 10px 16px;
          }

  /* Search Box */
  .search - box {
            max - width: 100 %;
            margin: 16px 0;
          }

  /* Form Grid */
  .form - grid {
            grid - template - columns: 1fr;
            gap: 12px;
          }
  
  .form - card {
            padding: 16px;
          }

  /* Tables */
  table {
            display: block;
            overflow - x: auto;
            white - space: nowrap;
            -webkit - overflow - scrolling: touch;
          }
  
  table thead th {
            padding: 12px 16px;
            font - size: 10px;
          }
  
  table tbody td {
            padding: 12px 16px;
            font - size: 13px;
          }

  /* Actions */
  .actions {
            gap: 6px;
          }
  
  .icon - btn {
            width: 32px;
            height: 32px;
            font - size: 14px;
          }

  /* Stats Grid */
  .stats - grid {
            grid - template - columns: 1fr;
            gap: 16px;
          }

  /* Charts Grid */
  .charts - grid {
            grid - template - columns: 1fr;
            gap: 16px;
          }

          /* Balance Cards */
          [id ^= "tab-balance"] > div[style *= "grid"] {
            grid - template - columns: 1fr!important;
            gap: 16px!important;
          }

          /* Balance Cards Gradient */
          [id = "tab-balance"] > div: nth - child(2) > div {
            padding: 24px!important;
          }

          [id = "tab-balance"] > div: nth - child(2) > div > div: first - child {
            font - size: 100px!important;
          }

          [id = "tab-balance"] > div: nth - child(2) > div[id ^= "balance-"] {
            font - size: 36px!important;
          }


  /* Ingrediente Item */
  .ingrediente - item {
            grid - template - columns: 1fr;
            gap: 8px;
          }
  
  .ingrediente - item select,
  .ingrediente - item input {
            width: 100 %;
          }

  /* Toast Container */
  .toast - container {
            top: 60px;
            right: 12px;
            left: 12px;
            max - width: none;
          }
  
  .toast {
            padding: 12px 16px;
          }

  /* Summary */
  .summary {
            flex - direction: column;
            gap: 8px;
            align - items: flex - start;
          }
        }

        @media(max - width: 480px) {
  /* Extra pequeño */
  .kpi - dashboard {
            grid - template - columns: 1fr;
          }
  
  .header h1 { font - size: 28px; }
  
  .kpi - value { font - size: 32px; }
        }
  </style >
</head >
          <body>
            <div class="header">
              <img src="logo.png" onerror="this.style.display='none'">
                <h1>${currentUser.restaurante || 'Mi Restaurante'}</h1>
                <p>Pedido a Proveedor</p>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <strong>Proveedor</strong>
                ${prov ? prov.nombre : 'Desconocido'}
              </div>
              <div class="info-item">
                <strong>Fecha del Pedido</strong>
                ${new Date(pedido.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
              <div class="info-item">
                <strong>Estado</strong>
                <span class="badge ${pedido.estado === 'recibido' ? 'badge-received' : 'badge-pending'}">
                  ${pedido.estado === 'recibido' ? 'Recibido' : 'Pendiente'}
                </span>
              </div>
              ${pedido.estado === 'recibido' && pedido.fechaRecepcion
                ? `
    <div class="info-item">
      <strong>Fecha de Recepción</strong>
      ${new Date(pedido.fechaRecepcion).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
    </div>
    `
                : ''
            }
            </div>

            <h3>Detalle del Pedido</h3>
            <table>
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Cantidad</th>
                  <th>Precio Unitario</th>
                  <th>Subtotal</th>
                  ${pedido.estado === 'recibido' ? '<th>Estado</th>' : ''}
                </tr>
              </thead>
              <tbody>`;

        const items = pedido.ingredientes;
        let totalFinal = 0;

        items.forEach(item => {
            const ing = ingredientes.find(i => i.id === item.ingredienteId);
            if (!ing) return;

            const esRecibido = pedido.estado === 'recibido' && item.cantidadRecibida !== undefined;
            const cantidad = esRecibido ? item.cantidadRecibida : item.cantidad;
            const precio = esRecibido && item.precioReal ? item.precioReal : item.precioUnitario;
            const subtotal = cantidad * precio;

            if (item.estado !== 'no-entregado') {
                totalFinal += subtotal;
            }

            htmlPrint += '<tr>';
            htmlPrint += `<td>${ing.nombre}</td>`;
            htmlPrint += `<td>${cantidad} ${ing.unidad}`;

            if (esRecibido && item.cantidad && Math.abs(cantidad - item.cantidad) > 0.01) {
                const diff = cantidad - item.cantidad;
                htmlPrint += `<br><span class="varianza ${diff > 0 ? 'pos' : 'neg'}">(${diff > 0 ? '+' : ''}${diff.toFixed(2)})</span>`;
            }

            htmlPrint += `</td>`;
            htmlPrint += `<td>${parseFloat(precio || 0).toFixed(2)} €/${ing.unidad}`;

            if (
                esRecibido &&
                item.precioUnitario &&
                Math.abs(precio - item.precioUnitario) > 0.01
            ) {
                const diff = precio - item.precioUnitario;
                htmlPrint += `<br><span class="varianza ${diff > 0 ? 'neg' : 'pos'}">(${diff > 0 ? '+' : ''}${diff.toFixed(2)} €)</span>`;
            }

            htmlPrint += `</td>`;
            htmlPrint += `<td>${item.estado === 'no-entregado' ? '0.00' : subtotal.toFixed(2)} €</td>`;

            if (esRecibido) {
                let estadoText = '';
                if (item.estado === 'consolidado') estadoText = '✅ OK';
                else if (item.estado === 'varianza') estadoText = '⚠️ Varianza';
                else if (item.estado === 'no-entregado') estadoText = '❌ No entregado';
                htmlPrint += `<td>${estadoText}</td>`;
            }

            htmlPrint += '</tr>';
        });

        htmlPrint += '</tbody></table>';

        if (pedido.estado === 'recibido' && pedido.totalRecibido !== undefined) {
            const varianza = pedido.totalRecibido - pedido.total;
            htmlPrint += `
            <div class="total-box">
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center;">
                <div>
                  <strong style="color:#666;font-size:14px;">Total Original</strong><br>
                    <span style="font-size:20px;">${pedido.total.toFixed(2)} €</span>
                </div>
                <div>
                  <strong style="color:#059669;font-size:14px;">Total Recibido</strong><br>
                    <strong>${pedido.totalRecibido.toFixed(2)} €</strong>
                </div>
                <div>
                  <strong style="color:#666;font-size:14px;">Varianza</strong><br>
                    <span style="font-size:20px;color:${varianza >= 0 ? '#ef4444' : '#10b981'};">${varianza >= 0 ? '+' : ''}${varianza.toFixed(2)} €</span>
                </div>
              </div>
            </div>`;
        } else {
            htmlPrint += `
  <div class="total-box">
   <strong>Total del Pedido: ${parseFloat(pedido.total).toFixed(2)} €</strong>
  </div>`;
        }

        htmlPrint += `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center;">
              Generado el ${new Date().toLocaleDateString('es-ES')} - ${currentUser.restaurante || 'MindLoop Dashboard'}
            </div>
          </body>
</html > `;

        // Abrir en nueva ventana para imprimir/guardar PDF
        const ventana = window.open('', '_blank');
        ventana.document.write(htmlPrint);
        ventana.document.close();

        // Esperar a que se cargue y abrir diálogo de impresión
        setTimeout(() => {
            ventana.print();
        }, 250);
    };

    window.renderizarPedidos = function () {
        const busqueda = document.getElementById('busqueda-pedidos').value.toLowerCase();
        const filtrados = pedidos.filter(ped => {
            const prov = proveedores.find(p => p.id === ped.proveedorId);
            const nombreProv = prov ? prov.nombre.toLowerCase() : '';
            return nombreProv.includes(busqueda) || ped.estado.includes(busqueda);
        });

        const container = document.getElementById('tabla-pedidos');

        if (filtrados.length === 0) {
            container.innerHTML = `
          < div class="empty-state" >
              <div class="icon">📋</div>
              <h3>${busqueda ? 'No encontrados' : 'Aún no hay pedidos'}</h3>
              <p>${busqueda ? 'Otra búsqueda' : 'Crea tu primer pedido'}</p>
            </div >
          `;
            document.getElementById('resumen-pedidos').style.display = 'none';
        } else {
            let html = '<table><thead><tr>';
            html +=
                '<th>Fecha</th><th>Proveedor</th><th>Items</th><th>Total</th><th>Estado</th><th>Acciones</th>';
            html += '</tr></thead><tbody>';

            filtrados.forEach(ped => {
                const prov = proveedores.find(p => p.id === (ped.proveedor_id || ped.proveedorId));
                const nombreProv = prov ? prov.nombre : 'Desconocido';

                html += '<tr>';
                html += `< td > ${new Date(ped.fecha).toLocaleDateString('es-ES')}</td > `;
                html += `< td > <strong>${nombreProv}</strong></td > `;
                html += `< td > ${ped.ingredientes.length} ingredientes</td > `;
                html += `< td > <strong>${parseFloat(ped.total).toFixed(2)} €</strong></td > `;
                html += `< td > <span class="badge ${ped.estado === 'recibido' ? 'badge-received' : 'badge-pending'}">${ped.estado === 'recibido' ? 'Recibido' : 'Pendiente'}</span></td > `;
                html += `< td > <div class="actions">`;
                html += `<button type="button" class="icon-btn view" onclick="window.verDetallesPedido(${ped.id})" title="Ver detalles">👁️</button>`;
                if (ped.estado === 'pendiente') {
                    html += `<button type="button" class="icon-btn receive" onclick="window.marcarPedidoRecibido(${ped.id})" title="Recibir pedido">📥</button>`;
                }
                html += `<button type="button" class="icon-btn delete" onclick="window.eliminarPedido(${ped.id})" title="Eliminar">🗑️</button>`;
                html += '</div></td > ';
                html += '</tr>';
            });

            html += '</tbody></table>';
            container.innerHTML = html;

            const totalPendientes = pedidos.filter(p => p.estado === 'pendiente').length;
            const totalRecibidos = pedidos.filter(p => p.estado === 'recibido').length;

            document.getElementById('resumen-pedidos').innerHTML = `
            <div>Total: <strong>${pedidos.length}</strong></div>
            <div>Pendientes: <strong>${totalPendientes}</strong></div>
            <div>Recibidos: <strong>${totalRecibidos}</strong></div>
          `;
            document.getElementById('resumen-pedidos').style.display = 'flex';
        }
    };
    /* ======================================== */

    // ========== ANÁLISIS (resumido) ==========
    window.renderizarAnalisis = async function () {
        if (recetas.length === 0 || ingredientes.length === 0) {
            document.getElementById('analisis-vacio').style.display = 'block';
            document.getElementById('analisis-contenido').style.display = 'none';
            return;
        }

        document.getElementById('analisis-vacio').style.display = 'none';
        document.getElementById('analisis-contenido').style.display = 'block';

        let totalMargen = 0;
        let totalCoste = 0;
        const datosRecetas = recetas.map(rec => {
            const coste = calcularCosteRecetaCompleto(rec);
            const margen = rec.precio_venta - coste;
            const margenPct = rec.precio_venta > 0 ? (margen / rec.precio_venta) * 100 : 0;
            totalMargen += margenPct;
            totalCoste += coste;
            return { ...rec, coste, margen, margenPct };
        });

        try {
            const menuAnalysisRaw = await api.getMenuEngineering(); // Nueva llamada a la API

            // 🔧 FILTRO: Solo mostrar items con food cost > 15% (excluye vinos/bebidas)
            // Los vinos tienen ~5-12% food cost, los alimentos reales tienen >20%
            const menuAnalysis = menuAnalysisRaw.filter(item => {
                const foodCost = item.precio_venta > 0 ? (item.coste / item.precio_venta) * 100 : 0;
                return foodCost > 15;
            });

            let totalMargen = 0;
            let totalCoste = 0;
            const datosRecetasRaw = recetas.map(rec => {
                const coste = calcularCosteRecetaCompleto(rec);
                const margen = rec.precio_venta - coste;
                const margenPct = rec.precio_venta > 0 ? (margen / rec.precio_venta) * 100 : 0;
                totalMargen += margenPct;
                totalCoste += coste;
                return { ...rec, coste, margen, margenPct };
            });

            // 🔧 FILTRO: Solo items con food cost > 15% para tabla de rentabilidad
            const datosRecetas = datosRecetasRaw.filter(rec => {
                const foodCost = rec.precio_venta > 0 ? (rec.coste / rec.precio_venta) * 100 : 0;
                return foodCost > 15;
            });

            const margenPromedio = datosRecetas.length > 0 ? (datosRecetas.reduce((sum, r) => sum + r.margenPct, 0) / datosRecetas.length).toFixed(1) : '0';
            const costePromedio = datosRecetas.length > 0 ? (datosRecetas.reduce((sum, r) => sum + r.coste, 0) / datosRecetas.length).toFixed(2) : '0';

            document.getElementById('stat-total-recetas').textContent = menuAnalysis.length;
            document.getElementById('stat-margen-promedio').textContent = margenPromedio + '%';
            document.getElementById('stat-coste-promedio').textContent = costePromedio + ' €';
            document.getElementById('stat-total-ingredientes').textContent = ingredientes.length;

            // Renderizar Gráficos existentes
            renderRevenueChart();
            renderChartRentabilidad(datosRecetas);
            renderChartIngredientes();
            renderChartMargenCategoria();
            renderTablaRentabilidad(datosRecetas);

            // RENDERIZAR INGENIERÍA DE MENÚ (Matriz BCG)
            renderMenuEngineeringUI(menuAnalysis);
        } catch (error) {
            console.error('Error renderizando análisis:', error);
        }
    };

    window.renderMenuEngineeringUI = function (data) {
        const container = document.getElementById('bcg-matrix-container');
        if (!container || !data || data.length === 0) return;

        // Contenedores
        const containers = {
            estrella: document.getElementById('lista-estrella'),
            caballo: document.getElementById('lista-caballo'),
            puzzle: document.getElementById('lista-puzzle'),
            perro: document.getElementById('lista-perro'),
        };

        // Limpiar listas
        Object.values(containers).forEach(c => {
            if (c) c.innerHTML = '';
        });

        // Contar por categoría
        const counts = { estrella: 0, puzzle: 0, caballo: 0, perro: 0 };
        const colorMap = {
            estrella: 'rgba(34, 197, 94, 0.8)',
            puzzle: 'rgba(59, 130, 246, 0.8)',
            caballo: 'rgba(249, 115, 22, 0.8)',
            perro: 'rgba(239, 68, 68, 0.8)',
        };

        // Procesar datos para scatter
        const scatterData = data.map(item => {
            counts[item.clasificacion] = (counts[item.clasificacion] || 0) + 1;
            return {
                x: item.popularidad,
                y: item.margen,
                nombre: item.nombre,
                clasificacion: item.clasificacion,
                backgroundColor: colorMap[item.clasificacion] || 'rgba(100,100,100,0.5)',
            };
        });

        // Actualizar contadores
        document.getElementById('count-estrella').textContent = counts.estrella || 0;
        document.getElementById('count-puzzle').textContent = counts.puzzle || 0;
        document.getElementById('count-caballo').textContent = counts.caballo || 0;
        document.getElementById('count-perro').textContent = counts.perro || 0;

        // Renderizar Scatter Plot con Chart.js - SIN ETIQUETAS (más limpio)
        const ctx = document.getElementById('bcg-scatter-chart');
        if (ctx) {
            // Destruir chart anterior si existe
            if (window.bcgScatterChart) {
                window.bcgScatterChart.destroy();
            }

            // Calcular promedios para las líneas divisorias
            // 🔒 FIX: Proteger división por cero si no hay datos
            const avgX = data.length > 0
                ? data.reduce((sum, d) => sum + d.popularidad, 0) / data.length
                : 50; // Valor por defecto para centrar el gráfico
            const avgY = data.length > 0
                ? data.reduce((sum, d) => sum + d.margen, 0) / data.length
                : 50;

            // Plugin profesional para cuadrantes
            const quadrantPlugin = {
                id: 'bcgQuadrants',
                beforeDatasetsDraw: function (chart) {
                    const ctx = chart.ctx;
                    const xAxis = chart.scales.x;
                    const yAxis = chart.scales.y;
                    const midX = xAxis.getPixelForValue(avgX * 0.7);
                    const midY = yAxis.getPixelForValue(avgY);

                    // Cuadrantes con gradientes suaves
                    const quadrants = [
                        { x1: midX, y1: yAxis.top, x2: xAxis.right, y2: midY, color: 'rgba(34, 197, 94, 0.08)', label: 'ESTRELLAS', emoji: '⭐', labelColor: '#15803d' },
                        { x1: xAxis.left, y1: yAxis.top, x2: midX, y2: midY, color: 'rgba(59, 130, 246, 0.08)', label: 'PUZZLES', emoji: '❓', labelColor: '#1d4ed8' },
                        { x1: midX, y1: midY, x2: xAxis.right, y2: yAxis.bottom, color: 'rgba(249, 115, 22, 0.08)', label: 'CABALLOS', emoji: '🐴', labelColor: '#c2410c' },
                        { x1: xAxis.left, y1: midY, x2: midX, y2: yAxis.bottom, color: 'rgba(239, 68, 68, 0.08)', label: 'PERROS', emoji: '🐕', labelColor: '#b91c1c' }
                    ];

                    quadrants.forEach(q => {
                        ctx.fillStyle = q.color;
                        ctx.fillRect(q.x1, q.y1, q.x2 - q.x1, q.y2 - q.y1);
                    });

                    // Líneas divisorias elegantes
                    ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([8, 4]);

                    ctx.beginPath();
                    ctx.moveTo(midX, yAxis.top);
                    ctx.lineTo(midX, yAxis.bottom);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(xAxis.left, midY);
                    ctx.lineTo(xAxis.right, midY);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Etiquetas con fondo pill profesional
                    const labels = [
                        { x: (midX + xAxis.right) / 2, y: yAxis.top + 25, text: '⭐ ESTRELLAS', bg: 'rgba(34, 197, 94, 0.15)', color: '#15803d' },
                        { x: (xAxis.left + midX) / 2, y: yAxis.top + 25, text: '❓ PUZZLES', bg: 'rgba(59, 130, 246, 0.15)', color: '#1d4ed8' },
                        { x: (midX + xAxis.right) / 2, y: yAxis.bottom - 15, text: '🐴 CABALLOS', bg: 'rgba(249, 115, 22, 0.15)', color: '#c2410c' },
                        { x: (xAxis.left + midX) / 2, y: yAxis.bottom - 15, text: '🐕 PERROS', bg: 'rgba(239, 68, 68, 0.15)', color: '#b91c1c' }
                    ];

                    labels.forEach(l => {
                        ctx.font = '600 11px system-ui, -apple-system, sans-serif';
                        const textWidth = ctx.measureText(l.text).width;

                        // Fondo pill
                        ctx.fillStyle = l.bg;
                        const padding = 8;
                        const height = 22;
                        const radius = 11;
                        const x = l.x - textWidth / 2 - padding;
                        const y = l.y - height / 2;

                        ctx.beginPath();
                        ctx.roundRect(x, y, textWidth + padding * 2, height, radius);
                        ctx.fill();

                        // Texto
                        ctx.fillStyle = l.color;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(l.text, l.x, l.y);
                    });
                }
            };

            window.bcgScatterChart = new Chart(ctx, {
                type: 'scatter',
                plugins: [quadrantPlugin],
                data: {
                    datasets: [{
                        label: 'Platos',
                        data: scatterData.map(d => ({ x: d.x, y: d.y })),
                        backgroundColor: scatterData.map(d => d.backgroundColor),
                        pointRadius: 12,
                        pointHoverRadius: 16,
                        pointStyle: 'circle',
                        borderWidth: 2.5,
                        borderColor: scatterData.map(d => d.backgroundColor.replace('0.8', '1')),
                        hoverBorderWidth: 3,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: { top: 45, right: 25, bottom: 20, left: 15 },
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#fff',
                            titleFont: { size: 14, weight: '600', family: 'system-ui' },
                            bodyColor: 'rgba(255,255,255,0.9)',
                            bodyFont: { size: 12, family: 'system-ui' },
                            padding: 16,
                            cornerRadius: 12,
                            displayColors: false,
                            boxPadding: 6,
                            callbacks: {
                                title: function (context) {
                                    return scatterData[context[0].dataIndex].nombre;
                                },
                                label: function (context) {
                                    const item = scatterData[context.dataIndex];
                                    const emojis = { estrella: '⭐', puzzle: '❓', caballo: '🐴', perro: '🐕' };
                                    return [
                                        `${emojis[item.clasificacion] || ''} ${item.clasificacion.charAt(0).toUpperCase() + item.clasificacion.slice(1)}`,
                                        `Margen: ${item.y.toFixed(2)}€`,
                                        `Ventas: ${item.x} uds`,
                                    ];
                                },
                            },
                        },
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'POPULARIDAD (Unidades Vendidas)',
                                font: { size: 11, weight: '600', family: 'system-ui' },
                                color: '#64748b',
                                padding: { top: 10 }
                            },
                            grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
                            ticks: { color: '#94a3b8', font: { size: 10 } },
                            beginAtZero: true,
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'RENTABILIDAD (Margen €)',
                                font: { size: 11, weight: '600', family: 'system-ui' },
                                color: '#64748b',
                                padding: { bottom: 10 }
                            },
                            grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
                            ticks: { color: '#94a3b8', font: { size: 10 } },
                        },
                    },
                },
            });
        }

        // Generar recomendaciones inteligentes
        const recsEl = document.getElementById('bcg-recommendations-list');
        if (recsEl) {
            const recs = [];

            // Recomendación si hay perros
            if (counts.perro > 0) {
                const perros = data
                    .filter(d => d.clasificacion === 'perro')
                    .map(d => d.nombre)
                    .slice(0, 3);
                recs.push(
                    `🚨 <strong>Retira o reforma ${counts.perro} plato(s):</strong> ${perros.join(', ')}${counts.perro > 3 ? '...' : ''} - No generan beneficio ni se venden.`
                );
            }

            // Recomendación si hay caballos
            if (counts.caballo > 0) {
                const caballos = data
                    .filter(d => d.clasificacion === 'caballo')
                    .map(d => d.nombre)
                    .slice(0, 2);
                recs.push(
                    `💰 <strong>Sube el precio de:</strong> ${caballos.join(', ')} - Se venden bien pero tu margen es bajo.`
                );
            }

            // Recomendación si hay puzzles
            if (counts.puzzle > 0) {
                const puzzles = data
                    .filter(d => d.clasificacion === 'puzzle')
                    .map(d => d.nombre)
                    .slice(0, 2);
                recs.push(
                    `📢 <strong>Promociona más:</strong> ${puzzles.join(', ')} - Tienen buen margen pero poca visibilidad.`
                );
            }

            // Recomendación positiva si hay estrellas
            if (counts.estrella > 0) {
                recs.push(
                    `✨ <strong>¡Excelente!</strong> Tienes ${counts.estrella} plato(s) estrella. Manténlos destacados en la carta.`
                );
            }

            // Si no hay datos significativos
            if (recs.length === 0) {
                recs.push('📊 Registra más ventas para obtener recomendaciones personalizadas.');
            }

            recsEl.innerHTML = recs
                .map(r => `<div style="margin-bottom: 8px;">${r}</div>`)
                .join('');
        }

        // Poblar listas detalladas CON PAGINACIÓN (10 items por página)
        const ITEMS_PER_PAGE = 10;
        const itemsByCategory = { estrella: [], caballo: [], puzzle: [], perro: [] };

        // Agrupar items por categoría
        data.forEach(item => {
            if (itemsByCategory[item.clasificacion]) {
                itemsByCategory[item.clasificacion].push(item);
            }
        });

        // Estado de paginación global
        window.bcgPagination = window.bcgPagination || { estrella: 1, caballo: 1, puzzle: 1, perro: 1 };

        // Función para renderizar página de una categoría
        window.renderBCGPage = function (categoria, page = 1) {
            const items = itemsByCategory[categoria] || [];
            const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
            page = Math.max(1, Math.min(page, totalPages || 1));
            window.bcgPagination[categoria] = page;

            const container = containers[categoria];
            if (!container) return;

            const start = (page - 1) * ITEMS_PER_PAGE;
            const pageItems = items.slice(start, start + ITEMS_PER_PAGE);

            container.innerHTML = pageItems.map(item =>
                `<div class="bcg-item"><strong>${escapeHTML(item.nombre)}</strong><br><span style="font-size:11px">Mg: ${item.margen.toFixed(2)}€ | Ventas: ${item.popularidad}</span></div>`
            ).join('');

            // Añadir controles de paginación si hay más de una página
            if (totalPages > 1) {
                container.innerHTML += `
                    <div style="display:flex; justify-content:center; gap:8px; margin-top:10px; padding-top:10px; border-top:1px solid #e2e8f0;">
                        <button onclick="window.renderBCGPage('${categoria}', ${page - 1})" ${page <= 1 ? 'disabled' : ''} style="padding:4px 8px; border-radius:4px; border:1px solid #cbd5e1; cursor:pointer; background:${page <= 1 ? '#f1f5f9' : 'white'}">←</button>
                        <span style="padding:4px 8px; font-size:12px;">${page} / ${totalPages}</span>
                        <button onclick="window.renderBCGPage('${categoria}', ${page + 1})" ${page >= totalPages ? 'disabled' : ''} style="padding:4px 8px; border-radius:4px; border:1px solid #cbd5e1; cursor:pointer; background:${page >= totalPages ? '#f1f5f9' : 'white'}">→</button>
                    </div>`;
            }
        };

        // Renderizar primera página de cada categoría
        ['estrella', 'caballo', 'puzzle', 'perro'].forEach(cat => {
            window.renderBCGPage(cat, window.bcgPagination[cat] || 1);
        });
    };

    function renderChartRentabilidad(datos) {
        const ctx = document.getElementById('chart-rentabilidad');
        if (!ctx) return;

        const ordenados = [...datos].sort((a, b) => b.margenPct - a.margenPct).slice(0, 10);

        if (chartRentabilidad) chartRentabilidad.destroy();

        chartRentabilidad = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ordenados.map(r => r.nombre),
                datasets: [
                    {
                        label: 'Margen (%)',
                        data: ordenados.map(r => r.margenPct.toFixed(1)),
                        backgroundColor: ordenados.map(r =>
                            r.margenPct > 50 ? '#10b981' : r.margenPct > 30 ? '#f59e0b' : '#ef4444'
                        ),
                        borderWidth: 0,
                        borderRadius: 8,
                        hoverBackgroundColor: ordenados.map(r =>
                            r.margenPct > 50 ? '#059669' : r.margenPct > 30 ? '#d97706' : '#dc2626'
                        ),
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart',
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        padding: 16,
                        cornerRadius: 12,
                        displayColors: false,
                        borderColor: '#FF6B35',
                        borderWidth: 2,
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        callbacks: {
                            label: function (context) {
                                return 'Margen: ' + context.parsed.y + '%';
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: {
                            callback: function (value) {
                                return value + '%';
                            },
                            font: { size: 12 },
                        },
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 12 } },
                    },
                },
            },
        });
    }

    function renderChartIngredientes() {
        // 🍽️ Gráfica de ALIMENTOS - Coste por Unidad
        const ctxAlimentos = document.getElementById('chart-ingredientes');
        // 🍺 Gráfica de BEBIDAS - Coste por Unidad
        const ctxBebidas = document.getElementById('chart-bebidas');

        if (!ctxAlimentos) return;

        // Calcular coste por unidad = precio / cantidad_por_formato
        const calcularCosteUnidad = (ing) => {
            const cantidad = parseFloat(ing.cantidad_por_formato) || 1;
            return ing.precio / cantidad;
        };

        // Separar ingredientes por familia y ordenar por COSTE POR UNIDAD
        const alimentos = [...ingredientes]
            .filter(ing => ing.precio > 0 && (ing.familia || 'alimento').toLowerCase() === 'alimento')
            .map(ing => ({
                ...ing,
                coste_unidad: calcularCosteUnidad(ing)
            }))
            .sort((a, b) => b.coste_unidad - a.coste_unidad)
            .slice(0, 10);

        const bebidas = [...ingredientes]
            .filter(ing => ing.precio > 0 && (ing.familia || '').toLowerCase() === 'bebida')
            .map(ing => ({
                ...ing,
                coste_unidad: calcularCosteUnidad(ing)
            }))
            .sort((a, b) => b.coste_unidad - a.coste_unidad)
            .slice(0, 10);

        // Colores para las gráficas
        const coloresAlimentos = [
            '#10b981', '#059669', '#34d399', '#6ee7b7',
            '#a7f3d0', '#d1fae5', '#f59e0b', '#fbbf24',
            '#fcd34d', '#fde68a'
        ];

        const coloresBebidas = [
            '#3b82f6', '#2563eb', '#60a5fa', '#93c5fd',
            '#bfdbfe', '#dbeafe', '#8b5cf6', '#a78bfa',
            '#c4b5fd', '#ddd6fe'
        ];

        // Destruir gráficos anteriores
        if (chartIngredientes) chartIngredientes.destroy();
        if (window.chartBebidas) window.chartBebidas.destroy();

        // === GRÁFICA ALIMENTOS (Coste por Unidad) ===
        if (alimentos.length > 0) {
            chartIngredientes = new Chart(ctxAlimentos, {
                type: 'doughnut',
                data: {
                    labels: alimentos.map(i => i.nombre),
                    datasets: [{
                        data: alimentos.map(i => i.coste_unidad),
                        backgroundColor: coloresAlimentos.slice(0, alimentos.length),
                        borderWidth: 3,
                        borderColor: '#fff',
                        hoverOffset: 15,
                        hoverBorderWidth: 4,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: { duration: 1200, easing: 'easeInOutQuart', animateRotate: true, animateScale: true },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { size: 10 } },
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(30, 41, 59, 0.95)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            padding: 16,
                            cornerRadius: 12,
                            displayColors: true,
                            borderColor: '#10b981',
                            borderWidth: 2,
                            callbacks: {
                                label: function (context) {
                                    const ing = alimentos[context.dataIndex];
                                    return `${context.label}: ${context.parsed.toFixed(2)}€/${ing.unidad || 'ud'}`;
                                },
                            },
                        },
                    },
                    cutout: '65%',
                },
            });
        }

        // === GRÁFICA BEBIDAS (Coste por Unidad) ===
        if (ctxBebidas && bebidas.length > 0) {
            window.chartBebidas = new Chart(ctxBebidas, {
                type: 'doughnut',
                data: {
                    labels: bebidas.map(i => i.nombre),
                    datasets: [{
                        data: bebidas.map(i => i.coste_unidad),
                        backgroundColor: coloresBebidas.slice(0, bebidas.length),
                        borderWidth: 3,
                        borderColor: '#fff',
                        hoverOffset: 15,
                        hoverBorderWidth: 4,
                    }],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: { duration: 1200, easing: 'easeInOutQuart', animateRotate: true, animateScale: true },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { size: 10 } },
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(30, 41, 59, 0.95)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            padding: 16,
                            cornerRadius: 12,
                            displayColors: true,
                            borderColor: '#3b82f6',
                            borderWidth: 2,
                            callbacks: {
                                label: function (context) {
                                    const ing = bebidas[context.dataIndex];
                                    return `${context.label}: ${context.parsed.toFixed(2)}€/${ing.unidad || 'ud'}`;
                                },
                            },
                        },
                    },
                    cutout: '65%',
                },
            });
        } else if (ctxBebidas) {
            // Si no hay bebidas, mostrar mensaje
            ctxBebidas.parentElement.innerHTML = '<div style="text-align:center; color:#64748b; padding:40px;">Sin bebidas registradas</div>';
        }
    }

    // 📈 Gráfica: Margen promedio por Categoría de receta
    function renderChartMargenCategoria() {
        const ctx = document.getElementById('chart-margen-categoria');
        if (!ctx) return;

        // Agrupar recetas por categoría REAL y calcular margen promedio
        const margenPorCategoria = {};
        const countPorCategoria = {};

        recetas.forEach(rec => {
            // Usar la categoría REAL de la receta (normalizada a minúsculas)
            const catOriginal = (rec.categoria || 'otros').toLowerCase().trim();
            // Capitalizar primera letra para display
            const familia = catOriginal.charAt(0).toUpperCase() + catOriginal.slice(1);

            const coste = calcularCosteRecetaCompleto(rec);
            const margenPct = rec.precio_venta > 0
                ? ((rec.precio_venta - coste) / rec.precio_venta) * 100
                : 0;

            if (!margenPorCategoria[familia]) {
                margenPorCategoria[familia] = 0;
                countPorCategoria[familia] = 0;
            }
            margenPorCategoria[familia] += margenPct;
            countPorCategoria[familia]++;
        });

        // Preparar datos ordenados por cantidad de recetas (descendente)
        const datos = Object.keys(margenPorCategoria)
            .map(cat => ({
                categoria: cat,
                margen: margenPorCategoria[cat] / countPorCategoria[cat],
                count: countPorCategoria[cat]
            }))
            .sort((a, b) => b.count - a.count);

        // Destruir gráfico anterior si existe
        if (window.chartMargenCategoria) window.chartMargenCategoria.destroy();

        if (datos.length === 0) {
            ctx.parentElement.innerHTML = '<div style="text-align:center; color:#64748b; padding:40px;">Sin recetas</div>';
            return;
        }

        // Colores según margen (verde = alto, amarillo = medio, rojo = bajo)
        const getColor = (margen) => {
            if (margen >= 60) return '#10b981';
            if (margen >= 40) return '#f59e0b';
            return '#ef4444';
        };

        window.chartMargenCategoria = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: datos.map(d => d.categoria + ' (' + d.count + ')'),
                datasets: [{
                    label: 'Margen %',
                    data: datos.map(d => d.margen.toFixed(1)),
                    backgroundColor: datos.map(d => getColor(d.margen)),
                    borderWidth: 0,
                    borderRadius: 6,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: 'y', // Barras horizontales
                animation: { duration: 1000 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        callbacks: {
                            label: function (context) {
                                return 'Margen: ' + context.parsed.x + '%';
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        grid: { display: false },
                        ticks: { callback: v => v + '%' }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                }
            },
        });
    }

    function renderTablaRentabilidad(datos) {
        const ordenados = [...datos].sort((a, b) => b.margenPct - a.margenPct);
        const ITEMS_PER_PAGE = 15;

        // Estado de paginación
        window.rentabilidadPage = window.rentabilidadPage || 1;

        // Función para renderizar página
        window.renderRentabilidadPage = function (page = 1) {
            const totalPages = Math.ceil(ordenados.length / ITEMS_PER_PAGE);
            page = Math.max(1, Math.min(page, totalPages || 1));
            window.rentabilidadPage = page;

            const start = (page - 1) * ITEMS_PER_PAGE;
            const pageItems = ordenados.slice(start, start + ITEMS_PER_PAGE);

            let html = '<table><thead><tr>';
            html += '<th>#</th><th>Plato</th><th>Coste</th><th>Precio</th><th>Margen €</th><th>Margen %</th>';
            html += '</tr></thead><tbody>';

            pageItems.forEach((rec, idx) => {
                const realIdx = start + idx + 1;
                html += '<tr>';
                html += `<td><strong>#${realIdx}</strong></td>`;
                html += `<td>${escapeHTML(rec.nombre)}</td>`;
                html += `<td>${parseFloat(rec.coste || 0).toFixed(2)} €</td>`;
                html += `<td>${parseFloat(rec.precio_venta || 0).toFixed(2)} €</td>`;
                html += `<td>${parseFloat(rec.margen || 0).toFixed(2)} €</td>`;
                html += `<td><span class="badge ${rec.margenPct > 50 ? 'badge-success' : rec.margenPct > 30 ? 'badge-warning' : 'badge-warning'}">${parseFloat(rec.margenPct || 0).toFixed(1)}%</span></td>`;
                html += '</tr>';
            });

            html += '</tbody></table>';

            // Controles de paginación
            if (totalPages > 1) {
                html += `
                    <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px; padding:12px; background:#f8fafc; border-radius:8px;">
                        <button onclick="window.renderRentabilidadPage(1)" ${page <= 1 ? 'disabled' : ''} style="padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; cursor:pointer; background:white;">⏮️</button>
                        <button onclick="window.renderRentabilidadPage(${page - 1})" ${page <= 1 ? 'disabled' : ''} style="padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; cursor:pointer; background:white;">← Anterior</button>
                        <span style="padding:6px 12px; font-weight:600;">Página ${page} de ${totalPages}</span>
                        <button onclick="window.renderRentabilidadPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''} style="padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; cursor:pointer; background:white;">Siguiente →</button>
                        <button onclick="window.renderRentabilidadPage(${totalPages})" ${page >= totalPages ? 'disabled' : ''} style="padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; cursor:pointer; background:white;">⏭️</button>
                    </div>
                    <div style="text-align:center; margin-top:8px; color:#64748b; font-size:12px;">Mostrando ${start + 1}-${Math.min(start + ITEMS_PER_PAGE, ordenados.length)} de ${ordenados.length} recetas</div>`;
            }

            document.getElementById('tabla-rentabilidad').innerHTML = html;
        };

        // Renderizar primera página
        window.renderRentabilidadPage(window.rentabilidadPage);
    }

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

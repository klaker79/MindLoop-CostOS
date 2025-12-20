/**
 * main.js - Punto de entrada de la aplicación
 * Carga todos los módulos necesarios
 */

// Importar utilidades
import { showToast } from './ui/toast.js';
import * as DOM from './utils/dom-helpers.js';

// Importar módulo de ingredientes
import * as IngredientesUI from './modules/ingredientes/ingredientes-ui.js';
import * as IngredientesCRUD from './modules/ingredientes/ingredientes-crud.js';

// Hacer disponibles globalmente para compatibilidad con código existente
window.showToast = showToast;
window.DOM = DOM;

// Exponer funciones DOM individuales en window para compatibilidad
Object.assign(window, DOM);

// Exponer módulo de ingredientes globalmente
window.renderizarIngredientes = IngredientesUI.renderizarIngredientes;
window.mostrarFormularioIngrediente = IngredientesUI.mostrarFormularioIngrediente;
window.cerrarFormularioIngrediente = IngredientesUI.cerrarFormularioIngrediente;
window.exportarIngredientes = IngredientesUI.exportarIngredientes;

window.guardarIngrediente = IngredientesCRUD.guardarIngrediente;
window.editarIngrediente = IngredientesCRUD.editarIngrediente;
window.eliminarIngrediente = IngredientesCRUD.eliminarIngrediente;

// Variable global para tracking de edición
window.editandoIngredienteId = null;

console.log('✅ Módulos cargados correctamente');
console.log('✅ Módulo Ingredientes integrado');

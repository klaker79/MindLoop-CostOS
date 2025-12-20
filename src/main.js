/**
 * main.js - Punto de entrada de la aplicación
 * Carga todos los módulos necesarios
 */

// Importar utilidades
import { showToast } from './ui/toast.js';
import * as DOM from './utils/dom-helpers.js';

// Hacer disponibles globalmente para compatibilidad con código existente
window.showToast = showToast;
window.DOM = DOM;

// También exponer funciones DOM individuales en window para compatibilidad
Object.assign(window, DOM);

console.log('✅ Módulos cargados correctamente');

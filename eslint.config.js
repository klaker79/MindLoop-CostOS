import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';

export default [
    js.configs.recommended,
    prettierConfig,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                location: 'readonly',
                history: 'readonly',
                fetch: 'readonly',
                console: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                prompt: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                FormData: 'readonly',
                FileReader: 'readonly',
                Blob: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                HTMLElement: 'readonly',
                Event: 'readonly',
                CustomEvent: 'readonly',
                MutationObserver: 'readonly',
                IntersectionObserver: 'readonly',
                ResizeObserver: 'readonly',
                AbortController: 'readonly',
                Headers: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                performance: 'readonly',
                // External libraries
                Chart: 'readonly',
                XLSX: 'readonly',
                jsPDF: 'readonly',
                DOMPurify: 'readonly',
                // App globals (legacy code uses these as window globals)
                API_BASE: 'readonly',
                api: 'readonly',
                showToast: 'readonly',
                ingredientes: 'writable',
                recetas: 'writable',
                proveedores: 'writable',
                ventas: 'writable',
                pedidos: 'writable',
                equipo: 'writable',
                renderizarIngredientes: 'readonly',
                renderizarRecetas: 'readonly',
                renderizarVentas: 'readonly',
                renderizarInventario: 'readonly',
                renderizarEquipo: 'readonly',
                renderizarPedidos: 'readonly',
                renderizarProveedores: 'readonly',
                renderizarBeneficioNetoDiario: 'readonly',
                cargarDatosIniciales: 'readonly',
                calcularCosteRecetaCompleto: 'readonly',
                renderMenuEngineeringUI: 'readonly',
                mostrarLogin: 'readonly',
                editandoIngredienteId: 'writable',
                editandoRecetaId: 'writable',
                editandoProveedorId: 'writable',
                recetaProduciendo: 'writable'
            }
        },
        rules: {
            'no-console': ['warn', { allow: ['error', 'warn'] }],
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_|^e$|^err$|^error$|^event$',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            'prefer-const': 'warn',
            'no-var': 'error',
            'eqeqeq': ['error', 'always'],
            'curly': 'off', // Prettier handles this
            'no-eval': 'error',
            'no-implied-eval': 'error'
        }
    },
    // Relaxed rules for legacy files
    {
        files: ['src/legacy/**/*.js'],
        rules: {
            'no-unused-vars': 'off',
            'no-undef': 'off',
            'prefer-const': 'off',
            'no-console': 'off',
            'eqeqeq': 'off'
        }
    },
    // Logger needs all console methods
    {
        files: ['src/utils/logger.js', 'src/utils/performance.js'],
        rules: {
            'no-console': 'off'
        }
    },
    // Ignore patterns
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            '*.min.js',
            'public/**'
        ]
    }
];

import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    // Directorio raíz del proyecto
    root: './',

    // Puerto de desarrollo
    server: {
        port: 3000,
        open: true, // Abre navegador automáticamente
        proxy: {
            // Desarrollo local contra la API de ESTA casa (Lite).
            // 🔒 Antes apuntaba a lacaleta-api (la API de producción de La Nave 5)
            // y encima se disfrazaba con Origin app.mindloop.cloud para pasar el
            // CORS. Es decir: un `npm run dev` en la rama lite escribía en la base
            // de datos del cliente real. Se puede sobrescribir con VITE_DEV_API_TARGET
            // si hace falta apuntar a otro sitio puntualmente.
            '/api': {
                target: process.env.VITE_DEV_API_TARGET || 'https://lite-api.mindloop.cloud',
                changeOrigin: true,
                secure: true,
                headers: {
                    Origin: 'https://lite.mindloop.cloud'
                }
            }
        }
    },

    // Plugins
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: 'src/legacy/*',
                    dest: 'src/legacy'
                },
                {
                    src: 'src/modules/inteligencia/*',
                    dest: 'src/modules/inteligencia'
                }
            ]
        })
    ],

    // Configuración de build
    build: {
        // Directorio de salida
        outDir: 'dist',

        // Vaciar directorio antes de build
        emptyOutDir: true,

        // Opciones de Rollup
        rollupOptions: {
            input: {
                main: './index.html',
                landing: './landing.html',
                register: './register.html',
                verify: './verify.html'
            },
            output: {
                manualChunks: {
                    'vendor-chart': ['chart.js/auto', 'chart.js'],
                    'vendor-pdf': ['jspdf', 'jspdf-autotable'],
                    'vendor-xlsx': ['xlsx-js-style'],
                }
            }
        },

        // Minificación con esbuild (incluido por defecto)
        minify: 'esbuild',

        // Source maps desactivados en producción (prevenir exposición de código fuente)
        sourcemap: false
    },

    // Resolución de módulos
    resolve: {
        alias: {
            '@': '/src',
            '@modules': '/src/modules',
            '@utils': '/src/utils',
            '@config': '/src/config'
        }
    },

    // Excluir node_modules de optimización
    optimizeDeps: {
        exclude: ['jest', 'jest-environment-jsdom']
    }
});

import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    // Directorio raíz del proyecto
    root: './',

    // Puerto de desarrollo
    server: {
        port: 3000,
        open: true // Abre navegador automáticamente
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
            }
        },

        // Minificación con esbuild (incluido por defecto)
        minify: 'esbuild',

        // Source maps: disabled in production to prevent source code exposure
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

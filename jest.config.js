/** @type {import('jest').Config} */
export default {
    // Usar jsdom para simular el navegador
    testEnvironment: 'jsdom',

    // Buscar tests en __tests__ y src
    testMatch: [
        '**/__tests__/**/*.test.js',
        '**/src/**/*.test.js'
    ],

    // Ignorar copias generadas por el build (dist/ contiene una copia de src
    // → sin esto, un `npm run build` local hace fallar `npm test` con
    // "Cannot find module" en la copia. CI no builda antes de testear).
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],

    // Extensiones de módulos
    moduleFileExtensions: ['js'],

    // Alias de módulos
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@stores/(.*)$': '<rootDir>/src/stores/$1'
    },

    // Archivo de setup PRE-env (polyfill import.meta.env)
    setupFiles: ['./__tests__/setup-esm.js'],

    // Archivo de setup global (window mocks, etc.)
    setupFilesAfterEnv: ['./__tests__/setup.js'],

    // Verbose output
    verbose: true,

    // Coverage
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/main.js',
        '!src/legacy/**',
        '!src/vendors.js',
        '!src/config/**'
    ],

    // Threshold de cobertura
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    }
};

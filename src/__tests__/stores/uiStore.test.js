/**
 * uiStore.test.js — P2
 * Tests for toasts (lifecycle, auto-remove), modals, tabs, theme, sidebar
 * Special: No apiClient dep. Uses jest.useFakeTimers() for toast auto-remove.
 */
import { jest } from '@jest/globals';
import { uiStore } from '../../stores/uiStore.js';

beforeEach(() => {
    uiStore.setState({
        activeTab: 'ingredientes',
        isSidebarOpen: true,
        isLoading: false,
        loadingMessage: '',
        activeModal: null,
        modalData: null,
        toasts: [],
        theme: 'light'
    });
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

// ═══════════════════════════════════════════════
// showToast
// ═══════════════════════════════════════════════
describe('showToast', () => {
    test('adds toast with message, type, duration, id', () => {
        uiStore.getState().showToast('Hello', 'success', 3000);
        const toasts = uiStore.getState().toasts;
        expect(toasts).toHaveLength(1);
        expect(toasts[0].message).toBe('Hello');
        expect(toasts[0].type).toBe('success');
        expect(toasts[0].duration).toBe(3000);
        expect(toasts[0].id).toBeDefined();
    });

    test('returns the toast id', () => {
        const id = uiStore.getState().showToast('Test');
        expect(typeof id).toBe('number');
    });

    test('auto-removes after duration', () => {
        uiStore.getState().showToast('Temp', 'info', 3000);
        expect(uiStore.getState().toasts).toHaveLength(1);
        jest.advanceTimersByTime(3001);
        expect(uiStore.getState().toasts).toHaveLength(0);
    });

    test('duration=0 → toast persists (no auto-remove)', () => {
        uiStore.getState().showToast('Sticky', 'info', 0);
        jest.advanceTimersByTime(10000);
        expect(uiStore.getState().toasts).toHaveLength(1);
    });

    test('multiple toasts accumulate', () => {
        uiStore.getState().showToast('A');
        jest.advanceTimersByTime(1); // Advance 1ms so Date.now() differs
        uiStore.getState().showToast('B');
        expect(uiStore.getState().toasts).toHaveLength(2);
    });
});

// ═══════════════════════════════════════════════
// showSuccess/showError/showWarning/showInfo
// ═══════════════════════════════════════════════
describe('showSuccess/showError/showWarning/showInfo', () => {
    test('showSuccess → type=success', () => {
        uiStore.getState().showSuccess('OK');
        expect(uiStore.getState().toasts[0].type).toBe('success');
    });

    test('showError → type=error, duration=5000', () => {
        uiStore.getState().showError('Bad');
        expect(uiStore.getState().toasts[0].type).toBe('error');
        expect(uiStore.getState().toasts[0].duration).toBe(5000);
    });

    test('showWarning → type=warning, duration=4000', () => {
        uiStore.getState().showWarning('Careful');
        expect(uiStore.getState().toasts[0].type).toBe('warning');
        expect(uiStore.getState().toasts[0].duration).toBe(4000);
    });
});

// ═══════════════════════════════════════════════
// removeToast
// ═══════════════════════════════════════════════
describe('removeToast', () => {
    test('removes specific toast by id', () => {
        const id1 = uiStore.getState().showToast('A', 'info', 0);
        jest.advanceTimersByTime(1);
        const id2 = uiStore.getState().showToast('B', 'info', 0);
        uiStore.getState().removeToast(id1);
        const toasts = uiStore.getState().toasts;
        expect(toasts).toHaveLength(1);
        expect(toasts[0].message).toBe('B');
    });

    test('invalid id → no crash, other toasts unchanged', () => {
        uiStore.getState().showToast('Keep', 'info', 0);
        uiStore.getState().removeToast(99999);
        expect(uiStore.getState().toasts).toHaveLength(1);
    });
});

// ═══════════════════════════════════════════════
// clearToasts
// ═══════════════════════════════════════════════
describe('clearToasts', () => {
    test('empties toasts array', () => {
        uiStore.getState().showToast('A', 'info', 0);
        uiStore.getState().showToast('B', 'info', 0);
        uiStore.getState().clearToasts();
        expect(uiStore.getState().toasts).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════
// modals
// ═══════════════════════════════════════════════
describe('modals', () => {
    test('openModal sets activeModal and modalData', () => {
        uiStore.getState().openModal('edit-recipe', { id: 1 });
        expect(uiStore.getState().activeModal).toBe('edit-recipe');
        expect(uiStore.getState().modalData).toEqual({ id: 1 });
    });

    test('closeModal clears activeModal and modalData', () => {
        uiStore.getState().openModal('test', {});
        uiStore.getState().closeModal();
        expect(uiStore.getState().activeModal).toBeNull();
        expect(uiStore.getState().modalData).toBeNull();
    });

    test('isModalOpen returns correct status', () => {
        uiStore.getState().openModal('test');
        expect(uiStore.getState().isModalOpen('test')).toBe(true);
        expect(uiStore.getState().isModalOpen('other')).toBe(false);
    });
});

// ═══════════════════════════════════════════════
// tabs
// ═══════════════════════════════════════════════
describe('tabs', () => {
    test('setActiveTab changes tab', () => {
        uiStore.getState().setActiveTab('recetas');
        expect(uiStore.getState().activeTab).toBe('recetas');
    });

    test('setActiveTab syncs window.tabActual', () => {
        uiStore.getState().setActiveTab('pedidos');
        expect(window.tabActual).toBe('pedidos');
    });
});

// ═══════════════════════════════════════════════
// sidebar
// ═══════════════════════════════════════════════
describe('sidebar', () => {
    test('toggleSidebar flips state', () => {
        const initial = uiStore.getState().isSidebarOpen;
        uiStore.getState().toggleSidebar();
        expect(uiStore.getState().isSidebarOpen).toBe(!initial);
    });

    test('openSidebar/closeSidebar explicit set', () => {
        uiStore.getState().closeSidebar();
        expect(uiStore.getState().isSidebarOpen).toBe(false);
        uiStore.getState().openSidebar();
        expect(uiStore.getState().isSidebarOpen).toBe(true);
    });
});

// ═══════════════════════════════════════════════
// theme
// ═══════════════════════════════════════════════
describe('theme', () => {
    test('setTheme updates state and localStorage', () => {
        uiStore.getState().setTheme('dark');
        expect(uiStore.getState().theme).toBe('dark');
        expect(localStorage.getItem('theme')).toBe('dark');
    });

    test('toggleTheme: light → dark', () => {
        uiStore.getState().setTheme('light');
        uiStore.getState().toggleTheme();
        expect(uiStore.getState().theme).toBe('dark');
    });

    test('toggleTheme: dark → light', () => {
        uiStore.getState().setTheme('dark');
        uiStore.getState().toggleTheme();
        expect(uiStore.getState().theme).toBe('light');
    });
});

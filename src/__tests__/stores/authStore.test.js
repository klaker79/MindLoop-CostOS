/**
 * authStore.test.js — P1
 * Tests for setToken, login, logout, checkAuth
 * Special: Uses global.fetch mock (NOT apiClient)
 */
import { jest } from '@jest/globals';

let authStore;

beforeAll(async () => {
    const mod = await import('../../stores/authStore.js');
    authStore = mod.authStore;
});

beforeEach(() => {
    // Reset store state
    authStore.setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
    });
    // Reset fetch mock
    global.fetch = jest.fn();
    // Clear storage
    sessionStorage.clear();
    localStorage.clear();
    jest.clearAllMocks();
});

// ═══════════════════════════════════════════════
// setToken
// ═══════════════════════════════════════════════
describe('setToken', () => {
    test('sets token in state, sessionStorage, and window', () => {
        authStore.getState().setToken('abc123');
        expect(authStore.getState().token).toBe('abc123');
        expect(sessionStorage.getItem('_at')).toBe('abc123');
        expect(window.authToken).toBe('abc123');
    });

    test('null token → clears sessionStorage and window', () => {
        authStore.getState().setToken('temp');
        authStore.getState().setToken(null);
        expect(authStore.getState().token).toBeNull();
        expect(sessionStorage.getItem('_at')).toBeNull();
        expect(window.authToken).toBeNull();
    });

    test('removes legacy localStorage token', () => {
        localStorage.setItem('token', 'old-token');
        authStore.getState().setToken('new');
        expect(localStorage.getItem('token')).toBeNull();
    });
});

// ═══════════════════════════════════════════════
// setUser
// ═══════════════════════════════════════════════
describe('setUser', () => {
    test('sets user → isAuthenticated=true, window synced', () => {
        authStore.getState().setUser({ id: 1, name: 'Iker' });
        expect(authStore.getState().isAuthenticated).toBe(true);
        expect(window.currentUser).toEqual({ id: 1, name: 'Iker' });
    });

    test('null user → isAuthenticated=false', () => {
        authStore.getState().setUser({ id: 1 });
        authStore.getState().setUser(null);
        expect(authStore.getState().isAuthenticated).toBe(false);
    });
});

// ═══════════════════════════════════════════════
// login
// ═══════════════════════════════════════════════
describe('login', () => {
    test('success → isAuthenticated, token stored', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ user: { id: 1 }, token: 'jwt123' })
        });
        const result = await authStore.getState().login('test@test.com', 'pass');
        expect(result.success).toBe(true);
        expect(authStore.getState().isAuthenticated).toBe(true);
        expect(authStore.getState().token).toBe('jwt123');
    });

    test('failure → error stored, not authenticated', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            json: () => Promise.resolve({ error: 'Invalid credentials' })
        });
        const result = await authStore.getState().login('bad@test.com', 'wrong');
        expect(result.success).toBe(false);
        expect(authStore.getState().isAuthenticated).toBe(false);
        expect(authStore.getState().error).toBe('Invalid credentials');
    });

    test('network error → error stored', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network'));
        const result = await authStore.getState().login('x@x.com', 'x');
        expect(result.success).toBe(false);
        expect(authStore.getState().error).toBe('Network');
    });
});

// ═══════════════════════════════════════════════
// logout
// ═══════════════════════════════════════════════
describe('logout', () => {
    test('clears all state and window refs', async () => {
        authStore.getState().setUser({ id: 1 });
        authStore.getState().setToken('tok');
        global.fetch = jest.fn().mockResolvedValue({ ok: true });
        await authStore.getState().logout();
        expect(authStore.getState().isAuthenticated).toBe(false);
        expect(authStore.getState().token).toBeNull();
        expect(window.currentUser).toBeNull();
    });

    test('proceeds even if logout API fails', async () => {
        authStore.getState().setUser({ id: 1 });
        global.fetch = jest.fn().mockRejectedValue(new Error('Network'));
        await authStore.getState().logout();
        expect(authStore.getState().isAuthenticated).toBe(false);
    });
});

// ═══════════════════════════════════════════════
// checkAuth
// ═══════════════════════════════════════════════
describe('checkAuth', () => {
    test('success → user set, returns true', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ user: { id: 1 } })
        });
        const result = await authStore.getState().checkAuth();
        expect(result).toBe(true);
        expect(authStore.getState().isAuthenticated).toBe(true);
    });

    test('not authenticated → logout called, returns false', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false });
        const result = await authStore.getState().checkAuth();
        expect(result).toBe(false);
        expect(authStore.getState().isAuthenticated).toBe(false);
    });

    test('network error → logout called, returns false', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Offline'));
        const result = await authStore.getState().checkAuth();
        expect(result).toBe(false);
    });
});

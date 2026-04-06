import { writable } from 'svelte/store';
import { getAuthSession, login as loginRequest, logout as logoutRequest } from '$lib/api.js';

function createAuthStore() {
  const { subscribe, set, update } = writable({
    ready: false,
    authenticated: false,
    username: null,
    is_admin: false,
    busy: false,
    error: ''
  });

  return {
    subscribe,
    async refresh() {
      update((state) => ({ ...state, busy: true, error: '' }));
      try {
        const session = await getAuthSession();
        set({
          ready: true,
          authenticated: session.authenticated,
          username: session.username ?? null,
          is_admin: session.is_admin ?? false,
          busy: false,
          error: ''
        });
      } catch (error) {
        set({
          ready: true,
          authenticated: false,
          username: null,
          is_admin: false,
          busy: false,
          error: error?.message || 'Unable to verify the current session.'
        });
      }
    },
    async login(username, password) {
      update((state) => ({ ...state, busy: true, error: '' }));
      try {
        const session = await loginRequest(username, password);
        set({
          ready: true,
          authenticated: session.authenticated,
          username: session.username,
          is_admin: session.is_admin,
          busy: false,
          error: ''
        });
        return true;
      } catch (error) {
        set({
          ready: true,
          authenticated: false,
          username: null,
          is_admin: false,
          busy: false,
          error: 'Incorrect username or password.'
        });
        return false;
      }
    },
    async logout() {
      update((state) => ({ ...state, busy: true, error: '' }));
      try {
        await logoutRequest();
      } finally {
        set({
          ready: true,
          authenticated: false,
          username: null,
          is_admin: false,
          busy: false,
          error: ''
        });
      }
    }
  };
}

export const auth = createAuthStore();

import { w as writable } from "./index.js";
import { m as logout, n as login, o as getAuthSession } from "./api.js";
const SESSION_CHECK_TIMEOUT_MS = 8e3;
function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}
function createAuthStore() {
  const { subscribe, set, update } = writable({
    ready: false,
    authenticated: false,
    username: null,
    is_admin: false,
    cookie_secure: false,
    client_ip_v4: null,
    client_ip_v6: null,
    client_ip: null,
    device_ip_v4: null,
    device_ip_v6: null,
    device_ip: null,
    busy: false,
    error: ""
  });
  return {
    subscribe,
    async refresh() {
      update((state) => ({ ...state, busy: true, error: "" }));
      try {
        const session = await withTimeout(
          getAuthSession(),
          SESSION_CHECK_TIMEOUT_MS,
          "Session check timed out. Please try signing in again."
        );
        set({
          ready: true,
          authenticated: session.authenticated,
          username: session.username ?? null,
          is_admin: session.is_admin ?? false,
          cookie_secure: session.cookie_secure ?? false,
          client_ip_v4: session.client_ip_v4 ?? null,
          client_ip_v6: session.client_ip_v6 ?? null,
          client_ip: session.client_ip ?? null,
          device_ip_v4: session.device_ip_v4 ?? null,
          device_ip_v6: session.device_ip_v6 ?? null,
          device_ip: session.device_ip ?? null,
          busy: false,
          error: ""
        });
      } catch (error) {
        set({
          ready: true,
          authenticated: false,
          username: null,
          is_admin: false,
          cookie_secure: false,
          client_ip_v4: null,
          client_ip_v6: null,
          client_ip: null,
          device_ip_v4: null,
          device_ip_v6: null,
          device_ip: null,
          busy: false,
          error: error?.message || "Unable to verify the current session."
        });
      }
    },
    async login(username, password) {
      update((state) => ({ ...state, busy: true, error: "" }));
      try {
        const session = await login(username, password);
        set({
          ready: true,
          authenticated: session.authenticated,
          username: session.username,
          is_admin: session.is_admin,
          cookie_secure: session.cookie_secure ?? false,
          client_ip_v4: session.client_ip_v4 ?? null,
          client_ip_v6: session.client_ip_v6 ?? null,
          client_ip: session.client_ip ?? null,
          device_ip_v4: session.device_ip_v4 ?? null,
          device_ip_v6: session.device_ip_v6 ?? null,
          device_ip: session.device_ip ?? null,
          busy: false,
          error: ""
        });
        return true;
      } catch (error) {
        set({
          ready: true,
          authenticated: false,
          username: null,
          is_admin: false,
          cookie_secure: false,
          client_ip_v4: null,
          client_ip_v6: null,
          client_ip: null,
          device_ip_v4: null,
          device_ip_v6: null,
          device_ip: null,
          busy: false,
          error: "Incorrect username or password."
        });
        return false;
      }
    },
    async logout() {
      update((state) => ({ ...state, busy: true, error: "" }));
      let logoutError = "";
      try {
        await logout();
      } catch (error) {
        logoutError = error?.message || "Unable to end the server session.";
      } finally {
        set({
          ready: true,
          authenticated: false,
          username: null,
          is_admin: false,
          cookie_secure: false,
          client_ip_v4: null,
          client_ip_v6: null,
          client_ip: null,
          device_ip_v4: null,
          device_ip_v6: null,
          device_ip: null,
          busy: false,
          error: logoutError ? `Local session cleared, but server logout failed: ${logoutError}` : ""
        });
      }
      return !logoutError;
    }
  };
}
const auth = createAuthStore();
export {
  auth as a
};

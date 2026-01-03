import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Token validation
const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const payload = JSON.parse(atob(parts[1]));
    
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    }

    return false;
  } catch (error) {
    return true;
  }
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      login: (userData, token) => {
        localStorage.setItem('token', token);
        set({
          user: userData,
          token,
          isAuthenticated: true,
        });
      },
      
      logout: () => {
        localStorage.removeItem('token');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },
      
      updateUser: (userData) => set({ user: userData }),
      
      // Validate token on app load
      validateToken: () => {
        const state = get();
        const token = state.token || localStorage.getItem('token');
        
        if (!token || isTokenExpired(token)) {
          // Token expired or invalid - logout
          get().logout();
          return false;
        }
        
        return true;
      },
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        // Validate token on rehydration (app reload)
        if (state) {
          state.validateToken();
        }
      },
    }
  )
);
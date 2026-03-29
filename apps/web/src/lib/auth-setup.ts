import { api } from './api';
import { useAuth } from '@/hooks/useAuth';

// Initialize auth error handler
// This connects the API client's unauthorized handler to the auth store
export const initializeAuthHandler = () => {
  api.setUnauthorizedHandler(() => {
    // Clear auth state when session expires
    useAuth.getState().clearAuth();

    // Redirect to login if not already there
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  });
};

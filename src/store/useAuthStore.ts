import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthService, type AuthUser } from "@/api/services/auth.service";

interface AuthState {
  token: string | null;
  name: string | null;
  avatar: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<boolean>;
  loginWithCode: (code: string) => Promise<void>;
  logout: () => void;
}

const userState = (user: AuthUser) => ({
  userId: user.userId,
  name: user.name,
  avatar: user.avatar ?? null,
  isAuthenticated: true,
});

const loggedOutState = {
  token: null,
  name: null,
  avatar: null,
  userId: null,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...loggedOutState,
      isLoading: false,

      checkAuth: async () => {
        if (!get().token || get().isLoading) return false;

        set({ isLoading: true });
        try {
          const user = await AuthService.getUserInfo();
          set({ ...userState(user), ...(user.token ? { token: user.token } : {}) });
          return true;
        } catch {
          set(loggedOutState);
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      loginWithCode: async (code) => {
        if (get().isLoading) return;

        set({ isLoading: true });
        try {
          const { token } = await AuthService.loginWithCode(code);
          set({ token });
          const user = await AuthService.getUserInfo();
          set(userState(user));
        } catch (error) {
          set(loggedOutState);
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => set(loggedOutState),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ token: state.token, name: state.name }),
    },
  ),
);

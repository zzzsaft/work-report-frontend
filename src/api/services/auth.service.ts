import { authClient } from "../http/authClient";

export interface AuthUser {
  userId: string;
  name: string;
  avatar?: string;
  token?: string;
}

export const AuthService = {
  async loginWithCode(code: string): Promise<{ token: string }> {
    return (
      await authClient.post("/auth/wecom/token", {
        clientId: "new-frontend",
        code,
      })
    ).data;
  },

  async getUserInfo(): Promise<AuthUser> {
    return (await authClient.get("/auth/me")).data;
  },
};

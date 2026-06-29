import { authClient } from "../http/authClient";
import { accountClient } from "../http/accountClient";

export interface AuthUser {
  userId: string;
  wecomUserId?: string | null;
  corpId?: string | null;
  clientId?: string;
  scopes?: string[];
  name: string;
  avatar: string | null;
  roles?: AccountRole[];
  capabilities?: {
    roles: AccountRole[];
    canViewAdmin: boolean;
    canAssignWorkers: boolean;
    canReviewExceptions: boolean;
    canImportOperations: boolean;
    canViewTeamOperations: boolean;
    canForceRemoveAssignments: boolean;
    canViewAllTeams: boolean;
  };
  token?: string;
}

export type AccountRole = "worker" | "leader" | "admin";

export interface AdminAccount {
  id: string;
  username: string;
  name: string;
  roles: AccountRole[];
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface CreateAdminAccountInput {
  username: string;
  name: string;
  password: string;
  roles: AccountRole[];
  enabled: boolean;
}

export interface UpdateAdminAccountInput {
  name?: string;
  roles?: AccountRole[];
  enabled?: boolean;
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

  async loginWithPassword(
    username: string,
    password: string,
  ): Promise<{ token: string }> {
    return (
      await authClient.post("/auth/password/token", {
        clientId: "new-frontend",
        username,
        password,
      })
    ).data;
  },

  async getUserInfo(): Promise<AuthUser> {
    return (await authClient.get("/auth/me")).data;
  },

  async getAdminAccounts(keyword: string): Promise<AdminAccount[]> {
    const { data } = await accountClient.get<
      AdminAccount[] | { items: AdminAccount[] }
    >("/auth/admin/accounts", { params: { keyword } });
    return Array.isArray(data) ? data : data.items;
  },

  async createAdminAccount(
    input: CreateAdminAccountInput,
  ): Promise<AdminAccount> {
    return (await accountClient.post("/auth/admin/accounts", input)).data;
  },

  async updateAdminAccount(
    id: string,
    input: UpdateAdminAccountInput,
  ): Promise<AdminAccount> {
    return (await accountClient.patch(`/auth/admin/accounts/${id}`, input))
      .data;
  },

  async resetAdminAccountPassword(id: string, password: string): Promise<void> {
    await accountClient.post(`/auth/admin/accounts/${id}/reset-password`, {
      password,
    });
  },
};

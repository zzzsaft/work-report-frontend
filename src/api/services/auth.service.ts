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

export interface WeComJoinQrCodeResult {
  joinQrcode?: string;
  join_qrcode?: string;
  expiresInDays?: number;
  sizeType?: number;
}

export interface WeComUser {
  userid: string;
  name: string;
  alias?: string;
  mobile?: string;
  department?: number[] | string[];
  order?: number[] | string[];
  position?: string;
  gender?: string;
  email?: string;
  telephone?: string;
  enable?: number;
}

export interface CreateWeComUserInput {
  userid: string;
  name: string;
  alias?: string;
  mobile?: string;
  department?: number[];
  order?: number[];
  position?: string;
  gender?: string;
  email?: string;
  telephone?: string;
  enable?: number;
}

export type UpdateWeComUserInput = Partial<CreateWeComUserInput>;

export interface WeComDepartment {
  id: number;
  parentid?: number;
  order?: number;
  name?: string;
  name_en?: string;
}

export interface WeComDepartmentInput {
  name: string;
  parentid?: number;
  order?: number;
  name_en?: string;
}

export const AuthService = {
  async loginWithCode(code: string): Promise<{ token: string }> {
    return (
      await authClient.post("/auth/wecom/token", {
        clientId: "work-report",
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
        clientId: "work-report",
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

  async getWeComJoinQrCode(sizeType?: number): Promise<WeComJoinQrCodeResult> {
    return (
      await authClient.get("/auth/admin/wecom/join-qrcode", {
        params: { sizeType },
      })
    ).data;
  },

  async getWeComUsers(keyword?: string): Promise<WeComUser[]> {
    const { data } = await authClient.get<WeComUser[] | { items: WeComUser[] }>(
      "/auth/admin/wecom/users",
      { params: { keyword } },
    );
    return Array.isArray(data) ? data : data.items;
  },

  async createWeComUser(user: CreateWeComUserInput): Promise<unknown> {
    return (await authClient.post("/auth/admin/wecom/users", { user })).data;
  },

  async updateWeComUser(
    userid: string,
    user: UpdateWeComUserInput,
  ): Promise<unknown> {
    return (
      await authClient.patch(`/auth/admin/wecom/users/${encodeURIComponent(userid)}`, {
        user,
      })
    ).data;
  },

  async deleteWeComUsers(useridlist: string[]): Promise<unknown> {
    return (
      await authClient.post("/auth/admin/wecom/users/batch-delete", {
        useridlist,
      })
    ).data;
  },

  async getWeComDepartments(
    parentId?: number,
  ): Promise<WeComDepartment[]> {
    const { data } = await authClient.get(
      "/auth/admin/wecom/departments/simplelist",
      { params: { id: parentId } },
    );
    return (data.departmentId || data.department_id || []) as WeComDepartment[];
  },

  async syncWeComDepartments(
    parentId?: number,
  ): Promise<WeComDepartment[]> {
    const { data } = await authClient.get(
      "/auth/admin/wecom/departments/simplelist",
      { params: { id: parentId } },
    );
    return (data.departmentId || data.department_id || []) as WeComDepartment[];
  },

  async syncWeComUserDepartments(): Promise<unknown> {
    return (await authClient.post("/auth/admin/wecom/user-departments/sync", {
      clientId: "work-report",
      limit: 10000,
    })).data;
  },

  async createWeComDepartment(
    department: WeComDepartmentInput,
  ): Promise<unknown> {
    return (
      await authClient.post("/auth/admin/wecom/departments", {
        department,
      })
    ).data;
  },

  async updateWeComDepartment(
    id: number,
    department: WeComDepartmentInput,
  ): Promise<unknown> {
    return (
      await authClient.patch(`/auth/admin/wecom/departments/${id}`, {
        department,
      })
    ).data;
  },

  async deleteWeComDepartment(id: number): Promise<unknown> {
    return await authClient.delete(`/auth/admin/wecom/departments/${id}`);
  },
};

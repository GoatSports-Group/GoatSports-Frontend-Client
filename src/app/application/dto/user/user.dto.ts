export type User = {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  status: string;
  gender?: string;
  phone?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
  role: {
    roleId: string;
    name: string;
  };
  keycloakId?: string;
  authProvider?: string;
  hasPassword?: boolean;
};

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface CreatePasswordRequest {
  newPassword: string;
  confirmPassword: string;
}

export { RoleEnum, ROLE_ENUM_OPTIONS } from '@domain/enums/role.enum';

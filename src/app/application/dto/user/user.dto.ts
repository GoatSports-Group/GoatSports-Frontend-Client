export type User = {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  role: {
    roleId: string;
    name: string;
  };
  keycloakId?: string;
  authProvider?: string;
}

export { RoleEnum } from '@domain/enums/role.enum';

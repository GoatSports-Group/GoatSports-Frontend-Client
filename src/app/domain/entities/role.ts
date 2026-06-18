import { Permission } from './permission';

export interface Role {
  roleId: string;
  name: string;
  description?: string;
  active: boolean;
  permissions?: Permission[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleCreateRequest {
  name: string;
  description?: string;
}

export interface RoleUpdateRequest {
  roleId: string;
  name: string;
  description?: string;
  active: boolean;
  permissionIds: string[];
}

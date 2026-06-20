import { Permission } from '@domain/entity/permission';

export interface Role {
  roleId: string;
  name: string;
  description?: string;
  active: boolean;
  permissions?: Permission[];
  createdAt?: string;
  updatedAt?: string;
}

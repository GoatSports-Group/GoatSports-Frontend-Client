export enum RoleEnum {
  ADMIN = 'ADMIN',
  PLAYER = 'PLAYER',
  VENUE_OWNER = 'VENUE_OWNER',
}

export const ROLE_ENUM_OPTIONS = [
  {
    value: RoleEnum.ADMIN,
    label: 'Người quản trị',
  },
  {
    value: RoleEnum.PLAYER,
    label: 'Tuyển thủ',
  },
  {
    value: RoleEnum.VENUE_OWNER,
    label: 'Chủ sân',
  },
];

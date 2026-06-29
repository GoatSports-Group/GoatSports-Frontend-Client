export enum VenueStatus {
  AVAILABLE = 'AVAILABLE',
  FULL = 'FULL',
}

export const VENUE_STATUS_OPTIONS = [
  {
    value: VenueStatus.AVAILABLE,
    label: 'Còn trống',
  },
  {
    value: VenueStatus.FULL,
    label: 'Hết lịch',
  },
];

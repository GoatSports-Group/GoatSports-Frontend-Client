export const VENUE_PLACEHOLDER_IMAGE = 'assets/images/venue-placeholder.svg';

export function isAbsoluteVenueImageUrl(value?: string | null): boolean {
  return /^(https?:|data:|blob:)/i.test(value?.trim() ?? '');
}

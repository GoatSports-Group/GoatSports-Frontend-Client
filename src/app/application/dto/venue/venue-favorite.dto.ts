export interface SavedVenue {
  venueId: string;
  savedAt: string | null;
}

export interface VenueFavoriteStatus {
  venueId: string;
  followed: boolean;
}

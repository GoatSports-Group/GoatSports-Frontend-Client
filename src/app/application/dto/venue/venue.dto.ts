export { SportType, SPORT_TYPE_OPTIONS } from '@domain/enums/sport-type.enum';
export {
  Venue,
  VenueCourt,
  VenueFacilityLayout,
  VenueFacilityLayoutItem,
  VenueFacilityLayoutZone
} from '@domain/entities/venue';

export interface VenueSearchFilter {
  keyword?: string;
  sportType?: string;
  district?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  northLatitude?: number;
  southLatitude?: number;
  eastLongitude?: number;
  westLongitude?: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  /** Chi lay cac san nay (toi da 50), vd. trang San da luu. */
  ids?: string[];
  page?: number;
  size?: number;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  title: string;
  address: string;
}

/** Sân ngoài thực tế (OpenStreetMap) chưa tham gia GOAT Sports: tìm, chỉ đường, rủ nhau chơi; không đặt online. */
export interface ExternalVenue {
  externalVenueId: string;
  name: string;
  sportTypes: string[];
  latitude: number;
  longitude: number;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  openingHours?: string | null;
  source: string;
}

/** Bao nhiêu người chơi muốn đặt sân ngoài này online; `wanted` false khi chưa đăng nhập. */
export interface ExternalVenueDemand {
  wantCount: number;
  wanted: boolean;
}

/** Người chơi gợi ý một sân còn thiếu trên bản đồ; admin duyệt rồi sân mới hiện. */
export interface ExternalVenueSuggestionRequest {
  name: string;
  sportTypes: string[];
  latitude: number;
  longitude: number;
  address?: string | null;
  phone?: string | null;
  note?: string | null;
}

export interface ExternalVenueQuery {
  south: number;
  west: number;
  north: number;
  east: number;
  sportType?: string;
  keyword?: string;
}

/**
 * Plus Code (Open Location Code) mà Google Maps hiện cho nơi không có số nhà, vd "65R8+V65, Nam Nha Trang".
 * Nominatim không hiểu dạng này nên client tự giải mã. Mã đầy đủ (8 ký tự trước "+") giải thẳng ra toạ độ; mã rút gọn
 * ("65R8+V65") cần một điểm tham chiếu gần đó (toạ độ của phần địa danh phía sau) để khôi phục phần đầu bị lược.
 * Thuật toán theo đặc tả Open Location Code: https://github.com/google/open-location-code
 */
const ALPHABET = '23456789CFGHJMPQRVWX';
const SEPARATOR_POSITION = 8;
const PAIR_RESOLUTIONS = [20, 1, 0.05, 0.0025, 0.000125];
const GRID_ROWS = 5;
const GRID_COLUMNS = 4;

export interface PlusCodeMatch {
  /** Mã đã chuẩn hoá (chữ hoa), vd "65R8+V65". */
  code: string;
  /** Phần còn lại sau mã, dùng để tìm điểm tham chiếu, vd "Nam Nha Trang, Khánh Hòa". */
  locality: string;
  /** Mã đủ 8 ký tự trước "+": không cần điểm tham chiếu. */
  full: boolean;
}

/** Nhận Plus Code ở đầu chuỗi địa chỉ; không phải Plus Code thì trả null. */
export function parsePlusCode(text: string): PlusCodeMatch | null {
  const match = /^\s*([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,7})(?=$|[\s,])[\s,]*(.*)$/i.exec(text);
  if (!match) return null;
  const code = match[1].toUpperCase();
  const prefixLength = code.indexOf('+');
  if (prefixLength % 2 !== 0) return null;
  return { code, locality: match[2].trim(), full: prefixLength === SEPARATOR_POSITION };
}

/** Tâm ô của mã đầy đủ. */
export function decodePlusCode(code: string): { latitude: number; longitude: number } {
  const digits = code.toUpperCase().replace('+', '');
  let latitude = -90;
  let longitude = -180;
  let latResolution = PAIR_RESOLUTIONS[0];
  let lngResolution = PAIR_RESOLUTIONS[0];
  for (let i = 0; i < Math.min(digits.length, 10); i += 2) {
    latResolution = lngResolution = PAIR_RESOLUTIONS[i / 2];
    latitude += ALPHABET.indexOf(digits[i]) * latResolution;
    longitude += ALPHABET.indexOf(digits[i + 1] ?? '2') * lngResolution;
  }
  for (const digit of digits.slice(10)) {
    const value = ALPHABET.indexOf(digit);
    latResolution /= GRID_ROWS;
    lngResolution /= GRID_COLUMNS;
    latitude += Math.floor(value / GRID_COLUMNS) * latResolution;
    longitude += (value % GRID_COLUMNS) * lngResolution;
  }
  return { latitude: latitude + latResolution / 2, longitude: longitude + lngResolution / 2 };
}

/** Khôi phục mã rút gọn về ô gần điểm tham chiếu nhất rồi trả tâm ô. */
export function recoverPlusCode(shortCode: string, refLatitude: number, refLongitude: number):
  { latitude: number; longitude: number } {
  const code = shortCode.toUpperCase();
  const padding = SEPARATOR_POSITION - code.indexOf('+');
  const resolution = Math.pow(20, 2 - padding / 2);
  const half = resolution / 2;
  const area = decodePlusCode(encodePrefix(refLatitude, refLongitude, padding) + code);
  let { latitude, longitude } = area;
  if (refLatitude + half < latitude && latitude - resolution >= -90) latitude -= resolution;
  else if (refLatitude - half > latitude && latitude + resolution <= 90) latitude += resolution;
  if (refLongitude + half < longitude) longitude -= resolution;
  else if (refLongitude - half > longitude) longitude += resolution;
  return { latitude, longitude };
}

/** `length` ký tự đầu của mã ứng với một toạ độ (chỉ cần cho phần bị lược của mã rút gọn). */
function encodePrefix(latitude: number, longitude: number, length: number): string {
  let lat = Math.min(Math.max(latitude, -90), 90 - 1e-10) + 90;
  let lng = ((longitude + 180) % 360 + 360) % 360;
  let prefix = '';
  for (let i = 0; i < length / 2; i++) {
    const resolution = PAIR_RESOLUTIONS[i];
    const latDigit = Math.floor(lat / resolution);
    const lngDigit = Math.floor(lng / resolution);
    lat -= latDigit * resolution;
    lng -= lngDigit * resolution;
    prefix += ALPHABET[latDigit] + ALPHABET[lngDigit];
  }
  return prefix;
}

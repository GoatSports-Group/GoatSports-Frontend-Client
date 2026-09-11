export interface ReverseGeocodeAddress {
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  city_district?: string;
  district?: string;
  county?: string;
  city?: string;
  town?: string;
  municipality?: string;
  state?: string;
}

export interface ReverseGeocodeResponse {
  address?: ReverseGeocodeAddress;
}

export interface BigDataCloudReverseGeocodeResponse {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  localityInfo?: {
    administrative?: Array<{
      name?: string;
      description?: string;
      adminLevel?: number;
    }>;
  };
}

export function formatCurrentLocation(address?: ReverseGeocodeAddress): string {
  if (!address) return '';

  const district = firstValue(
    address.city_district,
    address.district,
    address.suburb,
    address.county,
    address.quarter,
    address.neighbourhood
  );
  const city = firstValue(address.city, address.town, address.municipality, address.state);

  return [district, city]
    .filter((value, index, values): value is string => !!value && values.indexOf(value) === index)
    .join(', ');
}

export function formatBigDataCloudLocation(result?: BigDataCloudReverseGeocodeResponse): string {
  if (!result) return '';

  const administrativeNames = (result.localityInfo?.administrative ?? [])
    .map(item => item.name?.trim())
    .filter((value): value is string => !!value && value.toLowerCase() !== 'việt nam');
  const ward = administrativeNames.find(name => /^(phường|xã|thị trấn)\s/i.test(name));
  const locality = firstValue(ward, result.locality);

  return [locality, result.city, result.principalSubdivision]
    .map(value => value?.trim())
    .filter((value, index, values): value is string => !!value && values.indexOf(value) === index)
    .join(', ');
}

function firstValue(...values: Array<string | undefined>): string {
  return values.find(value => value?.trim())?.trim() ?? '';
}

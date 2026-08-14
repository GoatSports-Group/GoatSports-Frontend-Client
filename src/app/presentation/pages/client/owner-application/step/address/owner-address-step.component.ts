import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { OwnerApplicationFormValue } from '../../owner-application.models';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-owner-address-step',
  templateUrl: './owner-address-step.component.html',
  styleUrls: ['./owner-address-step.component.scss'],
  standalone: false
})
export class OwnerAddressStepComponent implements OnInit, OnDestroy {
  @Input({ required: true }) form!: OwnerApplicationFormValue;

  suggestions: any[] = [];
  isSuggestionsVisible = false;
  isLoading = false;
  hasSearched = false;
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  ngOnInit() {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(query => {
      this.searchAddress(query);
    });
  }

  ngOnDestroy() {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  onAddressChange(value: string) {
    if (value && value.length >= 3) {
      this.isLoading = true;
      this.isSuggestionsVisible = true;
      this.searchSubject.next(value);
    } else {
      this.isLoading = false;
      this.suggestions = [];
      this.hasSearched = false;
      this.isSuggestionsVisible = false;
    }
  }

  async searchAddress(query: string) {
    if (!query || query.length < 3) {
      this.suggestions = [];
      this.isLoading = false;
      this.hasSearched = false;
      this.isSuggestionsVisible = false;
      return;
    }
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=vn&limit=5&accept-language=vi,en`);
      const data = await response.json();
      this.suggestions = data || [];
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
      this.suggestions = [];
    } finally {
      this.isLoading = false;
      this.hasSearched = true;
    }
  }

  selectSuggestion(suggestion: any) {
    const address = suggestion.address || {};
    const rawParts: string[] = (suggestion.display_name || '')
      .split(',')
      .map((p: string) => p.trim())
      .filter(Boolean);

    // 1. Filter out Country and Postal Code to get clean administrative tokens
    const cleanParts: string[] = rawParts.filter((p: string) => {
      const lower = p.toLowerCase();
      if (lower === 'việt nam' || lower === 'vietnam' || lower === 'vn') return false;
      if (address.country && lower === address.country.toLowerCase()) return false;
      if (/^\d{4,6}$/.test(p)) return false;
      if (address.postcode && p === address.postcode) return false;
      return true;
    });

    let detailedAddress = '';
    let ward = '';
    let district = '';
    let city = '';
    let province = '';

    // 2. Initial extraction from Nominatim address object
    city = address.city || address.province || address.state || address.region || '';
    province = address.state || address.province || address.region || address.city || '';

    // 3. First pass: Keyword & Prefix recognition (when prefixes like 'Phường', 'Quận', 'Thành phố' exist)
    for (let i = 0; i < cleanParts.length; i++) {
      const p = cleanParts[i];
      const lower = p.toLowerCase();
      
      if (
        lower.startsWith('phường') || lower.startsWith('xã') || lower.startsWith('thị trấn') ||
        lower.startsWith('p.') || lower.startsWith('x.') || lower.startsWith('tt.') || lower.includes('ward')
      ) {
        if (!ward) ward = p;
      } else if (
        lower.startsWith('quận') || lower.startsWith('huyện') || lower.startsWith('thị xã') ||
        lower.startsWith('q.') || lower.startsWith('h.') || lower.startsWith('tx.') || lower.includes('district')
      ) {
        if (!district) district = p;
      } else if (
        (lower.startsWith('thành phố') || lower.startsWith('tỉnh') || lower.startsWith('tp.') ||
         lower.includes('city') || lower.includes('province')) && i >= cleanParts.length - 2
      ) {
        if (!city || city === cleanParts[cleanParts.length - 1]) city = p;
        if (!province) province = p;
      }
    }

    // 4. Second pass: Fallback from specific address tags
    if (!district) {
      district = address.city_district || address.district || address.county || address.state_district || address.borough || '';
      if (!district && address.town && address.town !== city) {
        district = address.town;
      }
    }

    if (!ward) {
      ward = address.quarter || address.neighbourhood || address.village || address.hamlet || '';
    }

    // Handle ambiguous 'suburb' tag
    if (address.suburb) {
      const subLower = address.suburb.toLowerCase();
      if (subLower.includes('quận') || subLower.includes('huyện') || subLower.includes('district')) {
        if (!district) district = address.suburb;
      } else if (subLower.includes('phường') || subLower.includes('xã') || subLower.includes('ward')) {
        if (!ward) ward = address.suburb;
      } else {
        if (!district && ward && ward !== address.suburb) {
          district = address.suburb;
        } else if (!ward && !district) {
          ward = address.suburb;
        } else if (!district) {
          district = address.suburb;
        }
      }
    }

    // 5. Third pass: Positional Fallback (Crucial when names DO NOT have prefixes like 'Quận' / 'Phường')
    // OpenStreetMap structures tokens from left-to-right: [Detail/Street, ..., Ward, District, City/Province]
    if (cleanParts.length >= 4) {
      const posCity = cleanParts[cleanParts.length - 1];
      const posDistrict = cleanParts[cleanParts.length - 2];
      const posWard = cleanParts[cleanParts.length - 3];

      if (!city) city = posCity;
      if (!province) province = posCity;
      if (!district) district = posDistrict;
      if (!ward) ward = posWard;
    } else if (cleanParts.length === 3) {
      // [Street, MiddleLevel, City]
      const posCity = cleanParts[2];
      const posMiddle = cleanParts[1];
      if (!city) city = posCity;
      if (!province) province = posCity;

      if (!ward && !district) {
        district = posMiddle;
      } else if (ward && !district && ward !== posMiddle) {
        district = posMiddle;
      } else if (!ward && district && district !== posMiddle) {
        ward = posMiddle;
      }
    } else if (cleanParts.length === 2) {
      if (!city) city = cleanParts[1];
      if (!province) province = cleanParts[1];
    }

    // 6. Build Detailed Address
    if (address.house_number && address.road) {
      detailedAddress = `${address.house_number} ${address.road}`;
    } else if (address.road) {
      if (cleanParts.length > 0 && cleanParts[0] !== address.road && /^\d+/.test(cleanParts[0])) {
        detailedAddress = `${cleanParts[0]} ${address.road}`;
      } else {
        detailedAddress = address.road;
      }
    } else if (cleanParts.length > 0) {
      const nonDetailParts = [ward, district, city, province];
      const detailTokens = cleanParts.filter((p: string) => !nonDetailParts.includes(p));
      detailedAddress = detailTokens.length > 0 ? detailTokens.join(', ') : cleanParts[0];
    }

    // Final fallback between city and province
    if (!province && city) province = city;
    if (!city && province) city = province;

    this.form.address = detailedAddress;
    this.form.ward = ward;
    this.form.district = district;
    this.form.province = province;
    this.form.city = city;

    this.suggestions = [];
    this.isSuggestionsVisible = false;
    this.hasSearched = false;
  }

  hideSuggestions() {
    setTimeout(() => {
      this.isSuggestionsVisible = false;
    }, 200);
  }
}

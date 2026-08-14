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
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=vn&limit=5`);
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
    const parts = (suggestion.display_name || '').split(',').map((p: string) => p.trim());
    
    let detailedAddress = '';
    if (address.house_number && address.road) {
      detailedAddress = `${address.house_number} ${address.road}`;
    } else if (address.road) {
      detailedAddress = address.road;
    } else {
      detailedAddress = parts[0] || '';
    }
    
    // Ward fallback
    let ward = address.suburb || address.village || address.quarter || address.neighbourhood || address.hamlet || '';
    if (!ward) {
      const foundWard = parts.find((p: string) => p.toLowerCase().startsWith('phường') || p.toLowerCase().startsWith('xã') || p.toLowerCase().includes('ward'));
      if (foundWard) ward = foundWard;
    }

    // District fallback
    let district = address.city_district || address.district || address.county || address.borough || address.town || '';
    if (!district) {
      const foundDistrict = parts.find((p: string) => p.toLowerCase().startsWith('quận') || p.toLowerCase().startsWith('huyện') || p.toLowerCase().startsWith('thị xã') || p.toLowerCase().includes('district'));
      if (foundDistrict) district = foundDistrict;
    }

    // City & Province mapping
    let city = address.city || address.town || address.state || address.province || '';
    if (!city) {
      const foundCity = parts.find((p: string) => p.toLowerCase().startsWith('thành phố') || p.toLowerCase().includes('city'));
      if (foundCity) city = foundCity;
    }

    let province = address.state || address.province || address.region || '';
    if (!province) {
      const foundProvince = parts.find((p: string) => p.toLowerCase().startsWith('tỉnh') || p.toLowerCase().includes('province'));
      if (foundProvince) province = foundProvince;
    }
    
    // Fallback between city and province for VN addresses
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

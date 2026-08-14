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
    
    let detailedAddress = '';
    if (address.house_number && address.road) {
      detailedAddress = `${address.house_number} ${address.road}`;
    } else if (address.road) {
      detailedAddress = address.road;
    } else {
      detailedAddress = suggestion.display_name.split(',')[0];
    }
    
    this.form.address = detailedAddress;
    this.form.ward = address.suburb || address.village || address.quarter || address.neighbourhood || address.hamlet || '';
    this.form.district = address.city_district || address.district || address.county || address.borough || address.town || '';
    
    const cityName = address.city || address.town || address.state || address.province || '';
    this.form.city = cityName;
    this.form.province = address.state || address.province || address.region || cityName; // Fallback to city if province is missing
    
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

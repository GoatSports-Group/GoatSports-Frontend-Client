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
    this.searchSubject.next(value);
  }

  async searchAddress(query: string) {
    if (!query || query.length < 3) {
      this.suggestions = [];
      this.isSuggestionsVisible = false;
      return;
    }
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=vn&limit=5`);
      const data = await response.json();
      this.suggestions = data;
      this.isSuggestionsVisible = true;
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
    }
  }

  selectSuggestion(suggestion: any) {
    // We only take the local address part if possible, but Nominatim returns full display_name
    // Let's use the house_number and road for 'Địa chỉ chi tiết' if available, otherwise display_name
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
    this.form.district = address.city_district || address.district || address.county || address.borough || '';
    this.form.province = address.state || address.province || address.region || '';
    this.form.city = address.city || address.town || address.state || address.province || '';
    
    this.suggestions = [];
    this.isSuggestionsVisible = false;
  }

  hideSuggestions() {
    // Need a small delay so the click event on suggestion can be fired
    setTimeout(() => {
      this.isSuggestionsVisible = false;
    }, 200);
  }
}

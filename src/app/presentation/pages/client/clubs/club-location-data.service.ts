import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';

export interface VietnamProvince {
  code: string;
  name: string;
  type: 'CITY' | 'PROVINCE';
  /** Administrative centre; used as the default play location for sport profiles. */
  latitude: number;
  longitude: number;
}

@Injectable({ providedIn: 'root' })
export class ClubLocationDataService {
  private readonly http = inject(HttpClient);

  readonly provinces = signal<ReadonlyArray<VietnamProvince>>([]);

  constructor() {
    this.http.get<VietnamProvince[]>('/assets/data/vietnam-provinces.json').subscribe({
      next: provinces => this.provinces.set(provinces),
      error: () => this.provinces.set([])
    });
  }
}

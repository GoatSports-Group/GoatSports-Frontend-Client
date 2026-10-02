import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, of, shareReplay } from 'rxjs';

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
  /** Tai mot lan, dung chung (vd. doi ten tinh trong ho so the thao sang ma cua CLB). */
  readonly provinces$ = this.http.get<VietnamProvince[]>('/assets/data/vietnam-provinces.json').pipe(
    catchError(() => of([] as VietnamProvince[])),
    shareReplay(1)
  );

  constructor() {
    this.provinces$.subscribe(provinces => this.provinces.set(provinces));
  }
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  VenueCourt,
  VenueFacilityLayout,
  VenueFacilityLayoutItem
} from '@application/dto/venue/venue.dto';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';
import { CourtFloorMarkingComponent } from './court-floor-marking.component';

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

@Component({
  selector: 'app-venue-facility-layout-view',
  standalone: true,
  imports: [CourtFloorMarkingComponent, LucideIconComponent],
  templateUrl: './venue-facility-layout-view.component.html',
  styleUrl: './venue-facility-layout-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VenueFacilityLayoutViewComponent {
  readonly layout = input.required<VenueFacilityLayout>();
  readonly courts = input<readonly VenueCourt[]>([]);
  readonly parkingSlots = Array.from({ length: 23 }, (_, index) => index);

  readonly courtItems = computed(() => this.layout().items.filter(item => item.type === 'COURT'));
  readonly facilityItems = computed(() => this.layout().items.filter(item => item.type !== 'COURT'));

  itemPercent(value: number, axis: 'x' | 'y'): number {
    if (!Number.isFinite(value)) return 0;
    return value / (axis === 'x' ? CANVAS_WIDTH : CANVAS_HEIGHT) * 100;
  }

  courtForItem(item: VenueFacilityLayoutItem): VenueCourt | undefined {
    return this.courts().find(court => court.venueCourtId === item.courtId);
  }

  courtStatus(court: VenueCourt | undefined): string {
    if (!court?.active || court.availabilityStatus === 'INACTIVE') return 'Tạm ngưng';
    if (court.availabilityStatus === 'MAINTENANCE') return 'Bảo trì';
    return 'Đang hoạt động';
  }

  facilityIcon(item: VenueFacilityLayoutItem): string {
    const label = item.label.toLocaleLowerCase('vi');
    if (label.includes('tắm')) return 'droplets';
    const icons: Partial<Record<VenueFacilityLayoutItem['type'], string>> = {
      RECEPTION: 'store',
      ENTRANCE: 'arrow-right',
      PARKING: 'circle-parking',
      LOCKER: 'folder-open',
      WC: 'users',
      WAITING: 'clock',
      CAFE: 'cup-soda',
      STORAGE: 'inbox',
      CUSTOM: 'layout-grid'
    };
    return icons[item.type] ?? 'layout-grid';
  }
}

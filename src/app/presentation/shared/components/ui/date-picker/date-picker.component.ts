import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostBinding, Input, Output, forwardRef, inject } from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
  disabled: boolean;
  today: boolean;
  aria: string;
}

const WEEKDAYS = [
  { short: 'T2', full: 'Thứ Hai' }, { short: 'T3', full: 'Thứ Ba' }, { short: 'T4', full: 'Thứ Tư' },
  { short: 'T5', full: 'Thứ Năm' }, { short: 'T6', full: 'Thứ Sáu' }, { short: 'T7', full: 'Thứ Bảy' },
  { short: 'CN', full: 'Chủ Nhật' }
];

/** yyyy-MM-dd theo gio dia phuong (khong dung toISOString: lech mot ngay o UTC+7 truoc 7h sang). */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseIsoDate(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Chon ngay thay cho <input type="date"> (GOAT-DESIGN §6 Inputs & Forms → Date picker). Gia tri la chuoi
 * yyyy-MM-dd giong input native, nen thay vao [(ngModel)] / formControlName khong phai doi model.
 * Lich nam trong CDK overlay nhu app-select; tuan bat dau tu Thu Hai; ban phim: mui ten, PageUp/PageDown, Home/End, Enter, Esc.
 * Client va admin giu hai ban giong het nhau.
 */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [OverlayModule],
  templateUrl: './date-picker.component.html',
  styleUrls: ['./date-picker.component.scss'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePickerComponent), multi: true }],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DatePickerComponent implements ControlValueAccessor {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  /** Ngay nho nhat / lon nhat duoc chon (yyyy-MM-dd). */
  @Input() min: string | null | undefined = null;
  @Input() max: string | null | undefined = null;
  @Input() placeholder = 'Chọn ngày';
  @Input() ariaLabel = 'Chọn ngày';
  @Input() disabled = false;
  @Input() clearable = true;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  /** 'icon': chi nut lich vuong (vd. canh dai ngay o trang chi tiet san); kich thuoc do cha quyet dinh. */
  @Input() variant: 'field' | 'icon' = 'field';

  /** Thay cho su kien (change) cua input native: phat yyyy-MM-dd (hoac '' khi xoa) moi lan nguoi dung chon. */
  @Output() readonly dateChange = new EventEmitter<string>();

  @HostBinding('class.is-icon') get iconVariant(): boolean {
    return this.variant === 'icon';
  }

  readonly weekdays = WEEKDAYS;
  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 }
  ];

  value = '';
  open = false;
  view: 'days' | 'months' = 'days';
  /** Thang dang xem (ngay 1) va ngay dang co focus ban phim. */
  cursor = new Date();
  focused = '';

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  get label(): string {
    const date = parseIsoDate(this.value);
    return date ? this.longLabel(date) : '';
  }

  get monthTitle(): string {
    return `Tháng ${this.cursor.getMonth() + 1}, ${this.cursor.getFullYear()}`;
  }

  get todayIso(): string {
    return toIsoDate(new Date());
  }

  get todayAllowed(): boolean {
    return !this.isDisabled(this.todayIso);
  }

  get days(): DayCell[] {
    const first = new Date(this.cursor.getFullYear(), this.cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - (first.getDay() + 6) % 7);
    const today = this.todayIso;
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const iso = toIsoDate(date);
      return {
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === this.cursor.getMonth(),
        disabled: this.isDisabled(iso),
        today: iso === today,
        aria: this.longLabel(date)
      };
    });
  }

  get months(): { index: number; label: string; disabled: boolean }[] {
    const year = this.cursor.getFullYear();
    return Array.from({ length: 12 }, (_, index) => ({
      index,
      label: `Th ${index + 1}`,
      disabled: this.monthOutOfRange(year, index)
    }));
  }

  get canPrev(): boolean {
    const target = this.view === 'days'
      ? new Date(this.cursor.getFullYear(), this.cursor.getMonth(), 0)
      : new Date(this.cursor.getFullYear() - 1, 11, 31);
    const min = parseIsoDate(this.min);
    return !min || target >= min;
  }

  get canNext(): boolean {
    const target = this.view === 'days'
      ? new Date(this.cursor.getFullYear(), this.cursor.getMonth() + 1, 1)
      : new Date(this.cursor.getFullYear() + 1, 0, 1);
    const max = parseIsoDate(this.max);
    return !max || target <= max;
  }

  toggle(): void {
    if (this.disabled) return;
    this.open ? this.close() : this.openPanel();
  }

  openPanel(): void {
    if (this.disabled) return;
    const selected = parseIsoDate(this.value);
    const anchor = selected ?? this.clampToRange(new Date());
    this.cursor = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    this.focused = toIsoDate(anchor);
    this.view = 'days';
    this.open = true;
    this.focusCell();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.onTouched();
  }

  step(direction: 1 | -1): void {
    if (direction < 0 ? !this.canPrev : !this.canNext) return;
    this.cursor = this.view === 'days'
      ? new Date(this.cursor.getFullYear(), this.cursor.getMonth() + direction, 1)
      : new Date(this.cursor.getFullYear() + direction, this.cursor.getMonth(), 1);
  }

  toggleView(): void {
    this.view = this.view === 'days' ? 'months' : 'days';
  }

  pickMonth(index: number): void {
    this.cursor = new Date(this.cursor.getFullYear(), index, 1);
    this.view = 'days';
  }

  pick(iso: string): void {
    if (this.isDisabled(iso)) return;
    this.commit(iso);
    this.close();
  }

  pickToday(): void {
    if (this.todayAllowed) this.pick(this.todayIso);
  }

  clear(): void {
    this.commit('');
    this.close();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key) && !this.open) {
      event.preventDefault();
      this.openPanel();
    }
  }

  onGridKeydown(event: KeyboardEvent): void {
    const current = parseIsoDate(this.focused) ?? new Date();
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1),
      ArrowRight: () => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1),
      ArrowUp: () => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7),
      ArrowDown: () => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7),
      PageUp: () => new Date(current.getFullYear(), current.getMonth() - 1, current.getDate()),
      PageDown: () => new Date(current.getFullYear(), current.getMonth() + 1, current.getDate()),
      Home: () => new Date(current.getFullYear(), current.getMonth(), current.getDate() - (current.getDay() + 6) % 7),
      End: () => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 6 - (current.getDay() + 6) % 7)
    };
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.pick(this.focused);
      return;
    }
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const next = this.clampToRange(move());
    this.focused = toIsoDate(next);
    this.cursor = new Date(next.getFullYear(), next.getMonth(), 1);
    this.focusCell();
  }

  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.elementRef.nativeElement.querySelector<HTMLButtonElement>('.date-picker__trigger')?.focus();
    }
  }

  /** Bam ngoai lich (ke ca vao trigger cua select/date picker khac) thi dong — giong app-select. */
  onOutsideClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) this.close();
  }

  writeValue(value: string | null | undefined): void {
    this.value = parseIsoDate(value) ? String(value).slice(0, 10) : '';
    this.changeDetector.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    if (disabled) this.open = false;
    this.changeDetector.markForCheck();
  }

  /** "Thứ Sáu, 02/10/2026" — ten thu viet day du (GOAT-DESIGN §4). */
  private longLabel(date: Date): string {
    return `${WEEKDAYS[(date.getDay() + 6) % 7].full}, ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  private commit(value: string): void {
    this.value = value;
    this.onChange(value);
    this.dateChange.emit(value);
  }

  private isDisabled(iso: string): boolean {
    return (!!this.min && iso < this.min.slice(0, 10)) || (!!this.max && iso > this.max.slice(0, 10));
  }

  private monthOutOfRange(year: number, month: number): boolean {
    const first = toIsoDate(new Date(year, month, 1));
    const last = toIsoDate(new Date(year, month + 1, 0));
    return (!!this.min && last < this.min.slice(0, 10)) || (!!this.max && first > this.max.slice(0, 10));
  }

  private clampToRange(date: Date): Date {
    const min = parseIsoDate(this.min);
    const max = parseIsoDate(this.max);
    if (min && date < min) return min;
    if (max && date > max) return max;
    return date;
  }

  private focusCell(): void {
    // Cho overlay ve xong roi moi dua focus vao o ngay (roving tabindex).
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`.date-picker__panel [data-iso="${this.focused}"]`)?.focus());
  }
}

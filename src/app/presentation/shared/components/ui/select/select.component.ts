import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, HostListener, Input, ViewChild, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: any;
  label: string;
  disabled?: boolean;
  icon?: string;
}

@Component({
  selector: 'app-select',
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.scss'],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => SelectComponent),
    multi: true
  }],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectComponent implements ControlValueAccessor {
  private elementRef = inject(ElementRef);

  @Input() options: readonly SelectOption[] = [];
  @Input() placeholder = 'Chọn một giá trị';
  @Input() searchable = false;
  @Input() searchPlaceholder = 'Tìm kiếm...';
  @Input() disabled = false;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() leadingIcon = '';
  @Input() ariaLabel = 'Chọn giá trị';

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  public value: any = '';
  public open = false;
  public openUpward = false;
  public searchQuery = '';
  public activeIndex = -1;

  private onChange: (value: any) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  get filteredOptions(): readonly SelectOption[] {
    if (!this.searchable || !this.searchQuery.trim()) {
      return this.options;
    }
    const query = this.searchQuery.toLowerCase().trim();
    return this.options.filter(opt =>
      opt.label.toLowerCase().includes(query) ||
      String(opt.value).toLowerCase().includes(query)
    );
  }

  get selectedLabel(): string {
    const selected = this.options.find(option => option.value === this.value);
    return selected ? selected.label : '';
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      this.searchQuery = '';
      const bounds = this.elementRef.nativeElement.getBoundingClientRect();
      this.openUpward = window.innerHeight - bounds.bottom < 280 && bounds.top > 280;
      this.activeIndex = Math.max(0, this.filteredOptions.findIndex(option => option.value === this.value));
      if (this.searchable) {
        setTimeout(() => this.searchInput?.nativeElement.focus(), 50);
      }
    }
    this.onTouched();
  }

  select(option: SelectOption, event: MouseEvent): void {
    event.stopPropagation();
    if (option.disabled) return;
    this.value = option.value;
    this.open = false;
    this.searchQuery = '';
    this.onChange(this.value);
    this.onTouched();
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.open = false;
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open) {
        this.open = true;
        this.activeIndex = Math.max(0, this.filteredOptions.findIndex(option => option.value === this.value));
        return;
      }
      this.moveActiveOption(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.open) {
        this.open = true;
      } else {
        const option = this.filteredOptions[this.activeIndex];
        if (option && !option.disabled) this.commitSelection(option);
      }
    }
  }

  private moveActiveOption(direction: 1 | -1): void {
    const options = this.filteredOptions;
    if (!options.length) return;
    let index = this.activeIndex;
    do {
      index = (index + direction + options.length) % options.length;
    } while (options[index]?.disabled && index !== this.activeIndex);
    this.activeIndex = index;
  }

  private commitSelection(option: SelectOption): void {
    this.value = option.value;
    this.open = false;
    this.searchQuery = '';
    this.onChange(this.value);
    this.onTouched();
  }

  writeValue(value: any): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    if (disabled) this.open = false;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.open = false;
    }
  }
}

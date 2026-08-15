import { Component, ElementRef, forwardRef, HostListener, Input, ViewChild, inject } from '@angular/core';
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
  standalone: false
})
export class SelectComponent implements ControlValueAccessor {
  private elementRef = inject(ElementRef);

  @Input() options: readonly SelectOption[] = [];
  @Input() placeholder = 'Chọn một giá trị';
  @Input() searchable = false;
  @Input() searchPlaceholder = 'Tìm kiếm...';
  @Input() disabled = false;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  public value: any = '';
  public open = false;
  public searchQuery = '';

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
    if (event.key === 'Enter' || event.key === ' ') {
      if (!this.open) {
        event.preventDefault();
        this.open = true;
      }
    }
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

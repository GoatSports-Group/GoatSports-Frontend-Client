import { Component, forwardRef, HostListener, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
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
  @Input() options: readonly SelectOption[] = [];
  @Input() placeholder = 'Chọn một giá trị';

  value = '';
  open = false;
  disabled = false;

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  get selectedLabel(): string {
    return this.options.find(option => option.value === this.value)?.label ?? this.placeholder;
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.open = !this.open;
    this.onTouched();
  }

  select(option: SelectOption, event: MouseEvent): void {
    event.stopPropagation();
    if (option.disabled) return;
    this.value = option.value;
    this.open = false;
    this.onChange(this.value);
    this.onTouched();
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.open = false;
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open = !this.open;
    }
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
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
  }

  @HostListener('document:click')
  close(): void {
    this.open = false;
  }
}

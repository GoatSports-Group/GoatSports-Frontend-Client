import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideIconComponent } from '@shared/components/ui/lucide-icon/lucide-icon.component';

@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [CommonModule, LucideIconComponent],
  templateUrl: './form-field.component.html',
  styleUrls: ['./form-field.component.scss']
})
export class FormFieldComponent {
  label = input.required<string>();
  icon = input<string>('');
  errorMessage = input<string>('');
  showError = input(false);
  hasError = input(false);
}

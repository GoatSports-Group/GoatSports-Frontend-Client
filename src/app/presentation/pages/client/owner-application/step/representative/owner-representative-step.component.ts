import { Component, Input } from '@angular/core';
import { OwnerApplicationFormValue } from '../../owner-application.models';

@Component({
  selector: 'app-owner-representative-step',
  templateUrl: './owner-representative-step.component.html',
  styleUrls: ['./owner-representative-step.component.scss'],
  standalone: false
})
export class OwnerRepresentativeStepComponent {
  @Input({ required: true }) form!: OwnerApplicationFormValue;
}

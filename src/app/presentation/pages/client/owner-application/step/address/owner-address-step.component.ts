import { Component, Input } from '@angular/core';
import { OwnerApplicationFormValue } from '../../owner-application.models';

@Component({
  selector: 'app-owner-address-step',
  templateUrl: './owner-address-step.component.html',
  styleUrls: ['./owner-address-step.component.scss'],
  standalone: false
})
export class OwnerAddressStepComponent {
  @Input({ required: true }) form!: OwnerApplicationFormValue;
}

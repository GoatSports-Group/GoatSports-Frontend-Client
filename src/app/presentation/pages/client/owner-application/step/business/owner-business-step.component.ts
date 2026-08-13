import { Component, Input } from '@angular/core';
import { BUSINESS_TYPE_OPTIONS } from '@application/dto/owner-application/owner-application.dto';
import { OwnerApplicationFormValue } from '../../owner-application.models';

@Component({
  selector: 'app-owner-business-step',
  templateUrl: './owner-business-step.component.html',
  styleUrls: ['./owner-business-step.component.scss'],
  standalone: false
})
export class OwnerBusinessStepComponent {
  @Input({ required: true }) form!: OwnerApplicationFormValue;
  readonly businessTypes = BUSINESS_TYPE_OPTIONS;
}

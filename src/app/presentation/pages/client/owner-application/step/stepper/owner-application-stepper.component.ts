import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OwnerStep } from '../../owner-application.models';

@Component({
  selector: 'app-owner-application-stepper',
  templateUrl: './owner-application-stepper.component.html',
  styleUrls: ['./owner-application-stepper.component.scss'],
  standalone: false
})
export class OwnerApplicationStepperComponent {
  @Input({ required: true }) steps: OwnerStep[] = [];
  @Input() currentStep = 1;
  @Output() stepChange = new EventEmitter<number>();

  get progress(): number {
    return this.steps.length <= 1 ? 0 : ((this.currentStep - 1) / (this.steps.length - 1)) * 100;
  }
}

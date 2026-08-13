import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OwnerApplicationFiles, OwnerFileKey } from '../../owner-application.models';

@Component({
  selector: 'app-owner-documents-step',
  templateUrl: './owner-documents-step.component.html',
  styleUrls: ['./owner-documents-step.component.scss'],
  standalone: false
})
export class OwnerDocumentsStepComponent {
  @Input({ required: true }) files!: OwnerApplicationFiles;
  @Output() fileSelected = new EventEmitter<{ key: OwnerFileKey; file: File }>();
  @Output() fileRemoved = new EventEmitter<OwnerFileKey>();

  select(key: OwnerFileKey, file: File): void {
    this.fileSelected.emit({ key, file });
  }
}

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OwnerApplication } from '@application/dto/owner-application/owner-application.dto';
import { OwnerApplicationHistoryItem } from './owner-application-progress.models';
import {
  buildOwnerApplicationProgress,
  formatOwnerApplicationAddress,
  getBusinessTypeLabel,
  getOwnerApplicationStatusLabel
} from './owner-application-progress.utils';

@Component({
  selector: 'app-owner-application-history',
  templateUrl: './owner-application-history.component.html',
  styleUrls: ['./owner-application-history.component.scss'],
  standalone: false
})
export class OwnerApplicationHistoryComponent {
  private applicationItems: OwnerApplicationHistoryItem[] = [];

  @Input()
  set applications(applications: OwnerApplication[]) {
    this.applicationItems = applications.map(application => ({
      application,
      progress: buildOwnerApplicationProgress(application)
    }));
  }

  get items(): OwnerApplicationHistoryItem[] {
    return this.applicationItems;
  }

  @Input() loading = false;
  @Output() createApplication = new EventEmitter<void>();

  readonly getAddress = formatOwnerApplicationAddress;
  readonly getBusinessTypeLabel = getBusinessTypeLabel;
  readonly getStatusLabel = getOwnerApplicationStatusLabel;
}

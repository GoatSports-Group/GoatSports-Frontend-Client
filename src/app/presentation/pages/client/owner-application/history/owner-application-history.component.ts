import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OwnerApplication } from '@domain/entities/owner-application';
import { BusinessType, BUSINESS_TYPE_OPTIONS } from '@domain/enums/business-type.enum';
import { OwnerApplicationStatus, OWNER_APPLICATION_STATUS_OPTIONS } from '@domain/enums/owner-application-status.enum';

@Component({
  selector: 'app-owner-application-history',
  templateUrl: './owner-application-history.component.html',
  styleUrls: ['./owner-application-history.component.scss'],
  standalone: false
})
export class OwnerApplicationHistoryComponent {
  @Input() applications: OwnerApplication[] = [];
  @Input() loading = false;
  @Output() createApplication = new EventEmitter<void>();

  getStatusLabel(status: OwnerApplicationStatus): string {
    return OWNER_APPLICATION_STATUS_OPTIONS.find(option => option.value === status)?.label ?? status;
  }

  getBusinessTypeLabel(type: BusinessType): string {
    return BUSINESS_TYPE_OPTIONS.find(option => option.value === type)?.label ?? type;
  }
}

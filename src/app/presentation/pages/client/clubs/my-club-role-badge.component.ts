import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ClubRole } from '@application/dto/club/club.dto';

@Component({
  selector: 'app-my-club-role-badge',
  templateUrl: './my-club-role-badge.component.html',
  styleUrls: ['./my-club-role-badge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class MyClubRoleBadgeComponent {
  readonly role = input.required<ClubRole>();
  readonly isManager = computed(() => this.role() === 'OWNER' || this.role() === 'ADMIN');
  readonly label = computed(() => this.role() === 'OWNER'
    ? 'Chủ CLB'
    : this.role() === 'ADMIN' ? 'Quản lý CLB' : 'Thành viên');
}

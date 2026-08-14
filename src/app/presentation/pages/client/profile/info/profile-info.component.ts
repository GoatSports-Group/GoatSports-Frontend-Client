import { Component, Input } from '@angular/core';
import { User } from '@application/dto/user/user.dto';

@Component({
  selector: 'app-profile-info',
  templateUrl: './profile-info.component.html',
  styleUrls: ['./profile-info.component.scss'],
  standalone: false
})
export class ProfileInfoComponent {
  @Input() user: User | null = null;

  get fallbackAvatar(): string {
    if (this.user?.avatarUrl) {
      return this.user.avatarUrl;
    }
    return this.user?.fullName
      ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(this.user.fullName)}&backgroundColor=059669&textColor=ffffff`
      : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80';
  }

  get initials(): string {
    if (!this.user?.fullName) return 'GS';
    const words = this.user.fullName.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  get roleBadgeClass(): string {
    const role = this.user?.role?.name?.toUpperCase();
    if (role === 'ADMIN') return 'badge--admin';
    if (role === 'OWNER') return 'badge--owner';
    return 'badge--player';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }
}

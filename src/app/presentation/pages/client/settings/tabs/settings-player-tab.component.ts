import { Component, Input, inject } from '@angular/core';
import { User } from '@application/dto/user/user.dto';
import { NotifyService } from '@shared/components/notify/notify.service';
import { PlayerProfileForm } from '../settings.models';

@Component({
  selector: 'app-settings-player-tab',
  templateUrl: './settings-player-tab.component.html',
  styleUrls: ['./settings-player-tab.component.scss'],
  standalone: false
})
export class SettingsPlayerTabComponent {
  @Input() user: User | null = null;
  private notifyService = inject(NotifyService);

  public form: PlayerProfileForm = {
    expertise: 'Bóng đá, Cầu lông, Pickleball',
    company: 'GoatSports Athletic Club',
    role: 'Vận động viên phong trào',
    linkedIn: 'N/A',
    twitter: 'N/A',
    portfolio: 'N/A',
    affiliatePartner: 'N/A'
  };

  onEdit(field: string): void {
    this.notifyService.info('Tính năng đang hoàn thiện', `Đang chuẩn bị form cập nhật ${field}`);
  }
}

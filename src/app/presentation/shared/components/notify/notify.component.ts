import { Component, inject } from '@angular/core';
import { NotifyService } from './notify.service';

@Component({
  selector: 'app-notify',
  templateUrl: './notify.component.html',
  styleUrls: ['./notify.component.scss'],
  standalone: true
})
export class NotifyComponent {
  readonly notify = inject(NotifyService);
}

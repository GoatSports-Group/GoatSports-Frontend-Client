import { Component, Input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

@Component({
  selector: 'lucide-icon',
  standalone: true,
  imports: [LucideDynamicIcon],
  templateUrl: './lucide-icon.component.html',
  styleUrls: ['./lucide-icon.component.scss']
})
export class LucideIconComponent {
  @Input() name!: string;
  @Input() class: string = '';
}

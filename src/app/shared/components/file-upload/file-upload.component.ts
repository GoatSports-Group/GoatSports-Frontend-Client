import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss'],
  standalone: false
})
export class FileUploadComponent {
  private readonly notify = inject(NotifyService);

  @Input({ required: true }) label = '';
  @Input() hint = 'JPG, PNG hoặc PDF • Tối đa 2MB';
  @Input() accept = 'image/*,.pdf';
  @Input() required = false;
  @Input() maxSizeMb = 2;
  @Input() file: File | null = null;
  @Input() error = '';
  @Output() fileSelected = new EventEmitter<File>();
  @Output() fileRemoved = new EventEmitter<void>();

  handleSelection(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = input.files?.[0];
    if (selected && selected.size > this.maxSizeMb * 1024 * 1024) {
      this.notify.error(`File "${selected.name}" vượt quá giới hạn ${this.maxSizeMb}MB.`);
      input.value = '';
      return;
    }
    if (selected) this.fileSelected.emit(selected);
    input.value = '';
  }
}

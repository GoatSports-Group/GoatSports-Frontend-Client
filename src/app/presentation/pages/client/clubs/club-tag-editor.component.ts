import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-club-tag-editor',
  templateUrl: './club-tag-editor.component.html',
  styleUrls: ['./club-tag-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ClubTagEditorComponent {
  @Input() tags: string[] = [];
  @Input() sportLabel = '';
  @Input() disabled = false;
  @Output() tagsChange = new EventEmitter<string[]>();

  readonly suggestions = ['Giao lưu', 'Thi đấu', 'Cộng đồng', 'Phong trào', 'Rèn luyện', 'Sức khỏe'];
  readonly maxTags = 5;
  readonly maxLength = 24;
  tagInput = '';
  validationMessage = '';

  get limitReached(): boolean { return this.tags.length >= this.maxTags; }

  isSelected(value: string): boolean {
    const normalized = value.toLocaleLowerCase('vi');
    return this.tags.some(tag => tag.toLocaleLowerCase('vi') === normalized);
  }

  addSuggestion(value: string): void { this.addTag(value); }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    this.addTag(this.tagInput);
  }

  addCurrentTag(): void { this.addTag(this.tagInput); }

  removeTag(value: string): void {
    if (this.disabled) return;
    this.tagsChange.emit(this.tags.filter(tag => tag !== value));
    this.validationMessage = '';
  }

  private addTag(rawValue: string): void {
    if (this.disabled) return;
    const value = rawValue.trim().replace(/\s+/g, ' ');
    if (!value) return;
    if (value.length > this.maxLength) {
      this.validationMessage = `Badge tối đa ${this.maxLength} ký tự.`;
      return;
    }
    if (this.limitReached) {
      this.validationMessage = `Bạn chỉ có thể tạo tối đa ${this.maxTags} badge.`;
      return;
    }
    if (this.isSelected(value) || value.toLocaleLowerCase('vi') === this.sportLabel.toLocaleLowerCase('vi')) {
      this.validationMessage = 'Badge này đã được thêm.';
      return;
    }
    this.tagsChange.emit([...this.tags, value]);
    this.tagInput = '';
    this.validationMessage = '';
  }
}

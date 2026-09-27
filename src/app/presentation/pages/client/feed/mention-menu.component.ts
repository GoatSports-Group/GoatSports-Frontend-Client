import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MentionOption, MentionPicker } from './mention-picker';

/** Danh sach goi y @ dat ngay duoi o nhap (cha phai la `position: relative`). */
@Component({
  selector: 'app-mention-menu',
  template: `
    @if (picker.options().length) {
      <ul class="mention-menu" role="listbox" [id]="picker.listId" aria-label="Nhắc tên">
        @for (person of picker.options(); track person.userId; let index = $index) {
          <li role="option" [id]="picker.optionId(index)" [attr.aria-selected]="index === picker.index()"
            [class.is-active]="index === picker.index()" (mousedown)="$event.preventDefault(); picked.emit(person)"
            (mouseenter)="picker.index.set(index)">
            <img [src]="person.avatar" alt="" width="28" height="28" />
            <span>{{ person.name }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: contents; }
    .mention-menu {
      position: absolute; top: calc(100% + 4px); left: 0; z-index: 30;
      display: grid; width: min(100%, 320px); margin: 0; padding: 6px;
      border: 1px solid var(--hairline); border-radius: 16px; background: var(--surface);
      box-shadow: var(--shadow-lg); list-style: none;
      animation: goat-drop 220ms var(--ease-standard, ease-out) backwards;
    }
    li {
      display: flex; min-height: 44px; align-items: center; gap: 10px; padding: 0 10px;
      border-radius: 8px; color: var(--ink); font-size: 14px; font-weight: 600; cursor: pointer;
    }
    li.is-active { background: var(--primary-light); color: var(--primary-strong); font-weight: 700; }
    img { width: 28px; height: 28px; flex: none; border-radius: 9999px; background: var(--surface-strong); object-fit: cover; }
    span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class MentionMenuComponent {
  @Input({ required: true }) picker!: MentionPicker;
  @Output() readonly picked = new EventEmitter<MentionOption>();
}

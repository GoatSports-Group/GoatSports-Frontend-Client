import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { HashtagPicker } from './hashtag-picker';

/** Danh sach goi y "#chu de" dat ngay duoi o nhap (cha phai la `position: relative`); cung kieu menu goi y "@". */
@Component({
  selector: 'app-hashtag-menu',
  template: `
    @if (picker.options().length) {
      <ul class="tag-menu" role="listbox" [id]="picker.listId" aria-label="Chủ đề">
        @for (tag of picker.options(); track tag; let index = $index) {
          <li role="option" [id]="picker.optionId(index)" [attr.aria-selected]="index === picker.index()"
            [class.is-active]="index === picker.index()" (mousedown)="$event.preventDefault(); picked.emit(tag)"
            (mouseenter)="picker.index.set(index)">
            <span class="tag-menu__hash" aria-hidden="true">#</span><span>{{ tag }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: contents; }
    .tag-menu {
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
    .tag-menu__hash {
      display: grid; width: 28px; height: 28px; flex: none; place-items: center; border-radius: 8px;
      background: var(--primary-light); color: var(--primary-strong); font-weight: 900;
    }
    span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class HashtagMenuComponent {
  @Input({ required: true }) picker!: HashtagPicker;
  @Output() readonly picked = new EventEmitter<string>();
}

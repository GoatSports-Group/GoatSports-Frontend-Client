import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Tab gach chan chung cho khu Tro giup & chinh sach: chuyen qua lai giua 4 trang. */
@Component({
  selector: 'app-policy-tabs',
  template: `
    <nav class="policy-tabs" aria-label="Trợ giúp & chính sách">
      @for (tab of tabs; track tab.path) {
        <a class="policy-tab" [routerLink]="['/policy', tab.path]" routerLinkActive="is-active"
          ariaCurrentWhenActive="page">
          <lucide-icon [name]="tab.icon" class="w-4 h-4"></lucide-icon>{{ tab.label }}
        </a>
      }
    </nav>
  `,
  styles: [`
    :host { display: block; }
    .policy-tabs {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      border-bottom: 1px solid var(--hairline);
      overscroll-behavior-x: contain;
    }
    .policy-tab {
      display: inline-flex;
      height: 48px;
      flex: none;
      align-items: center;
      gap: 8px;
      padding: 0 16px;
      color: var(--body);
      font-size: 14px;
      font-weight: 800;
      text-decoration: none;
      white-space: nowrap;
      transition: color var(--transition-smooth), box-shadow var(--transition-smooth);
    }
    .policy-tab:hover { color: var(--ink); }
    .policy-tab.is-active { color: var(--primary); box-shadow: inset 0 -3px 0 var(--primary); }
    .policy-tab:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: -3px; }
    @media (max-width: 680px) {
      .policy-tabs {
        padding-right: 24px;
        mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class PolicyTabsComponent {
  readonly tabs = [
    { path: 'contact-support', label: 'Liên hệ hỗ trợ', icon: 'message-circle' },
    { path: 'booking-policy', label: 'Chính sách đặt sân', icon: 'calendar-check' },
    { path: 'cancellation-policy', label: 'Hủy sân & hoàn tiền', icon: 'calendar-x' },
    { path: 'court-standards', label: 'Tiêu chuẩn sân đấu', icon: 'shield-check' }
  ];
}

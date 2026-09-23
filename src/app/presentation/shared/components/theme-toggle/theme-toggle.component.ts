import { ChangeDetectionStrategy, Component, Input, computed, inject } from '@angular/core';
import { ThemeService } from '../../../services/theme.service';

/**
 * Sun / moon switch for the light & dark theme (GOAT-DESIGN.md "Dark theme").
 * Kept identical in client, admin and auth; icons are inline SVG so it needs no icon registry.
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="theme-toggle" [class.theme-toggle--sm]="size === 'sm'" role="switch"
      [attr.aria-checked]="isDark()" [attr.aria-label]="label()" [title]="label()" (click)="toggle($event)">
      <svg class="theme-toggle__icon theme-toggle__sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      <svg class="theme-toggle__icon theme-toggle__moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }

    .theme-toggle {
      position: relative;
      display: inline-grid;
      width: 44px;
      height: 44px;
      flex: none;
      place-items: center;
      overflow: hidden;
      border: 1px solid var(--hairline);
      border-radius: 12px;
      background: var(--surface);
      color: var(--ink);
      cursor: pointer;
      transition: background-color 180ms cubic-bezier(.2, .8, .2, 1), color 180ms cubic-bezier(.2, .8, .2, 1),
        border-color 180ms cubic-bezier(.2, .8, .2, 1);
    }

    .theme-toggle--sm { width: 40px; height: 40px; }

    .theme-toggle:hover {
      border-color: var(--border-strong);
      background: var(--primary-light);
      color: var(--primary);
    }

    .theme-toggle:focus-visible {
      outline: 3px solid var(--focus-ring);
      outline-offset: 3px;
    }

    /* toggle-flip: the leaving icon turns away and shrinks while the other turns in. */
    .theme-toggle__icon {
      grid-area: 1 / 1;
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
      transition: transform 360ms cubic-bezier(.2, .8, .2, 1), opacity 240ms cubic-bezier(.2, .8, .2, 1);
    }

    .theme-toggle__moon { opacity: 0; transform: rotate(-90deg) scale(.4); }

    :host-context([data-theme='dark']) .theme-toggle__sun { opacity: 0; transform: rotate(90deg) scale(.4); }
    :host-context([data-theme='dark']) .theme-toggle__moon { opacity: 1; transform: none; }

    @media (prefers-reduced-motion: reduce) {
      .theme-toggle__icon { transition: opacity 120ms linear; transform: none !important; }
    }
  `]
})
export class ThemeToggleComponent {
  @Input() size: 'md' | 'sm' = 'md';

  private readonly themeService = inject(ThemeService);
  readonly isDark = computed(() => this.themeService.theme() === 'dark');
  readonly label = computed(() => this.isDark() ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');

  toggle(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.themeService.toggle({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }
}

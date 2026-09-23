import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

// Kept identical in client, admin and auth. Tokens: src/styles/_goat-theme.scss.
export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

// A cookie (not localStorage) so the choice follows the user across the three apps on the same host.
const COOKIE = 'goat-theme';
const ONE_YEAR_S = 60 * 60 * 24 * 365;
const REVEAL_MS = 600; // "Silk": smooth, gets out of the way
// Ease-in-out: the revealed area grows with r², so an ease-out start floods the screen in the first frames.
const REVEAL_EASING = 'cubic-bezier(.45, 0, .25, 1)';
const SWITCHING = 'data-theme-switching';

/**
 * Light / dark theme. index.html sets data-theme before the first paint; this keeps it in sync with the
 * user's choice and, for "system", with the OS setting.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)');

  readonly preference = signal<ThemePreference>(this.readPreference());
  private readonly systemDark = signal(this.media?.matches ?? false);
  readonly theme = computed<Theme>(() => {
    const preference = this.preference();
    return preference === 'system' ? (this.systemDark() ? 'dark' : 'light') : preference;
  });

  constructor() {
    this.media?.addEventListener('change', event => this.systemDark.set(event.matches));
    effect(() => this.apply(this.theme()));
  }

  /** Flip between light and dark; `origin` is where the reveal circle starts (the toggle button). */
  toggle(origin?: { x: number; y: number }): void {
    this.setPreference(this.theme() === 'dark' ? 'light' : 'dark', origin);
  }

  setPreference(preference: ThemePreference, origin?: { x: number; y: number }): void {
    this.document.cookie = `${COOKIE}=${preference}; path=/; max-age=${ONE_YEAR_S}; SameSite=Lax`;
    const next = preference === 'system' ? (this.systemDark() ? 'dark' : 'light') : preference;
    if (next === this.theme()) {
      this.preference.set(preference);
      return;
    }

    const root = this.document.documentElement;
    const view = this.document.defaultView;
    const reduced = view?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = (this.document as Document & {
      startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> };
    }).startViewTransition;
    const commit = () => {
      this.preference.set(preference);
      this.apply(this.theme());
    };

    // Every card/button has a 180ms colour transition; hundreds of them firing at once drop frames under the reveal.
    root.setAttribute(SWITCHING, '');
    if (!view || reduced || !start) {
      commit();
      void root.offsetWidth; // flush the new colours while transitions are still off
      root.removeAttribute(SWITCHING);
      return;
    }

    // Circle reveal of the new theme from the toggle, like the theme is poured in from that spot.
    const x = origin?.x ?? view.innerWidth / 2;
    const y = origin?.y ?? 0;
    const radius = Math.hypot(Math.max(x, view.innerWidth - x), Math.max(y, view.innerHeight - y));
    const transition = start.call(this.document, commit);
    transition.ready.then(() => {
      this.document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: REVEAL_MS, easing: REVEAL_EASING, pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => { /* transition skipped: the theme is already applied */ });
    const done = () => root.removeAttribute(SWITCHING);
    transition.finished.then(done, done);
  }

  private apply(theme: Theme): void {
    const root = this.document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  }

  private readPreference(): ThemePreference {
    const match = this.document.cookie.match(/(?:^|;\s*)goat-theme=(system|light|dark)/);
    return (match?.[1] as ThemePreference) ?? 'system';
  }
}

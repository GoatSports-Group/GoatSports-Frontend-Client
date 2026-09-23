import { NavigationCancel, NavigationCancellationCode, NavigationEnd, NavigationError, Router } from '@angular/router';
import { Observable, combineLatest, filter, of, take } from 'rxjs';

// Kept identical in client, admin and auth, like the inline splash styles in src/index.html and src/assets/boot/.
const MIN_VISIBLE_MS = 800; // counted from page load, so fast reloads don't flash the splash
const FADE_MS = 450; // matches .goat-boot transition

/** Fades out the index.html boot splash once the first route has settled and `ready$` emits true. */
export function hideBootSplashWhenReady(router: Router, ready$: Observable<boolean> = of(true)): void {
  const firstRouteSettled$ = router.events.pipe(
    filter(event => event instanceof NavigationEnd || event instanceof NavigationError
      || (event instanceof NavigationCancel && event.code !== NavigationCancellationCode.Redirect)),
  );

  combineLatest([ready$.pipe(filter(Boolean)), firstRouteSettled$]).pipe(take(1)).subscribe(() => {
    const splash = document.getElementById('goat-boot');
    if (!splash) return;
    window.setTimeout(() => {
      splash.classList.add('is-leaving');
      window.setTimeout(() => splash.remove(), FADE_MS + 50);
    }, Math.max(0, MIN_VISIBLE_MS - performance.now()));
  });
}

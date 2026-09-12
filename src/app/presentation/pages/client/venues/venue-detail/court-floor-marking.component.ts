import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-court-floor-marking',
  standalone: true,
  template: `
    <svg viewBox="0 0 180 100" preserveAspectRatio="none" aria-hidden="true">
      <rect class="boundary" x="7" y="7" width="166" height="86" />
      @switch (sportType()) {
        @case ('FOOTBALL') {
          <line x1="90" y1="7" x2="90" y2="93" />
          <circle cx="90" cy="50" r="17" />
          <circle cx="90" cy="50" r="2" class="filled" />
          <rect x="7" y="25" width="28" height="50" />
          <rect x="145" y="25" width="28" height="50" />
          <rect x="7" y="37" width="12" height="26" />
          <rect x="161" y="37" width="12" height="26" />
        }
        @case ('BASKETBALL') {
          <line x1="90" y1="7" x2="90" y2="93" />
          <circle cx="90" cy="50" r="14" />
          <path d="M7 24h25v52H7M173 24h-25v52h25" />
          <path d="M7 14a37 37 0 0 1 0 72M173 14a37 37 0 0 0 0 72" />
          <circle cx="19" cy="50" r="2" class="filled" />
          <circle cx="161" cy="50" r="2" class="filled" />
        }
        @case ('TENNIS') {
          <line x1="90" y1="7" x2="90" y2="93" class="net" />
          <line x1="40" y1="18" x2="140" y2="18" />
          <line x1="40" y1="82" x2="140" y2="82" />
          <line x1="40" y1="18" x2="40" y2="82" />
          <line x1="140" y1="18" x2="140" y2="82" />
          <line x1="40" y1="50" x2="140" y2="50" />
        }
        @case ('PICKLEBALL') {
          <line x1="90" y1="7" x2="90" y2="93" class="net" />
          <line x1="62" y1="7" x2="62" y2="93" />
          <line x1="118" y1="7" x2="118" y2="93" />
          <line x1="7" y1="50" x2="62" y2="50" />
          <line x1="118" y1="50" x2="173" y2="50" />
          <rect x="62" y="7" width="56" height="86" class="zone" />
        }
        @case ('VOLLEYBALL') {
          <line x1="90" y1="7" x2="90" y2="93" class="net" />
          <line x1="58" y1="7" x2="58" y2="93" />
          <line x1="122" y1="7" x2="122" y2="93" />
        }
        @default {
          <line x1="90" y1="7" x2="90" y2="93" class="net" />
          <line x1="45" y1="7" x2="45" y2="93" />
          <line x1="135" y1="7" x2="135" y2="93" />
          <line x1="7" y1="50" x2="173" y2="50" />
          <line x1="45" y1="34" x2="135" y2="34" />
          <line x1="45" y1="66" x2="135" y2="66" />
        }
      }
    </svg>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    svg { display: block; width: 100%; height: 100%; }
    rect, line, circle, path {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.25;
      vector-effect: non-scaling-stroke;
    }
    .boundary { stroke-width: 1.6; }
    .net { stroke-dasharray: 3 2; stroke-width: 1.8; }
    .filled { fill: currentColor; stroke: none; }
    .zone { fill: currentColor; opacity: .07; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourtFloorMarkingComponent {
  readonly sportType = input.required<string>();
}

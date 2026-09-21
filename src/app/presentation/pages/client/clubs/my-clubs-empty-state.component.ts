import { ChangeDetectionStrategy, Component, EventEmitter, input, Output } from '@angular/core';

@Component({
  selector: 'app-my-clubs-empty-state',
  templateUrl: './my-clubs-empty-state.component.html',
  styleUrls: ['./my-clubs-empty-state.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class MyClubsEmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly actionLabel = input.required<string>();
  @Output() readonly action = new EventEmitter<void>();
}

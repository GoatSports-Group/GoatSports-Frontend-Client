import { ChangeDetectionStrategy, Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { ClubCardView } from './club-view.model';

@Component({
  selector: 'app-club-join-request-modal',
  templateUrl: './club-join-request-modal.component.html',
  styleUrls: ['./club-join-request-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ClubJoinRequestModalComponent {
  @Input({ required: true }) club!: ClubCardView;
  @Output() cancelled = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<string>();

  readonly message = signal('');
  readonly canSubmit = computed(() => this.message().trim().length >= 20);

  updateMessage(value: string): void { this.message.set(value); }

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitted.emit(this.message().trim());
  }
}

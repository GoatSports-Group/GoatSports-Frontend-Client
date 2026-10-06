import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { NotifyService } from '@shared/components/notify/notify.service';

/**
 * Mo cua so chat nho (bong bong chat o goc phai duoi) tu bat ky trang nao, vd. nut "Nhan tin" o trang giai dau
 * va trang san: tao/lay doan chat 1-1 roi bao `app-chat-heads` mo no ngay tai trang dang xem.
 */
@Injectable({ providedIn: 'root' })
export class ChatDockService {
  private readonly chatRepo = inject(CHAT_REPOSITORY_TOKEN);
  private readonly notify = inject(NotifyService);

  /** Doan chat can mo; `app-chat-heads` doc roi xoa. */
  readonly openRequest = signal<string | null>(null);
  /** Nguoi dang duoc mo chat (khoa nut trong luc cho). */
  readonly pendingUserId = signal<string | null>(null);

  messageUser(userId: string): void {
    if (this.pendingUserId()) return;
    this.pendingUserId.set(userId);
    this.chatRepo.getOrCreateDirectRoom({ targetUserId: userId }).pipe(
      finalize(() => this.pendingUserId.set(null))
    ).subscribe({
      next: response => {
        if (response.data) this.openRequest.set(response.data.roomId);
      },
      error: () => this.notify.error('Không mở được cuộc trò chuyện. Có thể một trong hai bạn đã chặn người kia.')
    });
  }
}

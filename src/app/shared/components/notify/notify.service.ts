import { Injectable, signal } from '@angular/core';

export type NotifyType = 'success' | 'error' | 'warning' | 'info';

export interface NotifyItem {
  id: number;
  message: string;
  type: NotifyType;
  title: string;
}

@Injectable({ providedIn: 'root' })
export class NotifyService {
  readonly items = signal<NotifyItem[]>([]);
  private sequence = 0;

  success(message: string, title = 'Thành công'): void {
    this.show(message, 'success', title);
  }

  error(message: string, title = 'Có lỗi xảy ra'): void {
    this.show(message, 'error', title);
  }

  warning(message: string, title = 'Cần kiểm tra'): void {
    this.show(message, 'warning', title);
  }

  info(message: string, title = 'Thông báo'): void {
    this.show(message, 'info', title);
  }

  dismiss(id: number): void {
    this.items.update(items => items.filter(item => item.id !== id));
  }

  private show(message: string, type: NotifyType, title: string, duration = 3000): void {
    const id = ++this.sequence;
    this.items.update(items => [...items.slice(-3), { id, message, type, title }]);
    window.setTimeout(() => this.dismiss(id), duration);
  }
}

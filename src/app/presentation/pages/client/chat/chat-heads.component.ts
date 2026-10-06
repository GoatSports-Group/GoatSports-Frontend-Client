import { Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { ChatMessage, ChatRoom, ChatRoomType, MessageType } from '@application/dto/chat/chat.dto';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { CURRENT_USER_PROVIDER_TOKEN } from '@application/ports/current-user.provider';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';
import { PlayerDirectoryService } from '@presentation/services/player-directory.service';
import { ChatDockService } from '@presentation/services/chat-dock.service';

/** Mot bong bong: doan chat co tin moi ma nguoi dung chua mo. */
interface ChatHead {
  roomId: string;
  room: ChatRoom | null;
  unread: number;
  preview: string;
  senderId: string;
}

/** So bong bong toi da; cu nhat bi day ra khi co doan chat moi. */
const MAX_HEADS = 5;
const WINDOW_PAGE = 30;
const DEFAULT_AVATAR = 'assets/images/default-avatar.svg';

/**
 * Bong bong chat kieu Facebook o goc phai duoi, tren nut GOAT AI: ai nhan tin toi (doan chat chua tat thong bao)
 * thi hien avatar kem so tin chua doc; bam vao mo cua so chat nho ngay tai trang dang xem. An o trang Tin nhan.
 * Tin den qua kenh rieng `/topic/users/{id}/messages`, nen khong phai subscribe tung phong.
 */
@Component({
  selector: 'app-chat-heads',
  templateUrl: './chat-heads.component.html',
  styleUrls: ['./chat-heads.component.scss'],
  standalone: false
})
export class ChatHeadsComponent implements OnInit {
  private readonly ws = inject(WEBSOCKET_SERVICE_TOKEN);
  private readonly chatRepo = inject(CHAT_REPOSITORY_TOKEN);
  private readonly directory = inject(PlayerDirectoryService);
  private readonly currentUser = inject(CURRENT_USER_PROVIDER_TOKEN);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dock = inject(ChatDockService);

  @ViewChild('windowBody') private windowBody?: ElementRef<HTMLElement>;

  readonly heads = signal<ChatHead[]>([]);
  /** Doan chat dang mo trong cua so nho (mot cua so mot luc). */
  readonly openRoom = signal<ChatRoom | null>(null);
  readonly windowMessages = signal<ChatMessage[]>([]);
  readonly windowLoading = signal(false);
  readonly sending = signal(false);
  readonly onChatPage = signal(this.router.url.startsWith('/chat'));
  readonly visibleHeads = computed(() => this.heads().filter(head => head.roomId !== this.openRoom()?.roomId));
  draft = '';

  constructor() {
    // Nut "Nhan tin" o trang khac (giai dau, san): mo doan chat 1-1 trong cua so nho ngay tai cho.
    effect(() => {
      const roomId = this.dock.openRequest();
      if (!roomId) return;
      untracked(() => {
        this.dock.openRequest.set(null);
        this.openRoomById(roomId);
      });
    });
  }

  get me(): string {
    return this.currentUser.getCurrentUserId() || '';
  }

  ngOnInit(): void {
    if (!this.me) return;
    this.ws.connect();
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects.startsWith('/chat')),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(onChat => {
      this.onChatPage.set(onChat);
      // Trang Tin nhan huy subscribe moi phong khi roi trang: nghe lai phong cua cua so dang mo.
      const room = this.openRoom();
      if (!onChat && room) this.ws.subscribeToRoom(room.roomId);
    });
    this.ws.inboxMessages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(message => this.onIncoming(message));
    this.ws.chatMessages$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(message => {
      if (message.roomId === this.openRoom()?.roomId) this.appendToWindow(message);
    });
  }

  // ---- bong bong ------------------------------------------------------------------------------

  private onIncoming(message: ChatMessage): void {
    if (message.senderId === this.me || this.onChatPage()) return;
    if (message.roomId === this.openRoom()?.roomId) {
      this.appendToWindow(message);
      return;
    }
    const preview = this.preview(message);
    const existing = this.heads().find(head => head.roomId === message.roomId);
    const head: ChatHead = existing
      ? { ...existing, unread: existing.unread + 1, preview, senderId: message.senderId }
      : { roomId: message.roomId, room: null, unread: 1, preview, senderId: message.senderId };
    this.heads.update(items => [head, ...items.filter(item => item.roomId !== message.roomId)].slice(0, MAX_HEADS));
    if (!head.room) this.loadRoom(message.roomId);
  }

  private loadRoom(roomId: string): void {
    this.chatRepo.getRoomDetails(roomId).subscribe({
      next: response => {
        const room = response.data;
        if (!room) return;
        this.directory.resolve(room.participantIds).subscribe(people => {
          const participants = room.participants.map(person => ({
            ...person,
            userName: people.get(person.userId)?.fullName || person.userName,
            userAvatar: people.get(person.userId)?.avatarUrl || person.userAvatar
          }));
          const enriched = { ...room, participants };
          this.heads.update(items => items.map(item => item.roomId === roomId ? { ...item, room: enriched } : item));
          if (this.openRoom()?.roomId === roomId) this.openRoom.set(enriched);
        });
      },
      error: () => undefined
    });
  }

  dismiss(head: ChatHead, event?: Event): void {
    event?.stopPropagation();
    this.heads.update(items => items.filter(item => item.roomId !== head.roomId));
  }

  /** Doan chat hai nguoi: ten va anh cua nguoi kia; nhom / CLB / giai: ten nhom. */
  title(room: ChatRoom | null): string {
    if (!room) return 'Tin nhắn mới';
    const other = this.counterpart(room);
    if (other) return other.userName || room.name || 'Người chơi GOAT';
    return room.name || 'Nhóm trò chuyện';
  }

  avatar(room: ChatRoom | null, senderId?: string): string {
    if (!room) return DEFAULT_AVATAR;
    const other = this.counterpart(room);
    if (other) return other.userAvatar || DEFAULT_AVATAR;
    const sender = senderId ? room.participants.find(person => person.userId === senderId) : undefined;
    return room.avatarUrl || sender?.userAvatar || DEFAULT_AVATAR;
  }

  useDefaultAvatar(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith(DEFAULT_AVATAR)) image.src = DEFAULT_AVATAR;
  }

  // ---- cua so chat nho ------------------------------------------------------------------------

  open(head: ChatHead): void {
    this.heads.update(items => items.map(item => item.roomId === head.roomId ? { ...item, unread: 0 } : item));
    this.openRoomById(head.roomId, head.room);
  }

  /** Mo cua so nho cho mot doan chat; them bong bong cho no de thu nho xong van mo lai duoc. */
  openRoomById(roomId: string, known: ChatRoom | null = null): void {
    const head = this.heads().find(item => item.roomId === roomId);
    if (!head) {
      this.heads.update(items => [{ roomId, room: known, unread: 0, preview: '', senderId: '' }, ...items].slice(0, MAX_HEADS));
    }
    const room = known ?? head?.room ?? null;
    this.openRoom.set(room ?? this.placeholderRoom(roomId));
    if (!room) this.loadRoom(roomId);
    this.draft = '';
    this.windowMessages.set([]);
    this.windowLoading.set(true);
    this.ws.subscribeToRoom(roomId);
    this.chatRepo.getRoomMessages(roomId, 0, WINDOW_PAGE).subscribe({
      next: response => {
        if (this.openRoom()?.roomId !== roomId) return;
        this.windowMessages.set([...(response.data ?? [])].reverse());
        this.windowLoading.set(false);
        this.scrollToBottom();
      },
      error: () => this.windowLoading.set(false)
    });
    this.chatRepo.markRoomAsRead(roomId).subscribe({ error: () => undefined });
  }

  /** Thu nho: cua so dong lai, bong bong van con de mo lai. */
  minimize(): void {
    this.openRoom.set(null);
  }

  close(): void {
    const room = this.openRoom();
    this.openRoom.set(null);
    if (room) this.heads.update(items => items.filter(item => item.roomId !== room.roomId));
  }

  openInMessenger(): void {
    const room = this.openRoom();
    if (!room) return;
    this.close();
    void this.router.navigate(['/chat', room.roomId]);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const room = this.openRoom();
    const content = this.draft.trim();
    if (!room || !content || this.sending()) return;
    const clientMessageId = crypto.randomUUID();
    const pending: ChatMessage = {
      messageId: `pending-${clientMessageId}`, clientMessageId, roomId: room.roomId, senderId: this.me, content,
      type: MessageType.TEXT, deliveryState: 'SENDING', attachments: [], receipts: [], createdAt: new Date().toISOString()
    };
    this.draft = '';
    this.appendToWindow(pending);
    this.sending.set(true);
    this.chatRepo.sendMessage(room.roomId, { clientMessageId, content, type: MessageType.TEXT }).subscribe({
      next: response => {
        this.sending.set(false);
        if (response.data) this.appendToWindow({ ...response.data, deliveryState: 'SENT' });
      },
      error: () => {
        this.sending.set(false);
        this.windowMessages.update(items => items.map(item =>
          item.clientMessageId === clientMessageId ? { ...item, deliveryState: 'FAILED' } : item));
      }
    });
  }

  isGroup(room: ChatRoom): boolean {
    return !this.counterpart(room);
  }

  senderName(room: ChatRoom, senderId: string): string {
    return room.participants.find(person => person.userId === senderId)?.userName || 'Thành viên';
  }

  /** Tin dau cua mot chuoi lien tiep cung nguoi gui: cho hien ten nguoi gui trong nhom. */
  startsRun(index: number): boolean {
    const list = this.windowMessages();
    return index === 0 || list[index - 1].senderId !== list[index].senderId;
  }

  imageCount(message: ChatMessage): number {
    return message.attachments?.length ?? 0;
  }

  private appendToWindow(message: ChatMessage): void {
    const list = this.windowMessages();
    const index = list.findIndex(item => item.messageId === message.messageId
      || (!!message.clientMessageId && item.clientMessageId === message.clientMessageId));
    if (index >= 0) {
      this.windowMessages.update(items => items.map((item, i) => i === index ? { ...message, deliveryState: message.deliveryState ?? 'SENT' } : item));
      return;
    }
    this.windowMessages.update(items => [...items, message]);
    this.scrollToBottom();
    if (message.senderId !== this.me) this.chatRepo.markRoomAsRead(message.roomId).subscribe({ error: () => undefined });
  }

  private counterpart(room: ChatRoom) {
    const pair = (room.type === ChatRoomType.DIRECT || room.type === ChatRoomType.MATCH) && room.participants.length === 2;
    return pair ? room.participants.find(person => person.userId !== this.me) : undefined;
  }

  private preview(message: ChatMessage): string {
    if (message.content) return message.content;
    const images = message.attachments?.length ?? 0;
    return images > 1 ? `Đã gửi ${images} ảnh` : images === 1 ? 'Đã gửi một ảnh' : 'Tin nhắn mới';
  }

  private placeholderRoom(roomId: string): ChatRoom {
    return { roomId, type: ChatRoomType.DIRECT, participantIds: [], participants: [], unreadCount: 0, createdAt: '', updatedAt: '' };
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      const body = this.windowBody?.nativeElement;
      if (body) body.scrollTop = body.scrollHeight;
    });
  }
}

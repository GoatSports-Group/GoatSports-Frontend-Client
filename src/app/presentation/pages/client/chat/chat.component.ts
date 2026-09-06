import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CHAT_REPOSITORY_TOKEN } from '@application/ports/persistence/chat.repository';
import { WEBSOCKET_SERVICE_TOKEN } from '@application/ports/websocket.service';
import { CURRENT_USER_PROVIDER_TOKEN } from '@application/ports/current-user.provider';
import {
  ChatRoom,
  ChatMessage,
  ChatRoomType,
  MessageType,
  ChatTypingEvent
} from '@application/dto/chat/chat.dto';
import { NotifyService } from '@shared/components/notify/notify.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: false
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesScroll') private scrollContainer?: ElementRef;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private chatRepo = inject(CHAT_REPOSITORY_TOKEN);
  private wsService = inject(WEBSOCKET_SERVICE_TOKEN);
  private userProvider = inject(CURRENT_USER_PROVIDER_TOKEN);
  private notifyService = inject(NotifyService);

  currentUserId: string = '';
  rooms: ChatRoom[] = [];
  filteredRooms: ChatRoom[] = [];
  activeRoom: ChatRoom | null = null;
  messages: ChatMessage[] = [];

  searchRoomQuery = '';
  messageInput = '';
  loadingRooms = true;
  loadingMessages = false;
  sendingMessage = false;

  isTyping = false;
  partnerTypingName = '';
  private typingTimeout: any = null;
  private shouldScrollBottom = false;

  showNewGroupModal = false;
  newGroupName = '';
  newGroupMembers = '';

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.currentUserId = this.userProvider.getCurrentUserId() || '';
    this.wsService.connect();

    this.loadRooms();
    this.listenToWebSocket();

    this.route.params.subscribe(params => {
      const roomId = params['roomId'];
      if (roomId) {
        this.selectRoomById(roomId);
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollBottom) {
      this.scrollToBottom();
      this.shouldScrollBottom = false;
    }
  }

  ngOnDestroy(): void {
    if (this.activeRoom) {
      this.wsService.unsubscribeFromRoom(this.activeRoom.roomId);
    }
    this.subs.forEach(s => s.unsubscribe());
  }

  loadRooms(): void {
    this.loadingRooms = true;
    this.chatRepo.getUserRooms().subscribe({
      next: res => {
        this.rooms = res?.data || [];
        this.filterRooms();
        this.loadingRooms = false;
        if (!this.activeRoom && this.rooms.length > 0 && !this.route.snapshot.params['roomId']) {
          this.selectRoom(this.rooms[0]);
        }
      },
      error: () => {
        this.loadingRooms = false;
      }
    });
  }

  filterRooms(): void {
    const q = this.searchRoomQuery.toLowerCase().trim();
    if (!q) {
      this.filteredRooms = this.rooms;
      return;
    }
    this.filteredRooms = this.rooms.filter(r =>
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.lastMessage && r.lastMessage.toLowerCase().includes(q))
    );
  }

  selectRoomById(roomId: string): void {
    const found = this.rooms.find(r => r.roomId === roomId);
    if (found) {
      this.selectRoom(found);
    } else {
      this.chatRepo.getRoomDetails(roomId).subscribe({
        next: res => {
          if (res?.data) {
            this.rooms.unshift(res.data);
            this.filterRooms();
            this.selectRoom(res.data);
          }
        }
      });
    }
  }

  selectRoom(room: ChatRoom): void {
    if (this.activeRoom?.roomId === room.roomId) return;

    if (this.activeRoom) {
      this.wsService.unsubscribeFromRoom(this.activeRoom.roomId);
    }

    this.activeRoom = room;
    this.wsService.subscribeToRoom(room.roomId);
    this.loadMessages(room.roomId);

    if (room.unreadCount > 0) {
      room.unreadCount = 0;
      this.chatRepo.markRoomAsRead(room.roomId).subscribe();
    }
  }

  loadMessages(roomId: string): void {
    this.loadingMessages = true;
    this.chatRepo.getRoomMessages(roomId).subscribe({
      next: res => {
        this.messages = (res?.data || []).reverse();
        this.loadingMessages = false;
        this.shouldScrollBottom = true;
      },
      error: () => {
        this.loadingMessages = false;
      }
    });
  }

  sendMessage(): void {
    const text = this.messageInput.trim();
    if (!text || !this.activeRoom || this.sendingMessage) return;

    this.sendingMessage = true;
    const roomId = this.activeRoom.roomId;
    const content = text;
    this.messageInput = '';
    this.onTypingStop();

    // Optimistic WebSocket Send
    this.wsService.sendChatMessage({
      roomId,
      senderId: this.currentUserId,
      content,
      type: MessageType.TEXT
    });

    // Fallback REST call
    this.chatRepo.sendMessage(roomId, { content, type: MessageType.TEXT }).subscribe({
      next: res => {
        this.sendingMessage = false;
        if (res?.data) {
          const exists = this.messages.some(m => m.messageId === res.data.messageId);
          if (!exists) {
            this.messages.push(res.data);
            this.shouldScrollBottom = true;
          }
        }
      },
      error: () => {
        this.sendingMessage = false;
      }
    });
  }

  onInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    } else {
      this.onTyping();
    }
  }

  onTyping(): void {
    if (!this.activeRoom) return;
    if (!this.isTyping) {
      this.isTyping = true;
      this.wsService.sendTyping(this.activeRoom.roomId, 'Bạn bè', true);
    }
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.onTypingStop(), 2500);
  }

  onTypingStop(): void {
    if (!this.activeRoom || !this.isTyping) return;
    this.isTyping = false;
    this.wsService.sendTyping(this.activeRoom.roomId, '', false);
  }

  private listenToWebSocket(): void {
    this.subs.push(
      this.wsService.chatMessages$.subscribe(msg => {
        if (this.activeRoom && msg.roomId === this.activeRoom.roomId) {
          const exists = this.messages.some(m => m.messageId === msg.messageId);
          if (!exists) {
            this.messages.push(msg);
            this.shouldScrollBottom = true;
          }
        }
        // Update room snippet
        const room = this.rooms.find(r => r.roomId === msg.roomId);
        if (room) {
          room.lastMessage = msg.content;
          room.lastMessageAt = msg.createdAt;
          if (!this.activeRoom || this.activeRoom.roomId !== msg.roomId) {
            room.unreadCount = (room.unreadCount || 0) + 1;
          }
        }
      })
    );

    this.subs.push(
      this.wsService.typingEvents$.subscribe((event: ChatTypingEvent) => {
        if (this.activeRoom && event.roomId === this.activeRoom.roomId && event.senderId !== this.currentUserId) {
          this.partnerTypingName = event.isTyping ? (event.senderName || 'Đối phương') : '';
        }
      })
    );
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }

  createGroup(): void {
    if (!this.newGroupName.trim()) {
      this.notifyService.error('Vui lòng nhập tên nhóm chat.');
      return;
    }
    this.chatRepo.createGroupRoom({
      name: this.newGroupName.trim(),
      participantIds: [this.currentUserId]
    }).subscribe({
      next: res => {
        if (res?.data) {
          this.showNewGroupModal = false;
          this.newGroupName = '';
          this.rooms.unshift(res.data);
          this.filterRooms();
          this.selectRoom(res.data);
          this.notifyService.success('Tạo nhóm chat thành công!');
        }
      }
    });
  }
}

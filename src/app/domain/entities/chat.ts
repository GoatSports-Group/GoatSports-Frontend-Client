import { ChatRoomType } from '@domain/enums/chat-room-type.enum';
import { MessageType } from '@domain/enums/message-type.enum';

export interface ChatRoom {
  roomId: string;
  type: ChatRoomType;
  name?: string;
  avatarUrl?: string;
  participantIds: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  lastSenderId?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  messageId: string;
  roomId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  type: MessageType;
  metadata?: string;
  isRead?: boolean;
  createdAt: string;
}

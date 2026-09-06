import { ChatRoomType } from '@domain/enums/chat-room-type.enum';
import { MessageType } from '@domain/enums/message-type.enum';

export interface ChatRoom {
  roomId: string;
  type: ChatRoomType;
  name?: string;
  avatarUrl?: string;
  contextId?: string;
  lastMessageId?: string;
  participantIds: string[];
  participants: ChatParticipant[];
  lastMessage?: string;
  lastMessageAt?: string;
  lastSenderId?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatParticipant {
  userId: string;
  userName?: string;
  userAvatar?: string;
  role?: string;
  joinedAt?: string;
  lastReadMessageId?: string;
  leftAt?: string;
}

export interface ChatMessage {
  messageId: string;
  roomId: string;
  senderId: string;
  clientMessageId?: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  type: MessageType;
  status?: 'SENT' | 'DELIVERED' | 'READ';
  replyToMessageId?: string;
  attachments: ChatMessageAttachment[];
  receipts: ChatMessageReceipt[];
  deleted?: boolean;
  isRead?: boolean;
  createdAt: string;
  editedAt?: string;
}

export interface ChatMessageAttachment {
  attachmentId: string;
  storageKey: string;
  type: 'IMAGE' | 'VIDEO' | 'FILE';
  fileName?: string;
  fileSize?: number;
}

export interface ChatMessageReceipt {
  receiptId: string;
  userId: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  occurredAt: string;
}

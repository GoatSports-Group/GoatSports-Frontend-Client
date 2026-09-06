export { ChatRoom, ChatMessage } from '@domain/entities/chat';
export { ChatRoomType } from '@domain/enums/chat-room-type.enum';
export { MessageType } from '@domain/enums/message-type.enum';

export interface CreateDirectRoomRequest {
  targetUserId: string;
  targetUserName?: string;
  targetUserAvatar?: string;
}

export interface CreateGroupRoomRequest {
  name: string;
  avatarUrl?: string;
  participantIds: string[];
}

export interface SendMessageRequest {
  content: string;
  type?: string;
  metadata?: string;
}

export interface ChatTypingEvent {
  roomId: string;
  senderId: string;
  senderName: string;
  isTyping: boolean;
}

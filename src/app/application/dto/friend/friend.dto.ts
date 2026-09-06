export { Friendship } from '@domain/entities/friend';
export { FriendshipStatus } from '@domain/enums/friendship-status.enum';

export interface SendFriendRequestPayload {
  targetUserId: string;
  targetUserName?: string;
  targetUserAvatar?: string;
}

export interface RespondFriendRequestPayload {
  accepted: boolean;
}

import { FriendshipStatus } from '@domain/enums/friendship-status.enum';

export interface Friendship {
  friendshipId: string;
  requesterId: string;
  addresseeId: string;
  requesterName?: string;
  requesterAvatar?: string;
  addresseeName?: string;
  addresseeAvatar?: string;
  status: FriendshipStatus;
  requestedAt: string;
  respondedAt?: string;
}

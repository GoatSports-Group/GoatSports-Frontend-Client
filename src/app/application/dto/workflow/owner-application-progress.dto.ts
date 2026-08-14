export interface OwnerApplicationProgressItem {
  ownerApplicationId: string;
  receivedAt?: string;
  viewedAt?: string;
}

export interface OwnerApplicationProgressResponse {
  items: OwnerApplicationProgressItem[];
}

export interface OwnerApplicationProgressChangedEvent {
  type: 'OWNER_APPLICATION_PROGRESS_CHANGED';
  ownerApplicationId: string;
}

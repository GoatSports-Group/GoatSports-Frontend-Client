export enum DocumentType {
  ID_CARD_FRONT = 'ID_CARD_FRONT',
  ID_CARD_BACK = 'ID_CARD_BACK',
  BUSINESS_LICENSE = 'BUSINESS_LICENSE',
  VENUE_IMAGE = 'VENUE_IMAGE',
}

export const DOCUMENT_TYPE_OPTIONS = [
  {
    value: DocumentType.ID_CARD_FRONT,
    label: 'Mặt trước CCCD',
  },
  {
    value: DocumentType.ID_CARD_BACK,
    label: 'Mặt sau CCCD',
  },
  {
    value: DocumentType.BUSINESS_LICENSE,
    label: 'Giấy phép kinh doanh',
  },
  {
    value: DocumentType.VENUE_IMAGE,
    label: 'Ảnh sân',
  },
];

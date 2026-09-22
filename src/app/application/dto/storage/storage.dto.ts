export interface PresignedUrlRequest {
  fileName: string;
  contentType: string;
  folder: string;
  contentLength: number;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  objectKey: string;
}

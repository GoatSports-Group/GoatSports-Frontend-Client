export type BaseResponse<T> = {
  data: T;
  statusCode: number | null;
  message: Object | null;
  error: string | null;
}

export type BaseErrorResponse = {
  data: null;
  error: string;
  message: string;
  statusCode: number | string;
}

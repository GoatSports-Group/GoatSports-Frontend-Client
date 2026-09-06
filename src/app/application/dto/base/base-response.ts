export type BaseResponse<T> = {
  data: T;
  statusCode: number | null;
  message: Object | null;
  error: string | null;
}

export type BaseListResponse<T> = {
  meta: {
    page: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  result: T[];
}

/** Pagination contract returned by GoatSports services that expose PageResult. */
export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Pagination contract returned by Spring Data Page endpoints. */
export type SpringPageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  numberOfElements: number;
}

export type BaseErrorResponse = {
  data: null;
  error: string;
  message: string;
  statusCode: number | string;
}

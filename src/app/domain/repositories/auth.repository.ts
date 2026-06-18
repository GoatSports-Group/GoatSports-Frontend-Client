import { Observable } from 'rxjs';
import { BaseResponse } from '../entities/base';
import { User } from '../entities/user';

export interface AuthRepository {
  linkKeycloak(payload: { code: string; redirectUri: string }): Observable<BaseResponse<void>>;
  logout(): Observable<BaseResponse<void>>;
  refresh(): Observable<BaseResponse<User>>;
  getCurrentUser(): Observable<BaseResponse<User>>;
}

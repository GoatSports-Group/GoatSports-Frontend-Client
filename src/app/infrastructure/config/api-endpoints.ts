import { environment } from '@environments/environment';

const gatewayUrl = environment.apiUrl.replace(/\/+$/, '');

export const API_ENDPOINTS = {
  auth: `${gatewayUrl}/auth-service/api/v1`,
  venue: `${gatewayUrl}/venue-service/api/v1`,
  payment: `${gatewayUrl}/payment-service/api/v1`,
  club: `${gatewayUrl}/club-service/api/v1`,
  social: `${gatewayUrl}/social-service/api/v1/social`,
  ai: `${gatewayUrl}/ai-service/api/v1/ai`
} as const;

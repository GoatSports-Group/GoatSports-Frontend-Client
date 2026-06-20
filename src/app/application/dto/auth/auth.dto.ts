export type LoginRequest = {
  username: string;
  password: string;
}

export type RegisterRequest = {
  username: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export type VerificationRequest = {
  email: string;
  verificationCode: string;
}

export type ForgotPasswordRequest = {
  email: string;
  password: string;
  confirmPassword: string;
}

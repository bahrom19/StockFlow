export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyId: string;
  roles: string[];
  permissions: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  refreshExpiresIn: string;
  user: AuthUser;
}


export interface JwtPayload {
  userId: string;
  companyId: string;
  roles: string[];
  email: string;
}

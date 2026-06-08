export interface UserEntity {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string;
  password: string;
  phone: string | null;
  countryCode: string | null;
  entity: string | null;
  jobRole: string | null;
  createdAt: string;
}

export type SafeUser = Omit<UserEntity, 'password'>;

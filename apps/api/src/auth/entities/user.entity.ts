export interface UserEntity {
  id: string;
  fullName: string;
  email: string;
  password: string;
  createdAt: string;
}

export type SafeUser = Omit<UserEntity, 'password'>;

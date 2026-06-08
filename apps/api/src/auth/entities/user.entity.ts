import { EntityRecord } from './entity.entity';

export interface UserEntity {
  id: string;
  entityId: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string;
  password: string;
  phone: string | null;
  jobRole: string | null;
  role: string;
  createdAt: string;
}

export interface SafeUser extends Omit<UserEntity, 'password'> {
  entity: EntityRecord;
}

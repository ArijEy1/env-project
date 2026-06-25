export interface EntityRecord {
  id: string;
  nameAr: string;
  nameEn: string | null;
  crNumber: string;
  sector: string;
  entityType: string | null;
  environmentalExposure: string | null;
  submittedExposure: string | null;
  city: string;
  region: string | null;
  employeeCountBracket: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  unifiedNationalNumber: string | null;
  profileLockedAt: string | null;
  createdAt: string;
}

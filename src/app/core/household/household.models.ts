export interface Household {
  id: string;
  name: string;
  created_at: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: 'parent';
}

export interface HouseholdInvite {
  id: string;
  household_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
}

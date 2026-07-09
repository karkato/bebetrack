export type DiaperKind = 'wet' | 'dirty' | 'mixed';

export interface Diaper {
  id: string;
  baby_id: string;
  at: string;
  kind: DiaperKind;
  created_by: string;
  created_at: string;
}

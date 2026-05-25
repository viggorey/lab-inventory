export interface Item {
  id: string;
  name: string;
  quantity: string;
  unit?: string | null;
  category: string;
  location: string;
  source?: string | null;
  comment?: string | null;
  lab?: string | null;
  created_at?: string;
  created_by?: string;
  broken?: boolean | null;
  broken_at?: string | null;
  broken_by_email?: string | null;
  [key: string]: string | boolean | undefined | null;
}
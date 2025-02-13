export interface Item {
  id: string;
  name: string;
  quantity: string;
  unit?: string | null;
  category: string;
  location: string;
  source?: string | null;
  comment?: string | null;
  created_at?: string;
  created_by?: string;
  [key: string]: string | undefined | null;
}
export interface SharedLink {
  id: string;
  title: string;
  url: string;
  comment: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
}

export interface SharedLinkFormData {
  title: string;
  url: string;
  comment: string;
}

export interface PublicationCategory {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Publication {
  id: string;
  title: string;
  author: string;
  year: number;
  category_id: string | null;
  doi: string | null;
  external_link: string | null;
  pdf_path: string | null;
  pdf_filename: string | null;
  pdf_size_bytes: number | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
}

export interface PublicationWithCategory extends Publication {
  category?: PublicationCategory | null;
}

export interface PublicationFormData {
  title: string;
  author: string;
  year: number | string;
  category_id: string | null;
  doi: string;
  external_link: string;
  notes: string;
}

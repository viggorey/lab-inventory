export interface Manual {
  id: string;
  title: string;
  equipment_id: string | null;
  description: string | null;
  version: string | null;
  pdf_path: string;
  pdf_filename: string;
  pdf_size_bytes: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
}

export interface ManualWithEquipment extends Manual {
  equipment?: {
    id: string;
    name: string;
    category: string;
  } | null;
}

export interface ManualFormData {
  title: string;
  equipment_id: string | null;
  description: string;
  version: string;
}

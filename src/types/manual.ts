export interface Manual {
  id: string;
  title: string;
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
  manual_equipment?: Array<{
    equipment: {
      id: string;
      name: string;
      category: string;
    };
  }>;
}

export interface ManualFormData {
  title: string;
  equipment_ids: string[];
  description: string;
  version: string;
}

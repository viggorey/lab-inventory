export interface Site {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description: string | null;
  photo: string | null;
  flora: string[];
  fauna: string[];
  created_at: string;
  created_by: string | null;
  photoUrl?: string;
}

export interface SiteFormData {
  name: string;
  lat: number | string;
  lng: number | string;
  description: string;
  flora: string[];
  fauna: string[];
}

export interface Item {
    id: string;
    name: string;
    quantity: string;
    category: string;
    location: string;
    source: string;
    created_at?: string;
    created_by?: string;
    [key: string]: string | undefined;  // Add index signature
  }
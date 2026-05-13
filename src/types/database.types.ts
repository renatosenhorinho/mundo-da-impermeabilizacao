/**
 * Supabase Database Schema Definitions
 * Auto-generated based on the current 'products' table structure
 */

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string; // The primary key (legacy/fallback identifier)
          slug: string; // The canonical URL-friendly identifier
          name: string; // Display name
          category: string; // Category slug
          brand: string | null; // Brand name (e.g. Viapol, Vedacit)
          image: string | null; // Primary image URL
          images: string[] | null; // Carousel images URLs
          description: string | null; // Short description / summary
          highlight: boolean; // Is featured/highlighted
          active: boolean; // Is active in the catalog
          available: boolean; // Is in stock / available
          aplicacao: string[] | null; // "Indicado para" list
          como_usar: string[] | null; // Step-by-step usage instructions
          parent_id: string | null; // ID to group variations
          variations: any[] | null; // JSON variations
          specs: Record<string, string> | null; // Technical specifications
          created_at: string; // ISO Timestamp
          updated_at: string; // ISO Timestamp
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          category: string;
          brand?: string | null;
          image?: string | null;
          images?: string[] | null;
          description?: string | null;
          highlight?: boolean;
          active?: boolean;
          available?: boolean;
          aplicacao?: string[] | null;
          como_usar?: string[] | null;
          parent_id?: string | null;
          variations?: any[] | null;
          specs?: Record<string, string> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          category?: string;
          brand?: string | null;
          image?: string | null;
          images?: string[] | null;
          description?: string | null;
          highlight?: boolean;
          active?: boolean;
          available?: boolean;
          aplicacao?: string[] | null;
          como_usar?: string[] | null;
          parent_id?: string | null;
          variations?: any[] | null;
          specs?: Record<string, string> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export type DbProductRow = Database['public']['Tables']['products']['Row'];
export type DbProductInsert = Database['public']['Tables']['products']['Insert'];
export type DbProductUpdate = Database['public']['Tables']['products']['Update'];

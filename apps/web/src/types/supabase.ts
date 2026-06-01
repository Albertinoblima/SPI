/**
 * Supabase generated types (Fase 3 - Type Safety)
 * 
 * Run `supabase gen types typescript --local --schema public > src/types/supabase.ts`
 * to regenerate from the current database schema.
 * 
 * This provides full type safety for Supabase queries (replacing loose `any` from DB results).
 * 
 * TODO: Integrate into all services (replace `any` from .from() results with Database['public']['Tables'] types).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Core tables - add more as schema evolves (run gen types to populate)
      surveys: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          description?: string | null;
          status: string;
          created_at: string;
          updated_at: string;
          deleted_at?: string | null;
          // ... other columns from your schema
        };
        Insert: {
          // ...
        };
        Update: {
          // ...
        };
      };
      responses: {
        Row: {
          id: string;
          survey_id: string;
          tenant_id: string;
          interviewer_id: string;
          is_complete: boolean;
          created_at: string;
          // ...
        };
        // ...
      };
      response_answers: {
        Row: {
          id: string;
          response_id: string;
          question_id: string;
          answer_text?: string | null;
          answer_json?: Json | null;
          // ...
        };
        // ...
      };
      // Add other tables (survey_premises, survey_localities, etc.) as needed.
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Convenience type for Supabase client with full types
export type TypedSupabaseClient = import('@supabase/supabase-js').SupabaseClient<Database>;

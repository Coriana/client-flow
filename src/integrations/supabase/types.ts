export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          type: Database["public"]["Enums"]["account_type"]
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          type: Database["public"]["Enums"]["account_type"]
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          type?: Database["public"]["Enums"]["account_type"]
          user_id?: string | null
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          user_id: string | null
          source: string | null
          api_key_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
          source?: string | null
          api_key_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
          source?: string | null
          api_key_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      api_request_log: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          duration_ms: number | null
          endpoint: string
          id: string
          ip_address: string | null
          method: string
          request_body: Json | null
          response_summary: string | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          endpoint: string
          id?: string
          ip_address?: string | null
          method: string
          request_body?: Json | null
          response_summary?: string | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          method?: string
          request_body?: Json | null
          response_summary?: string | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_documents: {
        Row: {
          asset_id: string
          created_at: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          name: string
          uploaded_by: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          name: string
          uploaded_by?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_history: {
        Row: {
          asset_id: string
          created_at: string
          created_by: string | null
          description: string
          event_date: string
          event_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          related_entity_id: string | null
          related_entity_type: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          created_by?: string | null
          description: string
          event_date?: string
          event_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          event_date?: string
          event_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance: {
        Row: {
          asset_id: string
          cost: number | null
          created_at: string
          date: string
          description: string
          id: string
          next_due: string | null
          performed_by: string | null
        }
        Insert: {
          asset_id: string
          cost?: number | null
          created_at?: string
          date: string
          description: string
          id?: string
          next_due?: string | null
          performed_by?: string | null
        }
        Update: {
          asset_id?: string
          cost?: number | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          next_due?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_versions: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          release_notes: string | null
          update_date: string
          updated_by: string | null
          version: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          release_notes?: string | null
          update_date: string
          updated_by?: string | null
          version: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          release_notes?: string | null
          update_date?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_tag: string
          asset_type: string | null
          assigned_client_id: string | null
          assigned_job_id: string | null
          created_at: string
          current_firmware: string | null
          description: string | null
          id: string
          image_url: string | null
          is_rental: boolean | null
          last_update_date: string | null
          location: string | null
          location_id: string | null
          monthly_rate: number | null
          name: string
          next_invoice_date: string | null
          notes: string | null
          purchase_cost: number | null
          purchase_date: string | null
          rental_start_date: string | null
          rented_to_client_id: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["asset_status"]
          updated_at: string
          user_id: string | null
          warranty_end: string | null
        }
        Insert: {
          asset_tag: string
          asset_type?: string | null
          assigned_client_id?: string | null
          assigned_job_id?: string | null
          created_at?: string
          current_firmware?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_rental?: boolean | null
          last_update_date?: string | null
          location?: string | null
          location_id?: string | null
          monthly_rate?: number | null
          name: string
          next_invoice_date?: string | null
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          rental_start_date?: string | null
          rented_to_client_id?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          user_id?: string | null
          warranty_end?: string | null
        }
        Update: {
          asset_tag?: string
          asset_type?: string | null
          assigned_client_id?: string | null
          assigned_job_id?: string | null
          created_at?: string
          current_firmware?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_rental?: boolean | null
          last_update_date?: string | null
          location?: string | null
          location_id?: string | null
          monthly_rate?: number | null
          name?: string
          next_invoice_date?: string | null
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          rental_start_date?: string | null
          rented_to_client_id?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          user_id?: string | null
          warranty_end?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_assigned_client_id_fkey"
            columns: ["assigned_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_assigned_job_id_fkey"
            columns: ["assigned_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_rented_to_client_id_fkey"
            columns: ["rented_to_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_id: string | null
          account_number: string | null
          bank_name: string | null
          bsb: string | null
          created_at: string | null
          current_balance: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          opening_balance: number | null
          opening_balance_date: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          account_number?: string | null
          bank_name?: string | null
          bsb?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          opening_balance?: number | null
          opening_balance_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          account_number?: string | null
          bank_name?: string | null
          bsb?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          opening_balance?: number | null
          opening_balance_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          bank_account_id: string
          created_at: string | null
          date: string
          description: string
          id: string
          import_batch_id: string | null
          imported_at: string | null
          is_reconciled: boolean | null
          matched_payment_id: string | null
          matched_purchase_id: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bank_account_id: string
          created_at?: string | null
          date: string
          description: string
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          is_reconciled?: boolean | null
          matched_payment_id?: string | null
          matched_purchase_id?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bank_account_id?: string
          created_at?: string | null
          date?: string
          description?: string
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          is_reconciled?: boolean | null
          matched_payment_id?: string | null
          matched_purchase_id?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_purchase_id_fkey"
            columns: ["matched_purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_import_sessions: {
        Row: {
          column_mapping: Json | null
          created_at: string | null
          created_by: string | null
          file_name: string | null
          id: string
          matched_rows: Json | null
          raw_data: Json
          status: string
          total_amount: number | null
          updated_at: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          column_mapping?: Json | null
          created_at?: string | null
          created_by?: string | null
          file_name?: string | null
          id?: string
          matched_rows?: Json | null
          raw_data: Json
          status?: string
          total_amount?: number | null
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          column_mapping?: Json | null
          created_at?: string | null
          created_by?: string | null
          file_name?: string | null
          id?: string
          matched_rows?: Json | null
          raw_data?: Json
          status?: string
          total_amount?: number | null
          updated_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_import_sessions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contact_history: {
        Row: {
          client_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string
          event_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          client_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          event_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          client_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          event_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: []
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          abn: string | null
          acn: string | null
          billing_address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          default_billable_expenses: boolean | null
          default_billable_time: boolean | null
          id: string
          is_active: boolean | null
          location_id: string | null
          name: string
          notes: string | null
          payment_terms: number | null
          trading_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          abn?: string | null
          acn?: string | null
          billing_address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_billable_expenses?: boolean | null
          default_billable_time?: boolean | null
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          name: string
          notes?: string | null
          payment_terms?: number | null
          trading_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          abn?: string | null
          acn?: string | null
          billing_address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_billable_expenses?: boolean | null
          default_billable_time?: boolean | null
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          name?: string
          notes?: string | null
          payment_terms?: number | null
          trading_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          abn: string | null
          address: string | null
          app_name: string | null
          created_at: string
          currency: string | null
          currency_locale: string | null
          default_billable_expenses: boolean | null
          default_billable_time: boolean | null
          default_billing_in_advance: boolean | null
          default_hourly_rate: number | null
          default_payment_terms: number | null
          default_role_id: string | null
          default_tax_rate: number | null
          default_tax_rate_id: string | null
          email: string | null
          favicon_url: string | null
          id: string
          invoice_next_number: number | null
          invoice_prefix: string | null
          logo_url: string | null
          name: string
          phone: string | null
          setup_completed: boolean | null
          trading_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          abn?: string | null
          address?: string | null
          app_name?: string | null
          created_at?: string
          currency?: string | null
          currency_locale?: string | null
          default_billable_expenses?: boolean | null
          default_billable_time?: boolean | null
          default_billing_in_advance?: boolean | null
          default_hourly_rate?: number | null
          default_payment_terms?: number | null
          default_role_id?: string | null
          default_tax_rate?: number | null
          default_tax_rate_id?: string | null
          email?: string | null
          favicon_url?: string | null
          id?: string
          invoice_next_number?: number | null
          invoice_prefix?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          setup_completed?: boolean | null
          trading_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          abn?: string | null
          address?: string | null
          app_name?: string | null
          created_at?: string
          currency?: string | null
          currency_locale?: string | null
          default_billable_expenses?: boolean | null
          default_billable_time?: boolean | null
          default_billing_in_advance?: boolean | null
          default_hourly_rate?: number | null
          default_payment_terms?: number | null
          default_role_id?: string | null
          default_tax_rate?: number | null
          default_tax_rate_id?: string | null
          email?: string | null
          favicon_url?: string | null
          id?: string
          invoice_next_number?: number | null
          invoice_prefix?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          setup_completed?: boolean | null
          trading_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_default_role_id_fkey"
            columns: ["default_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_default_tax_rate_id_fkey"
            columns: ["default_tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          date: string
          description: string
          id: string
          is_billable: boolean | null
          is_reimbursement: boolean | null
          job_id: string | null
          receipt_url: string | null
          user_id: string | null
          vendor_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          date: string
          description: string
          id?: string
          is_billable?: boolean | null
          is_reimbursement?: boolean | null
          job_id?: string | null
          receipt_url?: string | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          is_billable?: boolean | null
          is_reimbursement?: boolean | null
          job_id?: string | null
          receipt_url?: string | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          job_id: string | null
          movement_date: string | null
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          quantity: number
          reference: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          job_id?: string | null
          movement_date?: string | null
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          quantity: number
          reference?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          job_id?: string | null
          movement_date?: string | null
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          quantity?: number
          reference?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          account_id: string | null
          created_at: string
          description: string
          expense_id: string | null
          id: string
          invoice_id: string
          item_id: string | null
          job_asset_id: string | null
          line_total: number
          quantity: number
          sort_order: number | null
          tax_name: string | null
          tax_rate: number | null
          tax_rate_id: string | null
          timesheet_id: string | null
          unit: string | null
          unit_price: number
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          description: string
          expense_id?: string | null
          id?: string
          invoice_id: string
          item_id?: string | null
          job_asset_id?: string | null
          line_total: number
          quantity?: number
          sort_order?: number | null
          tax_name?: string | null
          tax_rate?: number | null
          tax_rate_id?: string | null
          timesheet_id?: string | null
          unit?: string | null
          unit_price: number
        }
        Update: {
          account_id?: string | null
          created_at?: string
          description?: string
          expense_id?: string | null
          id?: string
          invoice_id?: string
          item_id?: string | null
          job_asset_id?: string | null
          line_total?: number
          quantity?: number
          sort_order?: number | null
          tax_name?: string | null
          tax_rate?: number | null
          tax_rate_id?: string | null
          timesheet_id?: string | null
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_job_asset_id_fkey"
            columns: ["job_asset_id"]
            isOneToOne: false
            referencedRelation: "job_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          client_id: string
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          job_id: string | null
          notes: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          job_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          job_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_assets: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          issue_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          issue_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          issue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_assets_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_bookmark_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          source_issue_id: string
          target_bookmark_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          source_issue_id: string
          target_bookmark_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          source_issue_id?: string
          target_bookmark_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_bookmark_links_source_issue_id_fkey"
            columns: ["source_issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_bookmark_links_target_bookmark_id_fkey"
            columns: ["target_bookmark_id"]
            isOneToOne: false
            referencedRelation: "issue_bookmarks"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_bookmarks: {
        Row: {
          bookmark_label: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          issue_id: string
        }
        Insert: {
          bookmark_label: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          issue_id: string
        }
        Update: {
          bookmark_label?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          issue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_bookmarks_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          issue_id: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          issue_id: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          issue_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_comments_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_items: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_items_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_jobs: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          job_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          job_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_jobs_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          asset_id: string | null
          assignee_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          first_response_date: string | null
          id: string
          job_id: string | null
          purchase_id: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          asset_id?: string | null
          assignee_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          first_response_date?: string | null
          id?: string
          job_id?: string | null
          purchase_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          asset_id?: string | null
          assignee_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          first_response_date?: string | null
          id?: string
          job_id?: string | null
          purchase_id?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      item_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          item_id: string
          new_sales_price: number | null
          new_unit_cost: number | null
          old_sales_price: number | null
          old_unit_cost: number | null
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          item_id: string
          new_sales_price?: number | null
          new_unit_cost?: number | null
          old_sales_price?: number | null
          old_unit_cost?: number | null
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          item_id?: string
          new_sales_price?: number | null
          new_unit_cost?: number | null
          old_sales_price?: number | null
          old_unit_cost?: number | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string | null
          created_at: string
          current_stock: number | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          reorder_level: number | null
          sales_price: number | null
          sku: string
          unit: string | null
          unit_cost: number | null
          updated_at: string
          user_id: string | null
          vendor_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_stock?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          reorder_level?: number | null
          sales_price?: number | null
          sku: string
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
          user_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          current_stock?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          reorder_level?: number | null
          sales_price?: number | null
          sku?: string
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
          user_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assets: {
        Row: {
          asset_id: string
          billing_day: number
          billing_frequency: string
          billing_in_advance: boolean
          created_at: string
          id: string
          invoice_lead_days: number
          is_active: boolean
          job_id: string
          next_invoice_date: string | null
          rental_end_date: string | null
          rental_rate: number
          rental_start_date: string
        }
        Insert: {
          asset_id: string
          billing_day?: number
          billing_frequency?: string
          billing_in_advance?: boolean
          created_at?: string
          id?: string
          invoice_lead_days?: number
          is_active?: boolean
          job_id: string
          next_invoice_date?: string | null
          rental_end_date?: string | null
          rental_rate: number
          rental_start_date: string
        }
        Update: {
          asset_id?: string
          billing_day?: number
          billing_frequency?: string
          billing_in_advance?: boolean
          created_at?: string
          id?: string
          invoice_lead_days?: number
          is_active?: boolean
          job_id?: string
          next_invoice_date?: string | null
          rental_end_date?: string | null
          rental_rate?: number
          rental_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          billing_day: number | null
          budget: number | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          hourly_rate: number | null
          id: string
          invoice_lead_days: number | null
          is_recurring: boolean | null
          job_number: string
          location_id: string | null
          name: string
          next_invoice_date: string | null
          recurring_rate: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["job_status"]
          tags: string[] | null
          trading_name_id: string | null
          updated_at: string
        }
        Insert: {
          billing_day?: number | null
          budget?: number | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          invoice_lead_days?: number | null
          is_recurring?: boolean | null
          job_number: string
          location_id?: string | null
          name: string
          next_invoice_date?: string | null
          recurring_rate?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tags?: string[] | null
          trading_name_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_day?: number | null
          budget?: number | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          invoice_lead_days?: number | null
          is_recurring?: boolean | null
          job_number?: string
          location_id?: string | null
          name?: string
          next_invoice_date?: string | null
          recurring_rate?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tags?: string[] | null
          trading_name_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_trading_name_id_fkey"
            columns: ["trading_name_id"]
            isOneToOne: false
            referencedRelation: "trading_names"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          id: string
          is_system: boolean | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          entry_date: string
          id?: string
          is_system?: boolean | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          id?: string
          is_system?: boolean | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: []
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number | null
          debit: number | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number | null
          debit?: number | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number | null
          debit?: number | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_article_history: {
        Row: {
          api_key_id: string | null
          article_id: string
          changed_by: string | null
          created_at: string
          description: string | null
          event_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          api_key_id?: string | null
          article_id: string
          changed_by?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          api_key_id?: string | null
          article_id?: string
          changed_by?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_history_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_article_history_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_article_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_article_issues: {
        Row: {
          applied_at: string
          applied_by: string | null
          article_id: string
          helped_resolve: boolean | null
          id: string
          issue_id: string
          link_type: string
          stage_notes: string | null
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          article_id: string
          helped_resolve?: boolean | null
          id?: string
          issue_id: string
          link_type?: string
          stage_notes?: string | null
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          article_id?: string
          helped_resolve?: boolean | null
          id?: string
          issue_id?: string
          link_type?: string
          stage_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_article_issues_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_article_issues_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_article_issues_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          slug: string | null
          status: string
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          updated_by: string | null
          view_count: number | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          slug?: string | null
          status?: string
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          updated_by?: string | null
          view_count?: number | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          slug?: string | null
          status?: string
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_attachments: {
        Row: {
          article_id: string
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          article_id: string
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          article_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_attachments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "kb_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      location_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean | null
          location_id: string
          name: string
          phone: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          location_id: string
          name: string
          phone?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          location_id?: string
          name?: string
          phone?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_contacts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          location_type: string | null
          longitude: number | null
          name: string
          notes: string | null
          phone: string | null
          postcode: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          location_type?: string | null
          longitude?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          location_type?: string | null
          longitude?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_history: {
        Row: {
          api_key_id: string | null
          changed_by: string | null
          created_at: string | null
          description: string
          event_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          profile_id: string
        }
        Insert: {
          api_key_id?: string | null
          changed_by?: string | null
          created_at?: string | null
          description: string
          event_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          profile_id: string
        }
        Update: {
          api_key_id?: string | null
          changed_by?: string | null
          created_at?: string | null
          description?: string
          event_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_history_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          birthday: string | null
          created_at: string
          department: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          job_title: string | null
          notes: string | null
          phone: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          department?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id: string
          is_active?: boolean | null
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          department?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_allocations: {
        Row: {
          allocation_type: string
          amount: number
          created_at: string
          description: string | null
          id: string
          item_id: string | null
          job_id: string | null
          purchase_id: string
          quantity: number | null
        }
        Insert: {
          allocation_type: string
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          item_id?: string | null
          job_id?: string | null
          purchase_id: string
          quantity?: number | null
        }
        Update: {
          allocation_type?: string
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          item_id?: string | null
          job_id?: string | null
          purchase_id?: string
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_allocations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_allocations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_allocations_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
          reference: string | null
          tax_amount: number | null
          total: number
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date?: string
          description: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reference?: string | null
          tax_amount?: number | null
          total: number
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reference?: string | null
          tax_amount?: number | null
          total?: number
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          category: string | null
          display_name: string
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          category?: string | null
          display_name: string
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          category?: string | null
          display_name?: string
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission: Database["public"]["Enums"]["permission_level"] | null
          resource_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["permission_level"] | null
          resource_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["permission_level"] | null
          resource_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          rate: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          rate: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          rate?: number
          user_id?: string | null
        }
        Relationships: []
      }
      timesheets: {
        Row: {
          category: string | null
          created_at: string
          date: string
          description: string | null
          hours: number
          id: string
          is_billable: boolean | null
          job_id: string
          rate_override: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          date: string
          description?: string | null
          hours: number
          id?: string
          is_billable?: boolean | null
          job_id: string
          rate_override?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          hours?: number
          id?: string
          is_billable?: boolean | null
          job_id?: string
          rate_override?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_names: {
        Row: {
          abn: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_bsb: string | null
          bank_name: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          other_payment_details: string | null
          paypal_email: string | null
          user_id: string | null
        }
        Insert: {
          abn?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_bsb?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          other_payment_details?: string | null
          paypal_email?: string | null
          user_id?: string | null
        }
        Update: {
          abn?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_bsb?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          other_payment_details?: string | null
          paypal_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_item_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          last_used_at: string
          notes: string | null
          quantity_multiplier: number
          vendor_id: string | null
          vendor_item_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          last_used_at?: string
          notes?: string | null
          quantity_multiplier?: number
          vendor_id?: string | null
          vendor_item_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          last_used_at?: string
          notes?: string | null
          quantity_multiplier?: number
          vendor_id?: string | null
          vendor_item_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_item_mappings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_item_mappings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          credit_balance: number | null
          id: string
          is_active: boolean | null
          location_id: string | null
          name: string
          notes: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          credit_balance?: number | null
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          name: string
          notes?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          credit_balance?: number | null
          id?: string
          is_active?: boolean | null
          location_id?: string | null
          name?: string
          notes?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read: { Args: { _resource_name: string }; Returns: boolean }
      can_write: { Args: { _resource_name: string }; Returns: boolean }
      get_user_permission: {
        Args: { _resource_name: string; _user_id: string }
        Returns: Database["public"]["Enums"]["permission_level"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_owner: { Args: { _user_id: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      is_setup_complete: { Args: never; Returns: boolean }
      validate_api_key: {
        Args: { raw_key: string }
        Returns: {
          key_api_key_id: string
          key_scopes: string[]
          key_user_id: string
        }[]
      }
    }
    Enums: {
      account_type:
        | "income"
        | "cogs"
        | "expense"
        | "asset"
        | "liability"
        | "equity"
      app_role: "owner" | "admin" | "staff" | "readonly"
      asset_status: "in_service" | "spare" | "retired"
      invoice_status:
        | "draft"
        | "sent"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "void"
        | "written_off"
      issue_severity: "low" | "medium" | "high" | "critical"
      issue_status: "open" | "in_progress" | "resolved" | "closed"
      job_status: "prospect" | "active" | "on_hold" | "complete" | "archived"
      movement_type: "purchase" | "adjust" | "consume" | "return"
      permission_level: "none" | "read" | "write"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: [
        "income",
        "cogs",
        "expense",
        "asset",
        "liability",
        "equity",
      ],
      app_role: ["owner", "admin", "staff", "readonly"],
      asset_status: ["in_service", "spare", "retired"],
      invoice_status: [
        "draft",
        "sent",
        "partially_paid",
        "paid",
        "overdue",
        "void",
        "written_off",
      ],
      issue_severity: ["low", "medium", "high", "critical"],
      issue_status: ["open", "in_progress", "resolved", "closed"],
      job_status: ["prospect", "active", "on_hold", "complete", "archived"],
      movement_type: ["purchase", "adjust", "consume", "return"],
      permission_level: ["none", "read", "write"],
    },
  },
} as const

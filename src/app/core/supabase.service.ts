import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = this.createSupabaseClient();

  private createSupabaseClient(): SupabaseClient {
    const { supabaseUrl, supabaseAnonKey } = environment;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Supabase credentials are missing. ' +
          'Fill in supabaseUrl and supabaseAnonKey in src/environments/environment.ts (see .env.example).',
      );
    }
    return createClient(supabaseUrl, supabaseAnonKey);
  }
}

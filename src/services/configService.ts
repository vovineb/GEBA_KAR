import { parseAppConfig, type AppConfig } from '@/config/appConfig';
import { unwrap } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export async function fetchAppConfig(): Promise<AppConfig> {
  const rows = unwrap(await supabase.from('configuration').select('key, value'));
  return parseAppConfig(rows);
}

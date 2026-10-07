import {readFile} from 'node:fs/promises';

export const API_CONFIG_FIELDS = Object.freeze([
  'migration_role_superuser', 'migration_role_createrole', 'authenticator_exists',
  'authenticator_superuser', 'authenticator_direct_admin_option', 'supautils_loaded',
  'supautils_privileged_role_available', 'authenticator_reserved_unconfigurable',
  'authenticator_reserved_configurable', 'supautils_lists_have_supported_simple_syntax',
  'pgrst_db_schemas_config_allowed', 'supautils_role_config_elevation_metadata_available',
  'authenticator_schema_override_present', 'authenticator_database_specific_schema_override_present',
  'authenticator_override_includes_api', 'authenticator_override_includes_private_cluvo_schema',
  'authenticator_override_only_allowlisted_schemas', 'api_schema_exists',
  'api_schema_usage_anon', 'api_schema_usage_authenticated',
]);

export function apiConfigMetadata(data) {
  if (!data || API_CONFIG_FIELDS.some((field) => typeof data[field] !== 'boolean')) return null;
  return {...Object.fromEntries(API_CONFIG_FIELDS.map((field) => [field, data[field]])),
    capability_basis:'provider_source_and_read_only_metadata', ddl_executed:false,
    actual_config_change_verified:false};
}

export const readApiConfigQuery = () => readFile(new URL('./staging-api-config-metadata.sql', import.meta.url), 'utf8');

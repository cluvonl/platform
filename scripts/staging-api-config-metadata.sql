-- SELECT-only capability context; no role/GUC values or provider bodies returned.
-- Intended for the existing pinned, verify-full, read-only staging preflight.
-- Positive supautils metadata is an inference, not an executed DDL proof.
with settings as (
  select
    (current_setting('shared_preload_libraries') || ',' ||
     current_setting('session_preload_libraries') || ',' ||
     current_setting('local_preload_libraries'))
      ~ '(^|,)\s*supautils\s*(,|$)' as supautils_loaded,
    coalesce(current_setting('supautils.privileged_role', true), '') as privileged_role,
    coalesce(current_setting('supautils.reserved_roles', true), '') as reserved_roles,
    coalesce(current_setting('supautils.privileged_role_allowed_configs', true), '') as allowed_configs
), reserved as (
  select btrim(token) as token
  from settings cross join lateral regexp_split_to_table(reserved_roles, ',') token
  where btrim(token) <> ''
), configs as (
  select btrim(token) as token
  from settings cross join lateral regexp_split_to_table(allowed_configs, ',') token
  where btrim(token) <> ''
), capability as (
  select
    settings.supautils_loaded,
    coalesce((select pg_has_role(current_user, oid, 'USAGE')
              from pg_roles where rolname = settings.privileged_role), false)
      as privileged_role_available,
    exists(select 1 from reserved where token = 'authenticator')
      as authenticator_reserved_unconfigurable,
    exists(select 1 from reserved where token = 'authenticator*')
      as authenticator_reserved_configurable,
    not exists(select 1 from reserved where token !~ '^[a-z_][a-z0-9_.]*(\*)?$')
      and not exists(select 1 from configs where token !~ '^[a-z_][a-z0-9_.]*(\*)?$')
      as supautils_lists_have_supported_simple_syntax,
    exists(select 1 from configs where token = 'pgrst.db_schemas'
      or (length(token) > 1 and right(token, 1) = '*'
          and left('pgrst.db_schemas', length(token) - 1) = left(token, length(token) - 1)))
      as pgrst_db_schemas_config_allowed
  from settings
), role_override as (
  select r.setdatabase,
    substring(item from length('pgrst.db_schemas=') + 1) as schemas
  from pg_db_role_setting r
  join pg_roles role on role.oid = r.setrole and role.rolname = 'authenticator'
  cross join lateral unnest(r.setconfig) item
  where split_part(item, '=', 1) = 'pgrst.db_schemas'
    and r.setdatabase in (0, (select oid from pg_database where datname = current_database()))
), effective_override as (
  select schemas from role_override order by setdatabase <> 0 desc limit 1
), override_tokens as (
  select btrim(token) as token
  from effective_override cross join lateral regexp_split_to_table(schemas, ',') token
)
select json_build_object(
  'migration_role_superuser', coalesce((select rolsuper from pg_roles where rolname = current_user), false),
  'migration_role_createrole', coalesce((select rolcreaterole from pg_roles where rolname = current_user), false),
  'authenticator_exists', exists(select 1 from pg_roles where rolname = 'authenticator'),
  'authenticator_superuser', coalesce((select rolsuper from pg_roles where rolname = 'authenticator'), false),
  'authenticator_direct_admin_option', exists(select 1 from pg_auth_members m
    join pg_roles target on target.oid = m.roleid and target.rolname = 'authenticator'
    join pg_roles actor on actor.oid = m.member and actor.rolname = current_user
    where m.admin_option),
  'supautils_loaded', capability.supautils_loaded,
  'supautils_privileged_role_available', capability.privileged_role_available,
  'authenticator_reserved_unconfigurable', capability.authenticator_reserved_unconfigurable,
  'authenticator_reserved_configurable', capability.authenticator_reserved_configurable,
  'supautils_lists_have_supported_simple_syntax', capability.supautils_lists_have_supported_simple_syntax,
  'pgrst_db_schemas_config_allowed', capability.pgrst_db_schemas_config_allowed,
  'supautils_role_config_elevation_metadata_available',
    capability.supautils_loaded and capability.privileged_role_available
    and capability.supautils_lists_have_supported_simple_syntax
    and not capability.authenticator_reserved_unconfigurable
    and capability.pgrst_db_schemas_config_allowed
    and exists(select 1 from pg_roles where rolname = 'authenticator'),
  'authenticator_schema_override_present', exists(select 1 from role_override),
  'authenticator_database_specific_schema_override_present', exists(select 1 from role_override where setdatabase <> 0),
  'authenticator_override_includes_api', exists(select 1 from override_tokens where token = 'api'),
  'authenticator_override_includes_private_cluvo_schema', exists(select 1 from override_tokens where token in ('app', 'internal')),
  'authenticator_override_only_allowlisted_schemas', exists(select 1 from effective_override)
    and not exists(select 1 from override_tokens where token not in ('api', 'public', 'graphql_public')),
  'api_schema_exists', exists(select 1 from pg_namespace where nspname = 'api'),
  'api_schema_usage_anon', coalesce((select has_schema_privilege(role.oid, schema.oid, 'USAGE')
    from pg_roles role cross join pg_namespace schema
    where role.rolname = 'anon' and schema.nspname = 'api'), false),
  'api_schema_usage_authenticated', coalesce((select has_schema_privilege(role.oid, schema.oid, 'USAGE')
    from pg_roles role cross join pg_namespace schema
    where role.rolname = 'authenticated' and schema.nspname = 'api'), false)
) from capability;

-- One brand list for every board ("brand universe"): renaming a brand now carries through.
-- Boards store a brand as its NAME in tasks.custom (one value per brand-type field), and routing rules
-- (custom_automations.conditions) list brand names. Until now a rename in the brand list left both behind.
-- AFTER UPDATE OF name ON brands:
--   * every task value equal to the old name, on every brand-type field of the company, becomes the new name
--     (a JSON array value has its matching elements replaced);
--   * every routing rule that lists the old name lists the new one;
--   * the old name is kept as an alias, so imports and CUSP / NiRM names still find the brand.
-- The task rewrite is bookkeeping, not work: task triggers (history, automations, notifications) are
-- switched off for the rewrite only: ALTER TABLE tasks DISABLE/ENABLE TRIGGER USER inside the same transaction
-- (session_replication_role is not allowed to the postgres role here). Other sessions never see the triggers off,
-- but writes to tasks wait for the second or two the rename takes.
create or replace function public.brand_rename_propagate()
returns trigger language plpgsql security definer set search_path = public as $$
declare f record;
begin
  if new.name is not distinct from old.name or old.name is null or trim(old.name) = '' then return new; end if;
  alter table public.tasks disable trigger user;
  begin
    for f in select pf.id::text fid, pf.project_id from project_fields pf join projects p on p.id = pf.project_id
              where pf.ftype = 'brand' and p.company_id = new.company_id loop
      update tasks t set custom = jsonb_set(t.custom, array[f.fid], to_jsonb(new.name))
       where t.project_id = f.project_id and jsonb_typeof(t.custom->f.fid) = 'string' and t.custom->>f.fid = old.name;
      update tasks t set custom = jsonb_set(t.custom, array[f.fid],
               (select jsonb_agg(case when e #>> '{}' = old.name then to_jsonb(new.name) else e end) from jsonb_array_elements(t.custom->f.fid) e))
       where t.project_id = f.project_id and jsonb_typeof(t.custom->f.fid) = 'array' and t.custom->f.fid ? old.name;
    end loop;
    update custom_automations c set conditions = (
      select jsonb_agg(case when jsonb_typeof(cond->'v') = 'array' and cond->'v' ? old.name
                             and exists (select 1 from project_fields pf where 'field:' || pf.id::text = cond->>'k' and pf.ftype = 'brand')
               then jsonb_set(cond, '{v}', (select jsonb_agg(distinct case when x = old.name then new.name else x end) from jsonb_array_elements_text(cond->'v') x))
               else cond end order by ord)
        from jsonb_array_elements(c.conditions) with ordinality a(cond, ord))
     where c.company_id = new.company_id and jsonb_typeof(c.conditions) = 'array' and c.conditions::text like '%' || replace(replace(to_jsonb(old.name)::text, '\', '\\'), '%', '\%') || '%';
  exception when others then
    alter table public.tasks enable trigger user;
    raise;
  end;
  alter table public.tasks enable trigger user;
  return new;
end $$;

-- BEFORE: keep the old name as an alias (and drop the new name from the aliases if it was one).
create or replace function public.brand_rename_alias()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.name is distinct from old.name and coalesce(trim(old.name), '') <> '' then
    new.aliases := (select coalesce(array_agg(distinct a), '{}') from unnest(coalesce(new.aliases, '{}') || old.name) a
                     where lower(trim(a)) <> lower(trim(new.name)));
  end if;
  return new;
end $$;

drop trigger if exists brands_rename_alias on public.brands;
create trigger brands_rename_alias before update of name on public.brands for each row execute function public.brand_rename_alias();
drop trigger if exists brands_rename_propagate on public.brands;
create trigger brands_rename_propagate after update of name on public.brands for each row execute function public.brand_rename_propagate();
revoke all on function public.brand_rename_propagate() from public, anon, authenticated;
revoke all on function public.brand_rename_alias() from public, anon, authenticated;

-- Undo for 2026-11-03_brand_master.sql. Restores task brand values, automation conditions and brand rows from the backups.
begin;
set local session_replication_role = replica;
update tasks t set custom = jsonb_set(t.custom, array[b.field_id], to_jsonb(b.old_value))
  from brand_merge_backup_tasks b where t.id = b.task_id and t.custom->>b.field_id = b.new_value;
update custom_automations c set conditions = b.conditions from brand_merge_backup_autos b where c.id = b.id;
-- re-point links back to the original rows is not needed: merged rows still exist; restore their names/flags
update brands k set name=b.name, brand_group=b.brand_group, platforms=b.platforms, active=b.active, merged_into=null
  from brand_merge_backup_brands b where k.id = b.id;
delete from brands where id not in (select id from brand_merge_backup_brands)
  and not exists (select 1 from brand_stores s where s.brand_id = brands.id) and not exists (select 1 from brand_services s where s.brand_id = brands.id);
commit;

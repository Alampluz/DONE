-- Every board gets a code and every ticket a number (April, 19 Nov 2026).
-- Ticket numbers are <board code>-<YYMMDD of creation, Bangkok>-<running number of that board and day>,
-- assigned by assign_task_ticket_no() on insert. 113 of 134 boards had no code, so their tickets got no
-- number, and 9,872 tickets created before their board had a code never received one.
-- 1. Codes: initials of the board name (three letters of a one-word name), "S" + the code for a
--    "Subitems of …" board, at most 5 characters, made unique with a trailing digit. Owners can change a
--    code in the board's settings; existing ticket numbers keep the code they were given.
-- 2. Numbers: every ticket without one is numbered by its own creation date, continuing that board's
--    count for the day (task_no_seq, or the highest number already used that day, whichever is larger).
-- Task triggers are off for the numbering (no history rows, automations, notifications or updated_at bumps).
do $$
declare r record; nm text; w text[]; base text; code text; n int; is_sub boolean;
begin
  for r in select id, company_id, name from projects where nullif(btrim(key), '') is null
            order by (name ~* '^\s*subitems of'), created_at, name loop
    is_sub := r.name ~* '^\s*subitems of';
    nm := regexp_replace(r.name, '^\s*subitems of\s+', '', 'i');
    nm := regexp_replace(nm, '[^A-Za-z0-9 ]+', ' ', 'g');
    select coalesce(array_agg(x order by ord), '{}') into w
      from regexp_split_to_table(btrim(nm), '\s+') with ordinality t(x, ord)
     where x ~ '^[A-Za-z]' and lower(x) not in ('of','the','and','x','for','to','a','in','not','use','do','hrs');
    if coalesce(array_length(w, 1), 0) = 0 then base := 'BRD';
    elsif array_length(w, 1) = 1 then base := upper(left(w[1], 3));
    else base := upper((select string_agg(left(x, 1), '' order by ord) from unnest(w[1:4]) with ordinality u(x, ord)));
    end if;
    if length(base) < 2 then base := upper(left(w[1] || 'XX', 3)); end if;
    if is_sub then base := left('S' || base, 5); end if;
    code := base; n := 1;
    while exists (select 1 from projects p where p.company_id = r.company_id and upper(btrim(p.key)) = code) loop
      n := n + 1; code := left(base, 5 - length(n::text)) || n::text;
    end loop;
    update projects set key = code where id = r.id;
  end loop;

  alter table public.tasks disable trigger user;
  create temp table _num on commit drop as
    with u as (
      select t.id, t.project_id, upper(btrim(p.key)) k, (t.created_at at time zone 'Asia/Bangkok')::date d,
             row_number() over (partition by t.project_id, (t.created_at at time zone 'Asia/Bangkok')::date order by t.created_at, t.id) rn
        from tasks t join projects p on p.id = t.project_id
       where t.ticket_no is null and nullif(btrim(p.key), '') is not null),
    base as (
      select u.project_id, u.d, greatest(coalesce(max(s.last), 0),
               coalesce((select max(nullif(regexp_replace(x.ticket_no, '^.*-(\d+)$', '\1'), x.ticket_no)::int) from tasks x
                          where x.project_id = u.project_id and x.ticket_no like u.k || '-' || to_char(u.d, 'YYMMDD') || '-%'), 0)) b
        from u left join task_no_seq s on s.project_id = u.project_id and s.day = u.d group by u.project_id, u.d, u.k)
    select u.id, u.project_id, u.d, u.k, base.b + u.rn as num from u join base on base.project_id = u.project_id and base.d = u.d;
  update tasks t set ticket_no = v.k || '-' || to_char(v.d, 'YYMMDD') || '-' || case when v.num >= 1000 then v.num::text else lpad(v.num::text, 3, '0') end
    from _num v where t.id = v.id;
  insert into task_no_seq (project_id, day, last)
    select project_id, d, max(num) from _num group by project_id, d
    on conflict (project_id, day) do update set last = greatest(task_no_seq.last, excluded.last);
  alter table public.tasks enable trigger user;
end $$;

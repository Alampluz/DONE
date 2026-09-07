-- Applied 7 Sep 2026 (Supabase migration drop_public_board_sharing), same day as board_sharing.
-- April's call: DONE has no public / no-login board links. The endpoint is removed entirely rather
-- than just hidden, so nothing outside a login can ever read a board. No board had share_enabled
-- or a token, so no data was lost. "Send this board to colleagues" (share_board_with) is unaffected.
drop function if exists public.public_board(text);
alter table projects
  drop column if exists share_token,
  drop column if exists share_enabled,
  drop column if exists shared_at;

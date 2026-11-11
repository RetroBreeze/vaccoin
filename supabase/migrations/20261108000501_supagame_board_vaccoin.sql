-- Supagame leaderboard vaccoin; additive, immutable definition.
-- keepBest is always true; enforced by sg_submit_score.
do $supagame$
begin
  insert into public.game_leaderboards (id, kind, sort_direction, min_value, max_value, enabled)
  values (E'vaccoin', E'points', E'desc', 0, 1000000, true)
  on conflict (id) do nothing;

  perform 1 from public.game_leaderboards where id = E'vaccoin' for update;
  if not exists (
    select 1 from public.game_leaderboards
    where id = E'vaccoin' and kind = E'points' and sort_direction = E'desc'
      and min_value is not distinct from 0::bigint
      and max_value is not distinct from 1000000::bigint and enabled
  ) then
    raise exception 'SUPAGAME_LEADERBOARD_CONFLICT';
  end if;
end
$supagame$;

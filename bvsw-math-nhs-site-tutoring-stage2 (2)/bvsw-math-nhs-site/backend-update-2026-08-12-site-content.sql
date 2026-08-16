begin;

create table if not exists public.site_content (
  id smallint primary key default 1 check (id = 1),
  announcements jsonb not null default '[]'::jsonb check (jsonb_typeof(announcements) = 'array'),
  poster jsonb not null default '{}'::jsonb check (jsonb_typeof(poster) = 'object'),
  points_tracker_url text not null default '',
  board_year text not null default '',
  board_members jsonb not null default '[]'::jsonb check (jsonb_typeof(board_members) = 'array'),
  updated_at timestamptz not null default now()
);

insert into public.site_content
  (id, announcements, poster, points_tracker_url, board_year, board_members)
values
  (
    1,
    '[
      {"tag":"Event","title":"Pi Day Volunteering","description":"8 points for volunteering, 4 points per prep day. Exact volunteer dates will be announced closer to March."},
      {"tag":"Reminder","title":"Posters due the 30th","description":"One math-themed poster per month, 8.5×11\". Worth 1 point each."},
      {"tag":"Goal","title":"Growing our tutoring program","description":"Request one-on-one help with current math homework and concepts on Tuesdays or Thursdays."},
      {"tag":"Meetings","title":"Monthly club meetings","description":"Get updates, meet math-field professionals, and join member-led games and activities."}
    ]'::jsonb,
    '{"month":"October poster","theme":"Make math worth stopping for","description":"Design a fun math problem, brain teaser, or joke that can challenge someone, make them think, or make them laugh between classes. Posters are worth 1 point, with one submission allowed per month.","due":"October submission"}'::jsonb,
    'https://docs.google.com/spreadsheets/d/1Z-l6_yCCz1bEhTicIFYdUuqfVp-BdunP-K42OmWCQtg/edit?usp=sharing',
    '2026–2027',
    '[]'::jsonb
  )
on conflict (id) do nothing;

alter table public.site_content enable row level security;
revoke all on table public.site_content from anon;
revoke all on table public.site_content from authenticated;
grant select on table public.site_content to anon, authenticated;
grant insert, update on table public.site_content to authenticated;

drop policy if exists "Site content is publicly readable" on public.site_content;
create policy "Site content is publicly readable"
on public.site_content for select
to anon, authenticated
using (id = 1);

drop policy if exists "Officers can insert site content" on public.site_content;
create policy "Officers can insert site content"
on public.site_content for insert
to authenticated
with check (
  id = 1 and exists (
    select 1 from public.officers
    where officers.user_id = (select auth.uid())
  )
);

drop policy if exists "Officers can update site content" on public.site_content;
create policy "Officers can update site content"
on public.site_content for update
to authenticated
using (
  id = 1 and exists (
    select 1 from public.officers
    where officers.user_id = (select auth.uid())
  )
)
with check (
  id = 1 and exists (
    select 1 from public.officers
    where officers.user_id = (select auth.uid())
  )
);

commit;

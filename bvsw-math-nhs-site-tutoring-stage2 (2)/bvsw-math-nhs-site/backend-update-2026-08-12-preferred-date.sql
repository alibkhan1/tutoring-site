-- Store tutoring requests as dates so students do not have to choose a time.
-- Existing requests keep their legacy requested_start value for portal compatibility.

alter table public.tutoring_requests
  add column if not exists requested_date date;

alter table public.tutoring_requests
  drop constraint if exists tutoring_requests_requested_date_weekday_check;

alter table public.tutoring_requests
  add constraint tutoring_requests_requested_date_weekday_check
  check (
    requested_date is null
    or extract(dow from requested_date) in (2, 4)
  );

comment on column public.tutoring_requests.requested_date is
  'Student preferred tutoring date. Public form accepts Tuesdays and Thursdays only.';

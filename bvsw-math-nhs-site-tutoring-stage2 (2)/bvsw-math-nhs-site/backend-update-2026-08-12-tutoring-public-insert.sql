begin;

grant insert on table public.tutoring_requests to anon, authenticated;
grant usage, select on sequence public.tutoring_requests_id_seq to anon, authenticated;

drop policy if exists "Public can submit pending tutoring requests" on public.tutoring_requests;
create policy "Public can submit pending tutoring requests"
on public.tutoring_requests for insert
to anon, authenticated
with check (
  status = 'pending'
  and char_length(name) between 1 and 100
  and grade in ('9th', '10th', '11th', '12th')
  and char_length(math_class) between 1 and 150
  and char_length(email) between 3 and 254
  and requested_date is not null
  and requested_date >= current_date
  and requested_start is null
  and requested_duration_minutes in (30, 45, 60)
  and (topic is null or char_length(topic) <= 500)
  and remind_optin is null
  and confirmed_start is null
  and confirmed_end is null
  and assigned_tutor is null
  and officer_notes is null
  and outlook_event_id is null
  and confirmation_sent_at is null
  and reminder_sent_at is null
);

commit;

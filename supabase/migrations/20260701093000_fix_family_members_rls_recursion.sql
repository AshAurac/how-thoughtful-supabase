create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and lower(fm.email) = lower((select auth.jwt() ->> 'email'))
      and fm.invitation_state = 'accepted'
  );
$$;

create or replace function public.is_family_owner(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.families f
    where f.id = p_family_id
      and lower(f.owner_email) = lower((select auth.jwt() ->> 'email'))
  );
$$;

revoke all on function public.is_family_member(uuid) from public;
revoke all on function public.is_family_owner(uuid) from public;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.is_family_owner(uuid) to authenticated;

drop policy if exists "Family members can read families" on public.families;
create policy "Family members can read families" on public.families
  for select to authenticated
  using (
    lower(owner_email) = lower((select auth.jwt() ->> 'email'))
    or public.is_family_member(id)
  );

drop policy if exists "Family members can read membership" on public.family_members;
create policy "Family members can read membership" on public.family_members
  for select to authenticated
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or public.is_family_owner(family_id)
  );

drop policy if exists "Family owners manage membership" on public.family_members;
drop policy if exists "Family owners insert membership" on public.family_members;
drop policy if exists "Family owners update membership" on public.family_members;
drop policy if exists "Family owners delete membership" on public.family_members;
create policy "Family owners insert membership" on public.family_members
  for insert to authenticated
  with check (public.is_family_owner(family_id));

create policy "Family owners update membership" on public.family_members
  for update to authenticated
  using (public.is_family_owner(family_id))
  with check (public.is_family_owner(family_id));

create policy "Family owners delete membership" on public.family_members
  for delete to authenticated
  using (public.is_family_owner(family_id));

drop policy if exists "Family members manage kid profiles" on public.family_managed_profiles;
create policy "Family members manage kid profiles" on public.family_managed_profiles
  for all to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists "Family members read family events" on public.events;
create policy "Family members read family events" on public.events
  for select to authenticated
  using (
    visibility = 'family'
    and family_id is not null
    and public.is_family_member(family_id)
  );

drop policy if exists "Family members update family events" on public.events;
create policy "Family members update family events" on public.events
  for update to authenticated
  using (
    visibility = 'family'
    and family_id is not null
    and public.is_family_member(family_id)
  )
  with check (
    visibility in ('private', 'family')
    and family_id is not null
    and public.is_family_member(family_id)
  );

drop policy if exists "Family members read visible gifts" on public.gifts;
create policy "Family members read visible gifts" on public.gifts
  for select to authenticated
  using (
    not exists (
      select 1 from unnest(hidden_from_emails) as hidden(email)
      where lower(hidden.email) = lower((select auth.jwt() ->> 'email'))
    )
    and exists (
      select 1
      from public.events e
      where e.id = gifts.event_id
        and e.visibility = 'family'
        and e.family_id is not null
        and public.is_family_member(e.family_id)
    )
  );

drop policy if exists "Family members read family saved ideas" on public.saved_ideas;
create policy "Family members read family saved ideas" on public.saved_ideas
  for select to authenticated
  using (
    family_id is not null
    and public.is_family_member(family_id)
  );

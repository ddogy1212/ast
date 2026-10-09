-- Orbit Keepsake · Print Desk
-- Run once in Supabase SQL Editor. Supply admin email after the first run.
-- Participant photos are PRIVATE, not published to GitHub or a public bucket.
-- Enable Authentication > Providers > Anonymous sign-ins and Email sign-in.
-- Add https://ddogy1212.github.io/ast/admin.html to Authentication > URL Configuration redirect URLs.

create table if not exists public.print_admin_emails (
  email text primary key check (char_length(email) between 4 and 250),
  added_at timestamptz not null default now()
);
alter table public.print_admin_emails enable row level security;
revoke all on public.print_admin_emails from public, anon, authenticated;

create or replace function public.is_print_admin()
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select coalesce((auth.jwt()->>'is_anonymous')::boolean,false) = false
  and exists (
    select 1 from public.print_admin_emails
    where lower(email) = lower(auth.jwt()->>'email')
  );
$$;
revoke all on function public.is_print_admin() from public, anon;
grant execute on function public.is_print_admin() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('print-cards','print-cards',false,10485760,ARRAY['image/png'])
on conflict (id) do update set
  public=false,file_size_limit=10485760,allowed_mime_types=ARRAY['image/png'];

create table if not exists public.print_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nickname text not null check(char_length(nickname) between 1 and 24),
  file_path text unique not null,
  birthday_month smallint not null check(birthday_month between 1 and 12),
  birthday_day smallint not null check(birthday_day between 1 and 31),
  ratio text not null check(ratio in ('photocard','square','portrait','landscape','story')),
  status text not null default 'pending' check(status in ('pending','printing','done')),
  created_at timestamptz not null default now()
);
create index if not exists print_orders_created_at_idx on public.print_orders(created_at desc);
alter table public.print_orders enable row level security;
revoke all on public.print_orders from anon;
revoke insert, truncate, references, trigger on public.print_orders from authenticated;
grant select, update, delete on public.print_orders to authenticated;

drop policy if exists "Admin can read print orders" on public.print_orders;
create policy "Admin can read print orders" on public.print_orders
  for select to authenticated using (public.is_print_admin());
drop policy if exists "Admin can update print orders" on public.print_orders;
create policy "Admin can update print orders" on public.print_orders
  for update to authenticated using (public.is_print_admin()) with check (public.is_print_admin());
drop policy if exists "Admin can delete print orders" on public.print_orders;
create policy "Admin can delete print orders" on public.print_orders
  for delete to authenticated using (public.is_print_admin());

drop policy if exists "Anonymous can upload own card once" on storage.objects;
create policy "Anonymous can upload own card once" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'print-cards'
    and auth.uid() is not null
    and (auth.jwt()->>'is_anonymous') = 'true'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.png$'
  );
drop policy if exists "Admin may preview print cards" on storage.objects;
create policy "Admin may preview print cards" on storage.objects
  for select to authenticated using (
    bucket_id = 'print-cards' and public.is_print_admin()
  );
drop policy if exists "Admin may delete print cards" on storage.objects;
create policy "Admin may delete print cards" on storage.objects
  for delete to authenticated using (
    bucket_id = 'print-cards' and public.is_print_admin()
  );

create or replace function public.submit_print_order(
  p_file_path text,
  p_nickname text,
  p_month integer,
  p_day integer,
  p_ratio text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or (auth.jwt()->>'is_anonymous') is distinct from 'true' then
    raise exception 'Anonymous participant sign-in is required';
  end if;
  if p_file_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.png$'
     or split_part(p_file_path,'/',1) <> auth.uid()::text then
    raise exception 'Invalid upload path';
  end if;
  if char_length(btrim(p_nickname)) not between 1 and 24
    or p_month not between 1 and 12 or p_day not between 1 and 31
    or p_ratio not in ('photocard','square','portrait','landscape','story') then
    raise exception 'Invalid print request';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id='print-cards' and name=p_file_path and owner_id=auth.uid()::text
      and coalesce((metadata->>'size')::bigint,0) between 1024 and 10485760
  ) then
    raise exception 'Uploaded image was not found or is too large';
  end if;
  if (select count(*) from public.print_orders
      where user_id=auth.uid() and created_at>now()-interval '1 hour') >= 5 then
    raise exception 'Too many print requests; please try later';
  end if;
  insert into public.print_orders(user_id,nickname,file_path,birthday_month,birthday_day,ratio)
  values(auth.uid(),btrim(p_nickname),p_file_path,p_month,p_day,p_ratio)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_print_order(text,text,integer,integer,text) from public,anon;
grant execute on function public.submit_print_order(text,text,integer,integer,text) to authenticated;

-- IMPORTANT: After connecting Supabase, run this with your printer friend's actual email:
-- insert into public.print_admin_emails(email) values ('printer@example.com')
-- on conflict (email) do nothing;
-- Admin login uses verified email magic link, never passwords inside the website.
-- Data retention: the admin should delete completed orders and corresponding files promptly.

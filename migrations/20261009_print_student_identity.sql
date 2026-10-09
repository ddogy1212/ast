-- Applied to orbit-keepsake-print on 2026-10-09.
-- New print orders require a school number and full name, stored separately for printing.
alter table public.print_orders
  add column if not exists student_number text,
  add column if not exists student_name text;
alter table public.print_orders
  drop constraint if exists print_orders_student_number_format,
  add constraint print_orders_student_number_format check (student_number is null or student_number ~ '^[0-9]{4,8}$');
alter table public.print_orders
  drop constraint if exists print_orders_student_name_format,
  add constraint print_orders_student_name_format check (student_name is null or (char_length(btrim(student_name)) between 1 and 24));

create or replace function public.submit_print_order_with_student(
  p_file_path text, p_student_number text, p_student_name text,
  p_month integer, p_day integer, p_ratio text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null or (auth.jwt()->>'is_anonymous') is distinct from 'true' then
    raise exception 'Anonymous participant sign-in is required';
  end if;
  if p_file_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.png$'
     or split_part(p_file_path,'/',1) <> auth.uid()::text then
    raise exception 'Invalid upload path';
  end if;
  if p_student_number !~ '^[0-9]{4,8}$'
     or char_length(btrim(p_student_name)) not between 1 and 24
     or p_month not between 1 and 12 or p_day not between 1 and 31
     or p_ratio not in ('photocard','square','portrait','landscape','story') then
    raise exception 'Invalid print request';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id='print-cards' and name=p_file_path
      and owner_id=auth.uid()::text
      and coalesce((metadata->>'size')::bigint,0) between 1024 and 10485760
  ) then raise exception 'Uploaded image was not found or is too large'; end if;
  if (select count(*) from public.print_orders where user_id=auth.uid()
     and created_at > now()-interval '1 hour') >= 5 then
    raise exception 'Too many print requests; please try later';
  end if;
  insert into public.print_orders
    (user_id,nickname,student_number,student_name,file_path,birthday_month,birthday_day,ratio)
  values
    (auth.uid(),btrim(p_student_name),p_student_number,btrim(p_student_name),p_file_path,p_month,p_day,p_ratio)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_print_order_with_student(text,text,text,integer,integer,text) from public,anon;
grant execute on function public.submit_print_order_with_student(text,text,text,integer,integer,text) to authenticated;

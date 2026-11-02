-- Penryn Prep Art Exhibition: anonymous parent bidding (no parent accounts)
-- Run this in Supabase SQL Editor. It creates separate auction tables so existing
-- profiles/authentication tables are not deleted or modified.

create table if not exists public.auction_artworks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  image_url text,
  starting_bid numeric(10,2) not null default 0 check (starting_bid >= 0),
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.auction_artworks(id) on delete cascade,
  bidder_name text not null check (char_length(trim(bidder_name)) between 3 and 100),
  bidder_phone text not null check (char_length(trim(bidder_phone)) between 9 and 25),
  amount numeric(10,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.auction_artworks enable row level security;
alter table public.auction_bids enable row level security;

-- Public can see artwork, but only an authenticated admin can manage it.
drop policy if exists "Public can view active auction artworks" on public.auction_artworks;
create policy "Public can view active auction artworks" on public.auction_artworks
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage auction artworks" on public.auction_artworks;
create policy "Admins manage auction artworks" on public.auction_artworks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Bidder details are private: only authenticated admins may read bid rows.
drop policy if exists "Admins can view all auction bids" on public.auction_bids;
create policy "Admins can view all auction bids" on public.auction_bids
  for select to authenticated using (public.is_admin());
drop policy if exists "Admins manage auction bids" on public.auction_bids;
create policy "Admins manage auction bids" on public.auction_bids
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.auction_bids from anon, authenticated;
grant select on public.auction_artworks to anon, authenticated;
grant all on public.auction_artworks to authenticated;
grant select on public.auction_bids to authenticated;

-- Public summary returns only amount/count; it never returns bidder identity or phone.
create or replace function public.get_auction_summary(p_artwork_id uuid)
returns table(highest_bid numeric, bid_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(b.amount), a.starting_bid), count(b.id)
  from public.auction_artworks a
  left join public.auction_bids b on b.artwork_id = a.id
  where a.id = p_artwork_id
  group by a.starting_bid;
$$;

-- Secure bid submission: validates the auction and amount under a row lock.
create or replace function public.submit_auction_bid(
  p_artwork_id uuid,
  p_bidder_name text,
  p_bidder_phone text,
  p_amount numeric
)
returns table(bid_id uuid, accepted_amount numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artwork public.auction_artworks%rowtype;
  v_highest numeric;
  v_bid_id uuid;
begin
  if p_bidder_name is null or char_length(trim(p_bidder_name)) not between 3 and 100 then
    raise exception 'Please enter your full name.';
  end if;
  if p_bidder_phone is null or char_length(trim(p_bidder_phone)) not between 9 and 25 then
    raise exception 'Please enter a valid cellphone number.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a valid bid amount.';
  end if;

  select * into v_artwork from public.auction_artworks where id = p_artwork_id for update;
  if not found or not v_artwork.is_active then
    raise exception 'This auction is not available.';
  end if;
  if v_artwork.ends_at <= now() then
    raise exception 'This auction has ended.';
  end if;

  select coalesce(max(amount), v_artwork.starting_bid) into v_highest
  from public.auction_bids where artwork_id = p_artwork_id;
  if p_amount <= v_highest then
    raise exception 'Your bid must be higher than the current highest bid of R%.', v_highest;
  end if;

  insert into public.auction_bids(artwork_id,bidder_name,bidder_phone,amount)
  values(p_artwork_id,trim(p_bidder_name),trim(p_bidder_phone),p_amount)
  returning id into v_bid_id;
  return query select v_bid_id,p_amount;
end;
$$;

revoke all on function public.get_auction_summary(uuid) from public;
grant execute on function public.get_auction_summary(uuid) to anon, authenticated;
revoke all on function public.submit_auction_bid(uuid,text,text,numeric) from public;
grant execute on function public.submit_auction_bid(uuid,text,text,numeric) to anon, authenticated;

-- NOTE: Keep the existing admin profile and authentication. Parents do not need accounts.
-- Add artwork rows through an admin-only dashboard or the Supabase Table Editor.


-- Additional setup for the administrator dashboard.
alter table public.auction_bids
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending','paid')),
  add column if not exists collected boolean not null default false;

-- Public image bucket. Admin upload is allowed only to authenticated admins.
insert into storage.buckets (id, name, public)
values ('artwork-images', 'artwork-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view artwork images" on storage.objects;
create policy "Public can view artwork images" on storage.objects
for select to anon, authenticated
using (bucket_id = 'artwork-images');

drop policy if exists "Admins upload artwork images" on storage.objects;
create policy "Admins upload artwork images" on storage.objects
for insert to authenticated
with check (bucket_id = 'artwork-images' and public.is_admin());

drop policy if exists "Admins update artwork images" on storage.objects;
create policy "Admins update artwork images" on storage.objects
for update to authenticated
using (bucket_id = 'artwork-images' and public.is_admin())
with check (bucket_id = 'artwork-images' and public.is_admin());

drop policy if exists "Admins delete artwork images" on storage.objects;
create policy "Admins delete artwork images" on storage.objects
for delete to authenticated
using (bucket_id = 'artwork-images' and public.is_admin());


begin;
create table public.store_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 product text not null check (product in ('jacall-plus','call-pro')),
 amount_cents integer not null check ((product='jacall-plus' and amount_cents=990) or (product='call-pro' and amount_cents=1490)),
 checkout_id text unique,
 payment_id text unique,
 status text not null default 'pending' check (status in ('pending','paid','canceled','expired','revoked')),
 created_at timestamptz not null default now(),
 paid_at timestamptz,
 expires_at timestamptz
);
create index store_orders_owner_idx on public.store_orders(user_id,created_at desc);
alter table public.store_orders enable row level security;
revoke all on public.store_orders from public,anon,authenticated;
grant select on public.store_orders to authenticated;
grant select,insert,update,delete on public.store_orders to service_role;
create policy store_orders_own on public.store_orders for select to authenticated using (user_id=(select auth.uid()));
create table public.store_payment_events (
 id text primary key,
 created_at timestamptz not null default now()
);
alter table public.store_payment_events enable row level security;
revoke all on public.store_payment_events from public,anon,authenticated;
grant select,insert,update,delete on public.store_payment_events to service_role;
-- Only the server may call this function, after validating the provider notification.
create function public.store_apply_event(p_event text,p_order uuid,p_checkout text,p_payment text,p_status text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare o public.store_orders%rowtype;
begin
 select * into o from public.store_orders where id=p_order for update;
 if not found then return false; end if;
 if p_checkout is not null and o.checkout_id is distinct from p_checkout then return false; end if;
 if p_payment is not null and o.payment_id is not null and o.payment_id<>p_payment then return false; end if;
 if p_checkout is null and (p_payment is null or o.payment_id is distinct from p_payment) then return false; end if;
 if p_status not in ('paid','canceled','expired','revoked') then return false; end if;
 insert into public.store_payment_events(id) values(p_event) on conflict do nothing;
 if not found then return true; end if;
 if p_status='revoked' then
 update public.store_orders set status='revoked' where id=o.id;
 elsif p_status='paid' and o.status='pending' then
 update public.store_orders set status='paid',paid_at=now(),expires_at=now()+interval '30 days',payment_id=coalesce(p_payment,payment_id) where id=o.id;
 elsif p_status in ('canceled','expired') and o.status='pending' then
 update public.store_orders set status=p_status where id=o.id;
 end if;
 return true;
end;
$$;
revoke all on function public.store_apply_event(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.store_apply_event(text,uuid,text,text,text) to service_role;
commit;

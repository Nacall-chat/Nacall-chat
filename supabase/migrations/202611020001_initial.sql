-- Run once on a fresh Supabase project. All timestamps are UTC.
begin;
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
 display_name text not null check (char_length(display_name) between 2 and 60),
 bio text not null default '' check (char_length(bio)<=300), created_at timestamptz not null default now()
);
-- UUID username must fit the same constraint: use 20 random hex digits (80 bits).
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,username,display_name) values(new.id,'u_'||substr(replace(new.id::text,'-',''),1,20), 'Novo membro');
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.friendships (
 id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles on delete cascade,
 receiver_id uuid not null references public.profiles on delete cascade, status text not null default 'pending' check(status in ('pending','accepted')),
 created_at timestamptz not null default now(), check(sender_id<>receiver_id)
);
create unique index friendship_pair on public.friendships(least(sender_id,receiver_id),greatest(sender_id,receiver_id));
create index friendship_receiver on public.friendships(receiver_id);
create index friendship_sender on public.friendships(sender_id);
create table public.servers (
 id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 2 and 60),
 owner_id uuid not null references public.profiles on delete cascade, created_at timestamptz not null default now()
);
create table public.server_members (
 server_id uuid not null references public.servers on delete cascade, user_id uuid not null references public.profiles on delete cascade,
 joined_at timestamptz not null default now(), primary key(server_id,user_id)
);
create index member_user on public.server_members(user_id);
create table public.channels (
 id uuid primary key default gen_random_uuid(), server_id uuid not null references public.servers on delete cascade,
 name text not null check(char_length(name) between 2 and 60), kind text not null check(kind in ('text','voice')),
 created_at timestamptz not null default now()
);
create index channel_server on public.channels(server_id);
create table public.dms (
 id uuid primary key default gen_random_uuid(), user_a uuid not null references public.profiles on delete cascade,
 user_b uuid not null references public.profiles on delete cascade, check(user_a<user_b), unique(user_a,user_b)
);
create index dm_b on public.dms(user_b);
create table public.messages (
 id uuid primary key default gen_random_uuid(), author_id uuid not null default auth.uid() references public.profiles on delete cascade,
 channel_id uuid references public.channels on delete cascade, dm_id uuid references public.dms on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 4000), created_at timestamptz not null default now(),
 check(num_nonnulls(channel_id,dm_id)=1)
);
create index messages_channel_time on public.messages(channel_id,created_at desc);
create index messages_dm_time on public.messages(dm_id,created_at desc);
create table public.invites (
 code uuid primary key default gen_random_uuid(), server_id uuid not null references public.servers on delete cascade,
 expires_at timestamptz not null default now()+interval '7 days'
);
create index invite_server on public.invites(server_id);
create table public.voice_token_limits (user_id uuid primary key references public.profiles on delete cascade, window_start timestamptz not null, count integer not null);

-- Security-definer helpers avoid recursive RLS and always use auth.uid(), never a client user ID.
create function public.is_member(s uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.server_members where server_id=s and user_id=auth.uid()); $$;
create function public.is_owner(s uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.servers where id=s and owner_id=auth.uid()); $$;
create function public.can_dm(d uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.dms where id=d and auth.uid() in (user_a,user_b)); $$;
create function public.can_text(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.channels where id=c and kind='text' and public.is_member(server_id)); $$;

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.servers enable row level security;
alter table public.server_members enable row level security;
alter table public.channels enable row level security;
alter table public.dms enable row level security;
alter table public.messages enable row level security;
alter table public.invites enable row level security;
alter table public.voice_token_limits enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(true);
create policy profiles_edit on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy friendship_read on public.friendships for select to authenticated using(auth.uid() in(sender_id,receiver_id));
create policy friendship_request on public.friendships for insert to authenticated with check(sender_id=auth.uid() and status='pending');
-- Column grants below prevent changing either participant during acceptance.
create policy friendship_accept on public.friendships for update to authenticated using(receiver_id=auth.uid() and status='pending') with check(receiver_id=auth.uid() and status='accepted');
create policy friendship_remove on public.friendships for delete to authenticated using(auth.uid() in(sender_id,receiver_id));
create policy servers_read on public.servers for select to authenticated using(public.is_member(id));
create policy members_read on public.server_members for select to authenticated using(public.is_member(server_id));
create policy channels_read on public.channels for select to authenticated using(public.is_member(server_id));
create policy channels_create on public.channels for insert to authenticated with check(public.is_owner(server_id));
create policy dms_read on public.dms for select to authenticated using(auth.uid() in(user_a,user_b));
create policy messages_read on public.messages for select to authenticated using(public.can_text(channel_id) or public.can_dm(dm_id));
create policy messages_send on public.messages for insert to authenticated with check(author_id=auth.uid() and (public.can_text(channel_id) or public.can_dm(dm_id)));
create policy messages_delete on public.messages for delete to authenticated using(author_id=auth.uid() and (public.can_text(channel_id) or public.can_dm(dm_id)));
create policy invites_read on public.invites for select to authenticated using(public.is_owner(server_id));
create policy invites_create on public.invites for insert to authenticated with check(public.is_owner(server_id) and expires_at>now() and expires_at<=now()+interval '7 days');
create policy invites_revoke on public.invites for delete to authenticated using(public.is_owner(server_id));

create function public.create_server(server_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare s uuid;
begin
 if auth.uid() is null then raise exception 'Login necessário'; end if;
 insert into public.servers(name,owner_id) values(trim(server_name),auth.uid()) returning id into s;
 insert into public.server_members(server_id,user_id) values(s,auth.uid());
 insert into public.channels(server_id,name,kind) values(s,'geral','text'),(s,'Ponto de encontro','voice');
 return s;
end; $$;
create function public.join_server(invite_code uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare s uuid;
begin
 if auth.uid() is null then raise exception 'Login necessário'; end if;
 select server_id into s from public.invites where code=invite_code and expires_at>now();
 if s is null then raise exception 'Convite inválido ou expirado'; end if;
 insert into public.server_members(server_id,user_id) values(s,auth.uid()) on conflict do nothing;
 return s;
end; $$;
create function public.open_dm(friend_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare d uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.friendships where status='accepted' and least(sender_id,receiver_id)=least(auth.uid(),friend_id) and greatest(sender_id,receiver_id)=greatest(auth.uid(),friend_id)) then raise exception 'Adicione este usuário como amigo primeiro'; end if;
 insert into public.dms(user_a,user_b) values(least(auth.uid(),friend_id),greatest(auth.uid(),friend_id)) on conflict(user_a,user_b) do update set user_a=excluded.user_a returning id into d;
 return d;
end; $$;
create function public.allow_voice_token() returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
 if auth.uid() is null then return false; end if;
 insert into public.voice_token_limits values(auth.uid(),now(),1)
 on conflict(user_id) do update set
 count=case when public.voice_token_limits.window_start<now()-interval '1 minute' then 1 else public.voice_token_limits.count+1 end,
 window_start=case when public.voice_token_limits.window_start<now()-interval '1 minute' then now() else public.voice_token_limits.window_start end
 returning count into n;
 return n<=10;
end; $$;

-- Explicit grants: no service-role key required anywhere in the app.
revoke all on public.profiles,public.friendships,public.servers,public.server_members,public.channels,public.dms,public.messages,public.invites,public.voice_token_limits from anon,authenticated;
grant select on public.profiles,public.friendships,public.servers,public.server_members,public.channels,public.dms,public.messages,public.invites to authenticated;
grant update(username,display_name,bio) on public.profiles to authenticated;
grant insert(sender_id,receiver_id),delete on public.friendships to authenticated;
grant update(status) on public.friendships to authenticated;
grant insert(server_id,name,kind) on public.channels to authenticated;
grant insert(channel_id,dm_id,body),delete on public.messages to authenticated;
grant insert(server_id),delete on public.invites to authenticated;
revoke execute on function public.handle_new_user(),public.is_member(uuid),public.is_owner(uuid),public.can_dm(uuid),public.can_text(uuid),public.create_server(text),public.join_server(uuid),public.open_dm(uuid),public.allow_voice_token() from public,anon;
grant execute on function public.is_member(uuid),public.is_owner(uuid),public.can_dm(uuid),public.can_text(uuid),public.create_server(text),public.join_server(uuid),public.open_dm(uuid),public.allow_voice_token() to authenticated;
alter publication supabase_realtime add table public.messages,public.friendships;
commit;

begin;
-- Existing IDs, friendships, messages and ownership are preserved.
alter table public.profiles add column avatar_path text not null default ''
 check(avatar_path='' or avatar_path ~ ('^'||id::text||'/[a-zA-Z0-9_-]+[.]webp$'));
grant update(avatar_path) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare uname text; display text;
begin
 uname:=lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
 if uname !~ '^[a-z0-9_]{3,24}$' then uname:='u_'||substr(replace(new.id::text,'-',''),1,20); end if;
 display:=trim(coalesce(new.raw_user_meta_data->>'display_name','Jogador novo'));
 if char_length(display) not between 2 and 60 then display:='Jogador novo'; end if;
 insert into public.profiles(id,username,display_name) values(new.id,uname,display);
 return new;
end; $$;

-- These tables have no client policies: only the server service key has access.
create table public.auth_attempts(bucket text primary key, window_start timestamptz not null, attempts integer not null);
alter table public.auth_attempts enable row level security;
create table public.account_recovery(user_id uuid primary key references public.profiles on delete cascade, code_hash text not null, updated_at timestamptz not null default now());
alter table public.account_recovery enable row level security;
revoke all on public.auth_attempts,public.account_recovery from public,anon,authenticated;
grant all on public.auth_attempts,public.account_recovery to service_role;
grant select on public.profiles to service_role;
create function public.consume_auth_attempt(bucket_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if auth.role()<>'service_role' then return false; end if;
 if char_length(bucket_key)<>64 then return false; end if;
 insert into public.auth_attempts values(bucket_key,now(),1)
 on conflict(bucket) do update set
 attempts=case when public.auth_attempts.window_start<now()-interval '5 minutes' then 1 else public.auth_attempts.attempts+1 end,
 window_start=case when public.auth_attempts.window_start<now()-interval '5 minutes' then now() else public.auth_attempts.window_start end
 returning attempts into n;
 -- Opportunistic cleanup keeps abandoned IP buckets from growing forever.
 delete from public.auth_attempts where window_start<now()-interval '2 days';
 return n<=30;
end; $$;
revoke execute on function public.consume_auth_attempt(text) from public,anon,authenticated;
grant execute on function public.consume_auth_attempt(text) to service_role;

create table public.room_media (
 channel_id uuid primary key references public.channels on delete cascade,
 video_id text check(video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$'),
 playing boolean not null default false,
 position_seconds double precision not null default 0 check(position_seconds>=0 and position_seconds<86400 and position_seconds<>'NaN'::float8),
 updated_at timestamptz not null default now(), updated_by uuid references public.profiles on delete set null,
 revision bigint not null default 1
);
alter table public.room_media enable row level security;
revoke all on public.room_media from public,anon,authenticated;
grant select on public.room_media to authenticated;
create policy media_read on public.room_media for select to authenticated using(exists(select 1 from public.channels where id=channel_id and kind='voice' and public.is_member(server_id)));
create table public.media_limits(user_id uuid primary key references public.profiles on delete cascade, window_start timestamptz not null, attempts integer not null);
alter table public.media_limits enable row level security;
revoke all on public.media_limits from public,anon,authenticated;
create function public.set_room_media(room_channel uuid, youtube_id text, is_playing boolean, seek_seconds double precision, expected_revision bigint default null)
returns public.room_media language plpgsql security definer set search_path='' as $$
declare result public.room_media; requests integer;
begin
 if auth.uid() is null or not exists(select 1 from public.channels where id=room_channel and kind='voice' and public.is_member(server_id)) then raise exception 'Sem acesso à sala'; end if;
 insert into public.media_limits values(auth.uid(),now(),1) on conflict(user_id) do update set
 attempts=case when public.media_limits.window_start<now()-interval '1 minute' then 1 else public.media_limits.attempts+1 end,
 window_start=case when public.media_limits.window_start<now()-interval '1 minute' then now() else public.media_limits.window_start end
 returning attempts into requests;
 if requests>30 then raise exception 'Muitas mudanças na música. Espere um minuto.'; end if;
 if youtube_id is null then is_playing:=false; seek_seconds:=0; end if;
 insert into public.room_media(channel_id,video_id,playing,position_seconds,updated_by)
 values(room_channel,youtube_id,is_playing,seek_seconds,auth.uid())
 on conflict(channel_id) do update set video_id=excluded.video_id,playing=excluded.playing,
 position_seconds=excluded.position_seconds,updated_at=now(),updated_by=auth.uid(),revision=public.room_media.revision+1
 where expected_revision is null or public.room_media.revision=expected_revision
 returning * into result;
 if result.channel_id is null then raise exception 'Outra pessoa atualizou a música. Sincronize e tente de novo.'; end if;
 return result;
end; $$;
revoke execute on function public.set_room_media(uuid,text,boolean,double precision,bigint) from public,anon;
grant execute on function public.set_room_media(uuid,text,boolean,double precision,bigint) to authenticated;
alter publication supabase_realtime add table public.room_media;

-- Avatars are public profile images. Only the owner can write their own folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('avatars','avatars',true,1048576,array['image/webp']) on conflict(id) do nothing;
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='avatars');
create policy avatar_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text and lower(storage.extension(name))='webp');
create policy avatar_update on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
commit;

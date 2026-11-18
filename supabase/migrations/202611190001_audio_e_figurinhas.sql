-- Mensagens de áudio e figurinhas no chat existente (canais e DMs).
-- Aditiva: o app antigo continua enviando só texto; nada é apagado nem renomeado.
begin;

-- 1. Mensagens: o tipo e os metadados da mídia ficam em colunas próprias, nunca dentro de `body`.
alter table public.messages
 add column kind text not null default 'text',
 add column media_path text not null default '',
 add column media_duration_ms integer;
alter table public.messages alter column body set default '';
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_kind_check check(kind in ('text','audio','sticker'));
-- Cada tipo só aceita o seu formato. O caminho do arquivo carrega o autor e, no áudio, a conversa:
--   áudio:    <autor>/<canal ou DM>/<uuid>.<webm|ogg|m4a>   (bucket chat-audio)
--   figurinha: <autor>/<figurinha>.<webp|png|jpg|gif>       (bucket stickers)
alter table public.messages add constraint messages_content_check check(
 (kind='text' and char_length(trim(body)) between 1 and 4000 and media_path='' and media_duration_ms is null)
 or (kind='audio' and body='' and media_duration_ms is not null and media_duration_ms between 500 and 305000
  and media_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|ogg|m4a)$'
  and split_part(media_path,'/',1)=author_id::text and split_part(media_path,'/',2)=coalesce(channel_id,dm_id)::text)
 or (kind='sticker' and body='' and media_duration_ms is null
  and media_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|png|jpg|gif)$'
  and split_part(media_path,'/',1)=author_id::text));
create index messages_media_path on public.messages(media_path) where media_path<>'';
create index messages_author_media on public.messages(author_id,created_at desc) where kind<>'text';
grant insert(kind,media_path,media_duration_ms) on public.messages to authenticated;

-- Limite por usuário: no máximo 20 áudios/figurinhas por minuto.
create function public.limit_media_messages() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind<>'text' and (select count(*) from public.messages where author_id=new.author_id and kind<>'text' and created_at>now()-interval '1 minute')>=20 then
  raise exception 'Muitas mídias em pouco tempo. Aguarde um minuto e tente de novo.';
 end if;
 return new;
end; $$;
revoke all on function public.limit_media_messages() from public,anon,authenticated;
create trigger messages_media_limit before insert on public.messages for each row execute function public.limit_media_messages();

-- 2. Coleção pessoal de figurinhas. O nome do arquivo é gerado pelo banco (dono/id.extensão).
create table public.stickers(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
 ext text not null check(ext in ('webp','png','jpg','gif')),
 favorite boolean not null default false,
 position integer not null default 0,
 created_at timestamptz not null default now(),
 path text generated always as (owner_id::text||'/'||id::text||'.'||ext) stored,
 unique(path)
);
create index stickers_owner on public.stickers(owner_id,favorite desc,position);
alter table public.stickers enable row level security;
create policy stickers_read on public.stickers for select to authenticated using(owner_id=auth.uid());
create policy stickers_add on public.stickers for insert to authenticated with check(owner_id=auth.uid());
create policy stickers_edit on public.stickers for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy stickers_remove on public.stickers for delete to authenticated using(owner_id=auth.uid());
revoke all on public.stickers from anon,authenticated;
grant select,delete on public.stickers to authenticated;
grant insert(ext) on public.stickers to authenticated;
grant update(favorite,position) on public.stickers to authenticated;
-- Limite por usuário: 200 figurinhas. A nova entra no fim da coleção.
create function public.stickers_before_insert() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,0));
 if (select count(*) from public.stickers where owner_id=new.owner_id)>=200 then
  raise exception 'Sua coleção chegou ao limite de 200 figurinhas. Exclua alguma para adicionar outra.';
 end if;
 new.position:=coalesce((select max(position) from public.stickers where owner_id=new.owner_id),0)+1;
 return new;
end; $$;
revoke all on function public.stickers_before_insert() from public,anon,authenticated;
create trigger stickers_before_insert before insert on public.stickers for each row execute function public.stickers_before_insert();
-- Reordena a coleção inteira de uma vez (a RLS garante que só mexe nas figurinhas do próprio usuário).
create function public.reorder_stickers(ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
begin
 if cardinality(ids)>200 then raise exception 'Lista de figurinhas grande demais.'; end if;
 update public.stickers s set position=o.n from unnest(ids) with ordinality as o(id,n) where s.id=o.id and s.owner_id=auth.uid();
end; $$;
revoke execute on function public.reorder_stickers(uuid[]) from public,anon;
grant execute on function public.reorder_stickers(uuid[]) to authenticated;

-- 3. Storage: buckets privados. Quem ouve ou vê é decidido por quem pode ler a mensagem.
create function public.chat_media_readable(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.messages m where m.media_path=object_name and (public.can_text(m.channel_id) or public.can_dm(m.dm_id))); $$;
create function public.chat_media_in_use(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.messages m where m.media_path=object_name); $$;
-- Upload de áudio: nome <seu id>/<conversa onde você pode escrever>/<uuid>.<extensão> e até 20 por minuto.
create function public.chat_audio_upload_ok(object_name text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare parts text[]; recent integer;
begin
 if auth.uid() is null then return false; end if;
 if object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|ogg|m4a)$' then return false; end if;
 parts:=string_to_array(object_name,'/');
 if parts[1]<>auth.uid()::text then return false; end if;
 if not (public.can_text(parts[2]::uuid) or public.can_dm(parts[2]::uuid)) then return false; end if;
 select count(*) into recent from storage.objects where bucket_id='chat-audio' and name like auth.uid()::text||'/%' and created_at>now()-interval '1 minute';
 return recent<20;
end; $$;
revoke execute on function public.chat_media_readable(text),public.chat_media_in_use(text),public.chat_audio_upload_ok(text) from public,anon;
grant execute on function public.chat_media_readable(text),public.chat_media_in_use(text),public.chat_audio_upload_ok(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('chat-audio','chat-audio',false,5242880,array['audio/webm','audio/ogg','audio/mp4']) on conflict(id) do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('stickers','stickers',false,1048576,array['image/webp','image/png','image/jpeg','image/gif']) on conflict(id) do nothing;
create policy chat_audio_read on storage.objects for select to authenticated using(bucket_id='chat-audio' and ((storage.foldername(name))[1]=auth.uid()::text or public.chat_media_readable(name)));
create policy chat_audio_insert on storage.objects for insert to authenticated with check(bucket_id='chat-audio' and public.chat_audio_upload_ok(name));
create policy chat_audio_delete on storage.objects for delete to authenticated using(bucket_id='chat-audio' and (storage.foldername(name))[1]=auth.uid()::text);
-- Figurinha: o arquivo só pode ser enviado para a linha que o banco acabou de criar (nome e limite vêm do banco)
-- e só sai do Storage se nenhuma mensagem a usa, para o destinatário não perder o que já recebeu.
create policy stickers_files_read on storage.objects for select to authenticated using(bucket_id='stickers' and ((storage.foldername(name))[1]=auth.uid()::text or public.chat_media_readable(name)));
create policy stickers_files_insert on storage.objects for insert to authenticated with check(bucket_id='stickers' and exists(select 1 from public.stickers s where s.path=name and s.owner_id=auth.uid()));
create policy stickers_files_delete on storage.objects for delete to authenticated using(bucket_id='stickers' and (storage.foldername(name))[1]=auth.uid()::text and not public.chat_media_in_use(name));
commit;

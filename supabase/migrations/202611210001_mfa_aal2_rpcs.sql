-- 2FA exigido também nas funções do banco (RPCs). Achado MÉDIO da auditoria Cloudflare (run-1):
-- funções SECURITY DEFINER não passam por RLS, então a política restritiva mfa_aal2_required (202611200001) não vale
-- para elas. Com só a senha (sessão aal1) de uma conta com 2FA dava para ver a presença dos amigos, abrir DM, marcar
-- DM como lida e, num grupo em que a vítima administra, editar o grupo e criar/atribuir um cargo de admin.
-- Agora cada RPC chamada pelo app confere public.mfa_satisfied() antes de fazer qualquer coisa.
-- Quem não usa 2FA (ou só tem fator não verificado) não muda nada: mfa_satisfied() é verdadeiro para essas contas.
-- Os corpos são os das migrations originais, sem outra mudança além da checagem.
-- Pendência conhecida (baixo impacto): os helpers booleanos is_member, is_owner, can_dm, can_text,
-- has_server_permission, member_rank e chat_media_* continuam sem a checagem (são usados dentro das políticas de RLS
-- a cada linha, e só respondem verdadeiro/falso ou um número de cargo).
begin;

create or replace function public.require_mfa() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not public.mfa_satisfied() then raise exception 'Confirme o código do 2FA.' using errcode='42501'; end if;
end; $$;
revoke all on function public.require_mfa() from public,anon,authenticated;

-- 202611020001_initial.sql
create or replace function public.create_server(server_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare s uuid;
begin
 if auth.uid() is null then raise exception 'Login necessário'; end if;
 perform public.require_mfa();
 insert into public.servers(name,owner_id) values(trim(server_name),auth.uid()) returning id into s;
 insert into public.server_members(server_id,user_id) values(s,auth.uid());
 insert into public.channels(server_id,name,kind) values(s,'geral','text'),(s,'Ponto de encontro','voice');
 return s;
end; $$;

create or replace function public.open_dm(friend_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare d uuid;
begin
 perform public.require_mfa();
 if auth.uid() is null or not exists(select 1 from public.friendships where status='accepted' and least(sender_id,receiver_id)=least(auth.uid(),friend_id) and greatest(sender_id,receiver_id)=greatest(auth.uid(),friend_id)) then raise exception 'Adicione este usuário como amigo primeiro'; end if;
 insert into public.dms(user_a,user_b) values(least(auth.uid(),friend_id),greatest(auth.uid(),friend_id)) on conflict(user_a,user_b) do update set user_a=excluded.user_a returning id into d;
 return d;
end; $$;

create or replace function public.allow_voice_token() returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
 if auth.uid() is null or not public.mfa_satisfied() then return false; end if;
 insert into public.voice_token_limits values(auth.uid(),now(),1)
 on conflict(user_id) do update set
 count=case when public.voice_token_limits.window_start<now()-interval '1 minute' then 1 else public.voice_token_limits.count+1 end,
 window_start=case when public.voice_token_limits.window_start<now()-interval '1 minute' then now() else public.voice_token_limits.window_start end
 returning count into n;
 return n<=10;
end; $$;

-- 202611020002_nacall.sql
create or replace function public.set_room_media(room_channel uuid, youtube_id text, is_playing boolean, seek_seconds double precision, expected_revision bigint default null)
returns public.room_media language plpgsql security definer set search_path='' as $$
declare result public.room_media; requests integer;
begin
 perform public.require_mfa();
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

-- 202611020004_groups.sql
create or replace function public.save_server(s uuid,new_name text,new_description text,new_icon text) returns void language plpgsql security definer set search_path='' as $$begin
 perform public.require_mfa();
 perform 1 from public.servers where id=s for update;
 if not public.has_server_permission(s,'manage_group') then raise exception 'Sem permissão para editar o grupo'; end if;
 update public.servers set name=trim(new_name),description=trim(new_description),icon_path=new_icon where id=s;
end$$;

create or replace function public.save_server_role(s uuid,r uuid,role_name text,role_color text,role_position integer,role_permissions text[],remove_role boolean default false) returns uuid language plpgsql security definer set search_path='' as $$declare old_rank integer; my_rank integer; p text; result uuid; begin
 perform public.require_mfa();
 perform 1 from public.servers where id=s for update;
 if not public.has_server_permission(s,'manage_roles') then raise exception 'Sem permissão para gerenciar cargos'; end if;
 my_rank:=public.member_rank(s,auth.uid());
 if r is not null then select position into old_rank from public.server_roles where id=r and server_id=s; if not found then raise exception 'Cargo não encontrado'; end if; if old_rank>=my_rank then raise exception 'Você só pode editar cargos abaixo do seu'; end if; end if;
 if remove_role then delete from public.server_roles where id=r and server_id=s; return r; end if;
 if role_position>=my_rank then raise exception 'O cargo precisa ficar abaixo do seu'; end if;
 foreach p in array role_permissions loop if not public.has_server_permission(s,p) then raise exception 'Você não pode conceder uma permissão que não possui'; end if; end loop;
 if r is null then insert into public.server_roles(server_id,name,color,position,permissions) values(s,trim(role_name),role_color,role_position,role_permissions) returning id into result;
 else update public.server_roles set name=trim(role_name),color=role_color,position=role_position,permissions=role_permissions where id=r and server_id=s returning id into result; end if;
 return result;
end$$;

create or replace function public.assign_server_role(s uuid,member_id uuid,r uuid,assigned boolean) returns void language plpgsql security definer set search_path='' as $$declare rank integer; begin
 perform public.require_mfa();
 perform 1 from public.servers where id=s for update;
 if not public.has_server_permission(s,'manage_roles') then raise exception 'Sem permissão para atribuir cargos'; end if;
 rank:=public.member_rank(s,auth.uid());
 if public.member_rank(s,member_id)>=rank then raise exception 'Você só pode gerenciar membros abaixo do seu cargo'; end if;
 if not exists(select 1 from public.server_roles where id=r and server_id=s and position<rank) then raise exception 'Cargo fora da sua hierarquia'; end if;
 if assigned then insert into public.member_roles values(s,member_id,r) on conflict do nothing; else delete from public.member_roles where server_id=s and user_id=member_id and role_id=r; end if;
end$$;

create or replace function public.join_server(invite_code uuid) returns uuid language plpgsql security definer set search_path='' as $$declare i public.invites; begin
 if auth.uid() is null then raise exception 'Entre na sua conta para aceitar o convite'; end if;
 perform public.require_mfa();
 select * into i from public.invites where code=invite_code for update;
 if i.server_id is null or i.expires_at<=now() then raise exception 'Convite inválido ou expirado'; end if;
 if exists(select 1 from public.server_members where server_id=i.server_id and user_id=auth.uid()) then return i.server_id; end if;
 if i.max_uses is not null and i.uses>=i.max_uses then raise exception 'Este convite atingiu o limite de usos'; end if;
 insert into public.server_members(server_id,user_id) values(i.server_id,auth.uid());
 update public.invites set uses=uses+1 where code=invite_code; return i.server_id;
end$$;

-- 202611190002_leitura_de_dms.sql
create or replace function public.mark_dm_read(d uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.require_mfa();
 if auth.uid() is null or not public.can_dm(d) then raise exception 'Conversa não encontrada.' using errcode='42501'; end if;
 insert into public.dm_reads(dm_id,user_id,read_at) values(d,auth.uid(),now())
 on conflict(dm_id,user_id) do update set read_at=excluded.read_at;
end; $$;

-- 202611190003_presenca.sql
create or replace function public.touch_presence(p_idle boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 perform public.require_mfa();
 insert into public.presence(user_id,idle,last_seen_at,online_until) values(auth.uid(),coalesce(p_idle,false),now(),now()+interval '100 seconds')
 on conflict(user_id) do update set idle=coalesce(p_idle,false),
  last_seen_at=case when public.presence.status='invisible' then public.presence.last_seen_at else now() end,
  online_until=case when public.presence.status='invisible' then public.presence.online_until else now()+interval '100 seconds' end;
end; $$;

create or replace function public.set_presence(p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 perform public.require_mfa();
 if p_status not in ('online','away','invisible') then raise exception 'Status inválido.' using errcode='22023'; end if;
 insert into public.presence(user_id,status,idle,last_seen_at,online_until)
  values(auth.uid(),p_status,false,now(),case when p_status='invisible' then now() else now()+interval '100 seconds' end)
 on conflict(user_id) do update set status=excluded.status,idle=false,
  last_seen_at=case when excluded.status='invisible' then public.presence.last_seen_at else now() end,
  online_until=excluded.online_until;
end; $$;

-- Sair continua silencioso (o app chama ao fechar a aba); sem 2FA confirmado simplesmente não faz nada.
create or replace function public.leave_presence() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.mfa_satisfied() then return; end if;
 update public.presence set online_until=now() where user_id=auth.uid();
end; $$;

-- Sem 2FA confirmado: nenhum status (o app ignora valor inválido) e nenhuma presença de amigos.
create or replace function public.my_presence() returns text language sql stable security definer set search_path='' as $$
 select case when public.mfa_satisfied() then coalesce((select status from public.presence where user_id=auth.uid()),'online') end; $$;

create or replace function public.friends_presence() returns table(user_id uuid,state text,last_seen_at timestamptz,server_now timestamptz)
language sql stable security definer set search_path='' as $$
 select p.user_id,
  case when p.status='invisible' or p.online_until<=now() then 'offline'
       when p.status='away' or p.idle then 'away'
       else 'online' end,
  p.last_seen_at, now()
 from public.presence p
 where auth.uid() is not null and public.mfa_satisfied() and p.user_id<>auth.uid() and exists(
  select 1 from public.friendships f where f.status='accepted'
   and least(f.sender_id,f.receiver_id)=least(auth.uid(),p.user_id) and greatest(f.sender_id,f.receiver_id)=greatest(auth.uid(),p.user_id)); $$;

commit;

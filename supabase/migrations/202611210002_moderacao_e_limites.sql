-- Moderação, controle de contato e limites de escrita no banco (auditoria de segurança: SEC-001, SEC-002, SEC-005).
-- A chave anon é pública: qualquer pessoa fala direto com o banco, então limites e regras só no app não bastam.
--
-- 1. Contato (SEC-001): bloquear alguém; DM só aceita mensagem nova entre amigos aceitos e sem bloqueio;
--    teto de pedidos de amizade pendentes. O histórico continua legível depois de desfazer a amizade.
-- 2. Grupos (SEC-002): sair do grupo, remover (e opcionalmente banir) membro e apagar mensagem alheia em canal.
--    Remover membro exige o cargo `manage_roles` e posto MAIOR que o do alvo (mesma hierarquia de `assign_server_role`).
--    Apagar mensagem alheia exige `manage_channels` (ou ser o dono). A comunidade oficial (sem dono) segue sem moderação
--    por usuários: quem modera nela é o service_role, pelo painel do Supabase.
-- 3. Limites (SEC-005): mensagens por minuto, grupos por dono, canais por grupo, convites ativos por grupo e arquivos
--    por pessoa nos buckets públicos de imagem.
-- Depende de 202611210001 (require_mfa) e 202611200001 (mfa_satisfied). Aditiva: não apaga dados. Troca duas políticas (messages_send, messages_delete) e duas (friendship_request, channels_create),
-- e redefine create_server e join_server (mesmo corpo, com a checagem de 2FA, os limites e o banimento).
-- Ainda sem tela: o app novo usa estas funções em um PR separado. Até lá as regras valem, e o app atual segue funcionando.
begin;

-- 1. Bloqueio e contato --------------------------------------------------------------------------------------
create table public.user_blocks(
 blocker_id uuid not null references public.profiles on delete cascade,
 blocked_id uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),
 check(blocker_id<>blocked_id)
);
create index user_blocks_blocked on public.user_blocks(blocked_id);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon,authenticated;
grant select on public.user_blocks to authenticated;
-- Só quem bloqueou enxerga a linha: a pessoa bloqueada não consulta a lista de quem a bloqueou.
create policy user_blocks_own on public.user_blocks for select to authenticated using(blocker_id=auth.uid());
create policy mfa_aal2_required on public.user_blocks as restrictive for all to authenticated
 using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

-- Existe bloqueio entre quem chama e a outra pessoa, em qualquer direção? Só responde sobre o próprio chamador.
create function public.blocked_with(other uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_blocks
  where (blocker_id=auth.uid() and blocked_id=other) or (blocker_id=other and blocked_id=auth.uid())); $$;

-- Pode escrever na DM: participa da conversa, ainda são amigos aceitos e não há bloqueio.
create function public.can_dm_write(d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.dms m
  where m.id=d and auth.uid() in (m.user_a,m.user_b)
   and exists(select 1 from public.friendships f where f.status='accepted'
    and least(f.sender_id,f.receiver_id)=m.user_a and greatest(f.sender_id,f.receiver_id)=m.user_b)
   and not exists(select 1 from public.user_blocks b
    where (b.blocker_id=m.user_a and b.blocked_id=m.user_b) or (b.blocker_id=m.user_b and b.blocked_id=m.user_a))); $$;

create function public.block_user(target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 perform public.require_mfa();
 if target is null or target=auth.uid() then raise exception 'Escolha outra pessoa.' using errcode='22023'; end if;
 if not exists(select 1 from public.profiles where id=target) then raise exception 'Pessoa não encontrada.' using errcode='22023'; end if;
 insert into public.user_blocks(blocker_id,blocked_id) values(auth.uid(),target) on conflict do nothing;
 -- Bloquear também desfaz a amizade e qualquer pedido pendente entre os dois.
 delete from public.friendships where least(sender_id,receiver_id)=least(auth.uid(),target) and greatest(sender_id,receiver_id)=greatest(auth.uid(),target);
end; $$;

create function public.unblock_user(target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 perform public.require_mfa();
 delete from public.user_blocks where blocker_id=auth.uid() and blocked_id=target;
end; $$;

-- Mensagem nova em DM só entre amigos aceitos e sem bloqueio (canais seguem como antes).
drop policy messages_send on public.messages;
create policy messages_send on public.messages for insert to authenticated
 with check(author_id=auth.uid() and (public.can_text(channel_id) or public.can_dm_write(dm_id)));

-- Pedido de amizade: não vale para quem bloqueou (ou foi bloqueado) e há um teto de pedidos pendentes enviados.
drop policy friendship_request on public.friendships;
create policy friendship_request on public.friendships for insert to authenticated
 with check(sender_id=auth.uid() and status='pending' and not public.blocked_with(receiver_id));
create function public.limit_friend_requests() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (select count(*) from public.friendships where sender_id=new.sender_id and status='pending')>=50 then
  raise exception 'Você tem muitos pedidos de amizade pendentes. Espere alguns serem respondidos.';
 end if;
 return new;
end; $$;
create trigger friendships_request_limit before insert on public.friendships for each row execute function public.limit_friend_requests();

-- 2. Grupos: sair, remover/banir, moderar mensagens ----------------------------------------------------------
create table public.server_bans(
 server_id uuid not null references public.servers on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 banned_by uuid references public.profiles on delete set null,
 created_at timestamptz not null default now(),
 primary key(server_id,user_id)
);
alter table public.server_bans enable row level security;
revoke all on public.server_bans from anon,authenticated;
grant select on public.server_bans to authenticated;
create policy server_bans_read on public.server_bans for select to authenticated using(public.has_server_permission(server_id,'manage_roles'));
create policy mfa_aal2_required on public.server_bans as restrictive for all to authenticated
 using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

create function public.leave_server(s uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 perform public.require_mfa();
 if exists(select 1 from public.servers where id=s and is_official) then raise exception 'Você não pode sair da comunidade oficial.' using errcode='42501'; end if;
 if public.is_owner(s) then raise exception 'O dono não pode sair do próprio grupo.' using errcode='42501'; end if;
 delete from public.server_members where server_id=s and user_id=auth.uid();
 if not found then raise exception 'Você não está neste grupo.' using errcode='22023'; end if;
end; $$;

create function public.remove_member(s uuid,member_id uuid,ban boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 perform public.require_mfa();
 perform 1 from public.servers where id=s for update;
 if not public.has_server_permission(s,'manage_roles') then raise exception 'Sem permissão para remover membros.' using errcode='42501'; end if;
 if member_id=auth.uid() then raise exception 'Para sair do grupo, use a opção de sair.' using errcode='22023'; end if;
 if not exists(select 1 from public.server_members where server_id=s and user_id=member_id) then raise exception 'Esta pessoa não está no grupo.' using errcode='22023'; end if;
 if public.member_rank(s,member_id)>=public.member_rank(s,auth.uid()) then raise exception 'Você só pode remover membros abaixo do seu cargo.' using errcode='42501'; end if;
 delete from public.server_members where server_id=s and user_id=member_id;
 if coalesce(ban,false) then
  insert into public.server_bans(server_id,user_id,banned_by) values(s,member_id,auth.uid()) on conflict do nothing;
 end if;
end; $$;

create function public.unban_member(s uuid,member_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 perform public.require_mfa();
 if not public.has_server_permission(s,'manage_roles') then raise exception 'Sem permissão para gerenciar banimentos.' using errcode='42501'; end if;
 delete from public.server_bans where server_id=s and user_id=member_id;
end; $$;

-- Apagar mensagem alheia em canal: quem tem `manage_channels` (ou é o dono) no grupo do canal.
create function public.can_moderate_channel(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.channels where id=c and public.has_server_permission(server_id,'manage_channels')); $$;
drop policy messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated using(
 (author_id=auth.uid() and (public.can_text(channel_id) or public.can_dm(dm_id)))
 or (channel_id is not null and public.can_moderate_channel(channel_id)));

-- create_server: mesmo corpo de antes + 2FA + no máximo 10 grupos criados por pessoa.
create or replace function public.create_server(server_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare s uuid;
begin
 if auth.uid() is null then raise exception 'Login necessário'; end if;
 perform public.require_mfa();
 if (select count(*) from public.servers where owner_id=auth.uid())>=10 then raise exception 'Você atingiu o limite de grupos criados.'; end if;
 insert into public.servers(name,owner_id) values(trim(server_name),auth.uid()) returning id into s;
 insert into public.server_members(server_id,user_id) values(s,auth.uid());
 insert into public.channels(server_id,name,kind) values(s,'geral','text'),(s,'Ponto de encontro','voice');
 return s;
end; $$;

-- join_server: mesmo corpo de antes + 2FA + quem foi banido do grupo não entra de novo.
create or replace function public.join_server(invite_code uuid) returns uuid language plpgsql security definer set search_path='' as $$declare i public.invites; begin
 if auth.uid() is null then raise exception 'Entre na sua conta para aceitar o convite'; end if;
 perform public.require_mfa();
 select * into i from public.invites where code=invite_code for update;
 if i.server_id is null or i.expires_at<=now() then raise exception 'Convite inválido ou expirado'; end if;
 if exists(select 1 from public.server_members where server_id=i.server_id and user_id=auth.uid()) then return i.server_id; end if;
 if exists(select 1 from public.server_bans where server_id=i.server_id and user_id=auth.uid()) then raise exception 'Você não pode entrar neste grupo.' using errcode='42501'; end if;
 if i.max_uses is not null and i.uses>=i.max_uses then raise exception 'Este convite atingiu o limite de usos'; end if;
 insert into public.server_members(server_id,user_id) values(i.server_id,auth.uid());
 update public.invites set uses=uses+1 where code=invite_code; return i.server_id;
end$$;

-- 3. Limites -----------------------------------------------------------------------------------------------------
-- Mensagens: no máximo 40 por minuto por pessoa (texto, áudio e figurinha somados). O lock serializa as inserções
-- da mesma pessoa, então rajadas paralelas não furam a contagem. A mídia ainda tem o limite próprio de 20/min.
create index messages_author_time on public.messages(author_id,created_at desc);
create function public.limit_messages() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.author_id::text,41));
 if (select count(*) from public.messages where author_id=new.author_id and created_at>now()-interval '1 minute')>=40 then
  raise exception 'Muitas mensagens em pouco tempo. Aguarde alguns segundos.';
 end if;
 return new;
end; $$;
create trigger messages_rate_limit before insert on public.messages for each row execute function public.limit_messages();

-- Canais: no máximo 50 por grupo.
create function public.channel_quota_ok(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (select count(*) from public.channels where server_id=s)<50; $$;
drop policy channels_create on public.channels;
create policy channels_create on public.channels for insert to authenticated
 with check(public.has_server_permission(server_id,'manage_channels') and public.channel_quota_ok(server_id));

-- Convites: no máximo 50 ativos por grupo.
create function public.limit_invites() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (select count(*) from public.invites where server_id=new.server_id and expires_at>now())>=50 then
  raise exception 'Este grupo já tem convites demais ativos. Apague alguns antes de criar outro.';
 end if;
 return new;
end; $$;
create trigger invites_active_limit before insert on public.invites for each row execute function public.limit_invites();

-- Imagens públicas: no máximo 20 arquivos por pessoa em cada bucket (avatars e profile-covers).
-- O app troca a imagem apagando a anterior, então o uso normal fica em 1 ou 2.
create function public.public_media_quota_ok(b text) returns boolean language sql stable security definer set search_path='' as $$
 select (select count(*) from storage.objects o where o.bucket_id=b and (storage.foldername(o.name))[1]=auth.uid()::text)<20; $$;
create policy public_media_quota on storage.objects as restrictive for insert to authenticated
 with check(bucket_id not in ('avatars','profile-covers') or public.public_media_quota_ok(bucket_id));

-- Permissões de execução ---------------------------------------------------------------------------------------
revoke all on function public.blocked_with(uuid),public.can_dm_write(uuid),public.block_user(uuid),public.unblock_user(uuid),
 public.leave_server(uuid),public.remove_member(uuid,uuid,boolean),public.unban_member(uuid,uuid),public.can_moderate_channel(uuid),
 public.channel_quota_ok(uuid),public.public_media_quota_ok(text),
 public.limit_friend_requests(),public.limit_messages(),public.limit_invites() from public,anon,authenticated;
grant execute on function public.blocked_with(uuid),public.can_dm_write(uuid),public.block_user(uuid),public.unblock_user(uuid),
 public.leave_server(uuid),public.remove_member(uuid,uuid,boolean),public.unban_member(uuid,uuid),public.can_moderate_channel(uuid),
 public.channel_quota_ok(uuid),public.public_media_quota_ok(text) to authenticated;

commit;

-- Respostas (citar uma mensagem) e reações com emoji, no chat do site e do app.
-- Aditiva: uma coluna opcional em messages e uma tabela nova. Quem não usa nada disso não percebe mudança.
-- Depende de 202611210002_moderacao_e_limites.sql (can_dm_write) e de 202611200001_mfa_aal2_rls.sql (mfa_satisfied).
begin;

-- 1. Respostas: a mensagem pode apontar para outra da MESMA conversa. Se a original for apagada, a resposta fica sem citação.
alter table public.messages add column if not exists reply_to uuid references public.messages(id) on delete set null;
create index if not exists messages_reply_to on public.messages(reply_to) where reply_to is not null;

create or replace function public.check_reply_same_chat() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.reply_to is not null and not exists(
  select 1 from public.messages r where r.id=new.reply_to
   and r.channel_id is not distinct from new.channel_id and r.dm_id is not distinct from new.dm_id
 ) then
  raise exception 'Só dá para responder a uma mensagem da mesma conversa.' using errcode='22023';
 end if;
 return new;
end; $$;
drop trigger if exists messages_reply_same_chat on public.messages;
create trigger messages_reply_same_chat before insert on public.messages for each row execute function public.check_reply_same_chat();
revoke all on function public.check_reply_same_chat() from public, anon, authenticated;
grant insert(reply_to) on public.messages to authenticated;

-- 2. Reações: cada pessoa marca um emoji uma vez por mensagem; tirar é apagar a própria marcação.
create table if not exists public.message_reactions (
 message_id uuid not null references public.messages on delete cascade,
 user_id uuid not null default auth.uid() references public.profiles on delete cascade,
 emoji text not null check(char_length(emoji) between 1 and 16 and emoji !~ '\s'),
 created_at timestamptz not null default now(),
 primary key(message_id,user_id,emoji)
);
create index if not exists message_reactions_message on public.message_reactions(message_id);
alter table public.message_reactions enable row level security;
alter table public.message_reactions replica identity full; -- o tempo real precisa da linha inteira para avisar quando uma reação sai

-- Ler a mensagem: mesmas regras de messages_read. Reagir: mesmas regras de escrever na conversa (DM só entre amigos e sem bloqueio).
create or replace function public.can_read_message(m uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.messages x where x.id=m and (public.can_text(x.channel_id) or public.can_dm(x.dm_id))); $$;
create or replace function public.can_react_message(m uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.messages x where x.id=m and (public.can_text(x.channel_id) or public.can_dm_write(x.dm_id))); $$;
revoke all on function public.can_read_message(uuid), public.can_react_message(uuid) from public, anon;
grant execute on function public.can_read_message(uuid), public.can_react_message(uuid) to authenticated;

drop policy if exists reactions_read on public.message_reactions;
create policy reactions_read on public.message_reactions for select to authenticated using(public.can_read_message(message_id));
drop policy if exists reactions_add on public.message_reactions;
create policy reactions_add on public.message_reactions for insert to authenticated
 with check(user_id=auth.uid() and public.can_react_message(message_id));
drop policy if exists reactions_remove on public.message_reactions;
create policy reactions_remove on public.message_reactions for delete to authenticated using(user_id=auth.uid());
-- Igual às outras tabelas privadas: com 2FA verificado, só sessão aal2.
drop policy if exists mfa_aal2_required on public.message_reactions;
create policy mfa_aal2_required on public.message_reactions as restrictive for all to authenticated
 using((select public.mfa_satisfied())) with check((select public.mfa_satisfied()));

-- Limites: até 20 emojis diferentes por mensagem e até 10 reações da mesma pessoa na mesma mensagem.
create or replace function public.limit_message_reactions() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (select count(*) from public.message_reactions where message_id=new.message_id and user_id=new.user_id)>=10 then
  raise exception 'Você já reagiu bastante a essa mensagem.' using errcode='22023';
 end if;
 if not exists(select 1 from public.message_reactions where message_id=new.message_id and emoji=new.emoji)
  and (select count(distinct emoji) from public.message_reactions where message_id=new.message_id)>=20 then
  raise exception 'Essa mensagem já tem emojis demais.' using errcode='22023';
 end if;
 return new;
end; $$;
drop trigger if exists message_reactions_limit on public.message_reactions;
create trigger message_reactions_limit before insert on public.message_reactions for each row execute function public.limit_message_reactions();
revoke all on function public.limit_message_reactions() from public, anon, authenticated;

revoke all on public.message_reactions from public, anon;
grant select, delete on public.message_reactions to authenticated;
grant insert(message_id,emoji) on public.message_reactions to authenticated;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='message_reactions') then
  alter publication supabase_realtime add table public.message_reactions;
 end if;
end $$;

commit;

-- Status de presença (online, ausente, invisível) e "visto pela última vez", só entre amigos.
-- Aditiva: cria uma tabela fechada e funções; nada que já existe é alterado ou apagado.
begin;

-- 1. A tabela não tem política nem acesso direto: tudo passa pelas funções abaixo.
--    Assim os amigos nunca recebem o status escolhido ("invisível" aparece para eles como offline).
create table public.presence (
 user_id uuid primary key references public.profiles on delete cascade,
 status text not null default 'online' check (status in ('online','away','invisible')),
 idle boolean not null default false,
 last_seen_at timestamptz not null default now(),
 online_until timestamptz not null default now()
);
alter table public.presence enable row level security;
revoke all on public.presence from anon,authenticated;

-- 2. Sinal de vida do app aberto (a cada ~45 s). Vale por 100 s: depois disso a pessoa conta como offline.
--    Invisível não atualiza "visto por último", para não entregar quando a pessoa esteve ali.
create function public.touch_presence(p_idle boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 insert into public.presence(user_id,idle,last_seen_at,online_until) values(auth.uid(),coalesce(p_idle,false),now(),now()+interval '100 seconds')
 on conflict(user_id) do update set idle=coalesce(p_idle,false),
  last_seen_at=case when public.presence.status='invisible' then public.presence.last_seen_at else now() end,
  online_until=case when public.presence.status='invisible' then public.presence.online_until else now()+interval '100 seconds' end;
end; $$;

-- 3. Escolha da pessoa: online, ausente ou invisível.
create function public.set_presence(p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode='42501'; end if;
 if p_status not in ('online','away','invisible') then raise exception 'Status inválido.' using errcode='22023'; end if;
 insert into public.presence(user_id,status,idle,last_seen_at,online_until)
  values(auth.uid(),p_status,false,now(),case when p_status='invisible' then now() else now()+interval '100 seconds' end)
 on conflict(user_id) do update set status=excluded.status,idle=false,
  last_seen_at=case when excluded.status='invisible' then public.presence.last_seen_at else now() end,
  online_until=excluded.online_until;
end; $$;

-- 4. Ao fechar a aba: fica offline na hora, e o "visto por último" continua o do último sinal.
create function public.leave_presence() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return; end if;
 update public.presence set online_until=now() where user_id=auth.uid();
end; $$;

-- 5. O status que a própria pessoa escolheu.
create function public.my_presence() returns text language sql stable security definer set search_path='' as $$
 select coalesce((select status from public.presence where user_id=auth.uid()),'online'); $$;

-- 6. Presença dos amigos (só amizades aceitas). O estado é calculado aqui, com a hora do servidor.
create function public.friends_presence() returns table(user_id uuid,state text,last_seen_at timestamptz,server_now timestamptz)
language sql stable security definer set search_path='' as $$
 select p.user_id,
  case when p.status='invisible' or p.online_until<=now() then 'offline'
       when p.status='away' or p.idle then 'away'
       else 'online' end,
  p.last_seen_at, now()
 from public.presence p
 where auth.uid() is not null and p.user_id<>auth.uid() and exists(
  select 1 from public.friendships f where f.status='accepted'
   and least(f.sender_id,f.receiver_id)=least(auth.uid(),p.user_id) and greatest(f.sender_id,f.receiver_id)=greatest(auth.uid(),p.user_id)); $$;

revoke execute on function public.touch_presence(boolean),public.set_presence(text),public.leave_presence(),public.my_presence(),public.friends_presence() from public,anon;
grant execute on function public.touch_presence(boolean),public.set_presence(text),public.leave_presence(),public.my_presence(),public.friends_presence() to authenticated;

commit;

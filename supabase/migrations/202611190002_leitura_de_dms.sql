-- Mensagens não lidas das conversas diretas (DMs): base da bolinha vermelha, do sino e do som de aviso.
-- Aditiva: cria uma tabela e duas funções; nada que já existe é alterado ou apagado.
begin;

-- 1. Até quando cada pessoa leu cada DM. Só o próprio dono enxerga a linha e só `mark_dm_read` escreve nela.
create table public.dm_reads (
 dm_id uuid not null references public.dms on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 read_at timestamptz not null default now(),
 primary key (dm_id,user_id)
);
create index dm_reads_user on public.dm_reads(user_id);
alter table public.dm_reads enable row level security;
revoke all on public.dm_reads from anon,authenticated;
grant select on public.dm_reads to authenticated;
create policy dm_reads_own on public.dm_reads for select to authenticated using(user_id=auth.uid());

-- As DMs que já existem começam como lidas: o histórico antigo não vira "não lida" de uma vez.
insert into public.dm_reads(dm_id,user_id)
 select d.id,v.user_id from public.dms d cross join lateral (values(d.user_a),(d.user_b)) v(user_id)
 on conflict do nothing;

-- 2. Marca a DM como lida agora (hora do servidor). Só para quem participa da conversa.
create function public.mark_dm_read(d uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_dm(d) then raise exception 'Conversa não encontrada.' using errcode='42501'; end if;
 insert into public.dm_reads(dm_id,user_id,read_at) values(d,auth.uid(),now())
 on conflict(dm_id,user_id) do update set read_at=excluded.read_at;
end; $$;
revoke execute on function public.mark_dm_read(uuid) from public,anon;
grant execute on function public.mark_dm_read(uuid) to authenticated;

-- 3. DMs com mensagens do outro que ainda não foram lidas: quantas são e a mais recente (tipo e prévia curta).
-- Roda com os direitos de quem chama, então a RLS de `messages` e de `dm_reads` já limita tudo às próprias DMs.
create function public.unread_dms() returns table(dm_id uuid,unread integer,last_at timestamptz,last_kind text,last_body text)
language sql stable security invoker set search_path='' as $$
 select m.dm_id,count(*)::integer,max(m.created_at),
  (array_agg(m.kind order by m.created_at desc))[1],
  left((array_agg(m.body order by m.created_at desc))[1],140)
 from public.messages m
 left join public.dm_reads r on r.dm_id=m.dm_id and r.user_id=auth.uid()
 where m.dm_id is not null and m.author_id<>auth.uid() and (r.read_at is null or m.created_at>r.read_at)
 group by m.dm_id
 order by max(m.created_at) desc; $$;
revoke execute on function public.unread_dms() from public,anon;
grant execute on function public.unread_dms() to authenticated;

-- 4. Outros aparelhos da mesma pessoa limpam a bolinha quando uma DM é lida.
alter publication supabase_realtime add table public.dm_reads;

commit;

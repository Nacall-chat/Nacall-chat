-- Presença dentro dos servidores: quem está no mesmo servidor vê se o outro está online ou ausente, sem precisar ser amigo.
-- Aditiva: só cria uma função de leitura; a tabela `presence` continua fechada (sem acesso direto) e nada existente muda.
--
-- Regras (as mesmas de friends_presence, com menos informação):
-- * Só responde a quem é membro do servidor pedido, e só sobre membros desse mesmo servidor.
-- * Devolve apenas quem está online ou ausente. Offline, invisível ou que nunca entrou não aparece (o app mostra offline).
-- * Não entrega "visto pela última vez": isso continua só entre amigos.
-- * Quem bloqueou ou foi bloqueado (em qualquer direção) não aparece.
-- * Conta com 2FA verificado precisa de sessão aal2, como as outras funções de presença.
-- Desempenho: uma consulta pela chave (server_id, user_id) de server_members e pela chave de presence;
-- o app só chama para o servidor aberto, a cada 30 s e com a aba visível.
begin;

create function public.server_presence(p_server uuid) returns table(user_id uuid,state text)
language sql stable security definer set search_path='' as $$
 select p.user_id,
  case when p.status='away' or p.idle then 'away' else 'online' end
 from public.server_members m
 join public.presence p on p.user_id=m.user_id
 where auth.uid() is not null
  and public.mfa_satisfied()
  and m.server_id=p_server
  and public.is_member(p_server)
  and m.user_id<>auth.uid()
  and p.status<>'invisible'
  and p.online_until>now()
  and not exists(select 1 from public.user_blocks b
   where (b.blocker_id=auth.uid() and b.blocked_id=m.user_id) or (b.blocker_id=m.user_id and b.blocked_id=auth.uid())); $$;

revoke execute on function public.server_presence(uuid) from public,anon;
grant execute on function public.server_presence(uuid) to authenticated;

commit;

-- O dono do grupo pode dar (e tirar) cargos de si mesmo.
-- Antes, a regra "só membros abaixo do seu cargo" valia também para a própria pessoa, então nem o dono conseguia
-- se dar um cargo (para mostrar a etiqueta e a cor). Agora só o dono tem essa exceção, e só para ele mesmo:
-- quem tem "gerenciar cargos" continua sem poder se promover nem mexer em quem está no mesmo nível ou acima.
-- Mantém o 2FA (require_mfa), a trava do grupo e a hierarquia dos cargos (só cargos abaixo do seu).
create or replace function public.assign_server_role(s uuid,member_id uuid,r uuid,assigned boolean) returns void language plpgsql security definer set search_path='' as $$declare rank integer; self_owner boolean; begin
 perform public.require_mfa();
 perform 1 from public.servers where id=s for update;
 if not public.has_server_permission(s,'manage_roles') then raise exception 'Sem permissão para atribuir cargos'; end if;
 rank:=public.member_rank(s,auth.uid());
 self_owner:=member_id=auth.uid() and exists(select 1 from public.servers where id=s and owner_id=auth.uid());
 if not self_owner and public.member_rank(s,member_id)>=rank then raise exception 'Você só pode gerenciar membros abaixo do seu cargo'; end if;
 if not exists(select 1 from public.server_roles where id=r and server_id=s and position<rank) then raise exception 'Cargo fora da sua hierarquia'; end if;
 if assigned then insert into public.member_roles values(s,member_id,r) on conflict do nothing; else delete from public.member_roles where server_id=s and user_id=member_id and role_id=r; end if;
end$$;

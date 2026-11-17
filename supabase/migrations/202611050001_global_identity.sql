begin;
-- Numeração global, permanente e gerada exclusivamente pelo banco.
lock table public.profiles in access exclusive mode;
create sequence public.profile_number_seq as bigint minvalue 1 maxvalue 9007199254740991;
alter table public.profiles add column user_number bigint;
with numbered as (
 select id,row_number() over(order by created_at,id) as n from public.profiles
) update public.profiles p set user_number=n.n from numbered n where p.id=n.id;
select setval('public.profile_number_seq',coalesce(max(user_number),0)+1,false) from public.profiles;
alter table public.profiles alter column user_number set not null;
alter table public.profiles add constraint profile_number_unique unique(user_number);
alter table public.profiles add constraint profile_number_positive check(user_number>0);
revoke all on sequence public.profile_number_seq from public,anon,authenticated;
create function public.assign_profile_number() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.user_number:=nextval('public.profile_number_seq');
 return new;
end; $$;
revoke all on function public.assign_profile_number() from public,anon,authenticated;
create trigger assign_profile_number before insert on public.profiles for each row execute function public.assign_profile_number();
-- Não há grant de update(user_number); nome, login e UUID existentes são preservados.

-- Comunidade do sistema: sem proprietário humano, portanto sem privilégios de administrador
-- atribuídos por acaso ao primeiro cadastro.
alter table public.servers alter column owner_id drop not null;
alter table public.servers add column is_official boolean not null default false;
alter table public.servers add constraint official_owner check((is_official and owner_id is null) or (not is_official and owner_id is not null));
create unique index one_official_community on public.servers(is_official) where is_official;
insert into public.servers(name,description,is_official)
 values('NACALL - GLOBAL','A comunidade oficial de toda a galera NACALL.',true);
insert into public.channels(server_id,name,kind)
 select s.id,c.name,c.kind from public.servers s cross join (values
 ('chat-geral','text'),('dicas-e-instruções','text'),
 ('BRASIL 01 - GERAL','voice'),('BRASIL 02 - GERAL','voice'),
 ('BRASIL 03 - GERAL','voice'),('RCM GROUP','voice')) as c(name,kind) where s.is_official;
insert into public.server_members(server_id,user_id)
 select s.id,p.id from public.servers s cross join public.profiles p where s.is_official on conflict do nothing;
create function public.join_official_community() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.server_members(server_id,user_id)
 select id,new.id from public.servers where is_official on conflict do nothing;
 return new;
end; $$;
revoke all on function public.join_official_community() from public,anon,authenticated;
create trigger join_official_community after insert on public.profiles for each row execute function public.join_official_community();

-- A criação de uma DM precisa chegar imediatamente ao outro participante.
alter publication supabase_realtime add table public.dms;
commit;

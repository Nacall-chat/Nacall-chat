begin;
-- Nick com letras maiúsculas e símbolos (_ . - ! # $ * + = ~ ^ ?), 3 a 24 caracteres, sem espaços nem @.
-- O nick é guardado como a pessoa digitou. A unicidade e a busca (login, adicionar amigo) ignoram maiúsculas via profiles.username_key.
-- Aditiva: os nicks atuais (todos minúsculos) continuam válidos e únicos.
do $$ declare c text;
begin
 for c in select conname from pg_constraint where conrelid='public.profiles'::regclass and contype='c' and strpos(pg_get_constraintdef(oid),'[a-z0-9_]{3,24}')>0 loop
  execute format('alter table public.profiles drop constraint %I',c);
 end loop;
end $$;
alter table public.profiles add constraint profiles_username_check check (username ~ '^[A-Za-z0-9_.!#$*+=~^?-]{3,24}$');
alter table public.profiles add column username_key text generated always as (lower(username)) stored;
create unique index profiles_username_key_idx on public.profiles(username_key);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare uname text; display text;
begin
 uname:=trim(coalesce(new.raw_user_meta_data->>'username',''));
 if uname !~ '^[A-Za-z0-9_.!#$*+=~^?-]{3,24}$' then uname:='u_'||substr(replace(new.id::text,'-',''),1,20); end if;
 display:=trim(coalesce(new.raw_user_meta_data->>'display_name','Jogador novo'));
 if char_length(display) not between 2 and 60 then display:='Jogador novo'; end if;
 insert into public.profiles(id,username,display_name) values(new.id,uname,display);
 return new;
end; $$;
commit;

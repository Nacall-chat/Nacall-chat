-- Storage: dois achados da auditoria Cloudflare (run-1).
-- 1. Avatar e capa: com só a senha (sessão aal1) de uma conta com 2FA dava para subir, renomear ou apagar a foto e a
--    capa da vítima, porque a política restritiva de 2FA (202611200001) cobria só chat-audio e stickers. Agora
--    gravar, renomear e apagar nesses buckets também exigem aal2. Ler não muda: as imagens são públicas.
--    De carona: avatar_update ganha a mesma regra de extensão do avatar_insert (só .webp); antes um rename para .html passava.
-- 2. Ícones de grupo: qualquer pessoa logada listava o bucket group-icons e descobria id e ícone de grupos em que não
--    está. Agora a listagem pela API mostra só os grupos de que a pessoa é membro. O link público da imagem continua
--    funcionando para todos (o bucket é público), então os ícones continuam aparecendo nos convites.
-- Aditiva: só cria políticas restritivas e troca duas políticas existentes. Depende de 202611200001 (mfa_satisfied).
begin;

drop policy if exists mfa_aal2_public_media_insert on storage.objects;
drop policy if exists mfa_aal2_public_media_update on storage.objects;
drop policy if exists mfa_aal2_public_media_delete on storage.objects;
create policy mfa_aal2_public_media_insert on storage.objects as restrictive for insert to authenticated
  with check (bucket_id not in ('avatars', 'profile-covers') or (select public.mfa_satisfied()));
create policy mfa_aal2_public_media_update on storage.objects as restrictive for update to authenticated
  using (bucket_id not in ('avatars', 'profile-covers') or (select public.mfa_satisfied()))
  with check (bucket_id not in ('avatars', 'profile-covers') or (select public.mfa_satisfied()));
create policy mfa_aal2_public_media_delete on storage.objects as restrictive for delete to authenticated
  using (bucket_id not in ('avatars', 'profile-covers') or (select public.mfa_satisfied()));

drop policy if exists avatar_update on storage.objects;
create policy avatar_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and lower(storage.extension(name)) = 'webp');

drop policy if exists group_icons_read on storage.objects;
create policy group_icons_read on storage.objects for select to authenticated
  using (bucket_id = 'group-icons' and (storage.foldername(name))[1] in (select s.id::text from public.servers s where public.is_member(s.id)));

commit;

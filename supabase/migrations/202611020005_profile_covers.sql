begin;
alter table public.profiles add column cover_path text not null default '';
alter table public.profiles add constraint cover_owned check(cover_path='' or (split_part(cover_path,'/',1)=id::text and cover_path ~ '^[0-9a-f-]+/[0-9a-f-]+\.(webp|gif)$'));
grant update(cover_path) on public.profiles to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-covers','profile-covers',true,5242880,array['image/webp','image/gif']) on conflict(id) do nothing;
create policy cover_read on storage.objects for select to authenticated using(bucket_id='profile-covers');
create policy cover_insert on storage.objects for insert to authenticated with check(bucket_id='profile-covers' and (storage.foldername(name))[1]=auth.uid()::text and storage.extension(name) in('webp','gif'));
create policy cover_delete on storage.objects for delete to authenticated using(bucket_id='profile-covers' and (storage.foldername(name))[1]=auth.uid()::text);
commit;

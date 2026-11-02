-- Emergency rollback only: first restore the previous app deployment.
-- Preserves groups, members, messages, roles, photos and invite usage records.
begin;
drop policy if exists channels_create on public.channels;
drop policy if exists channels_edit on public.channels;
create policy channels_create on public.channels for insert to authenticated with check(public.is_owner(server_id));
revoke update(name) on public.channels from authenticated;
drop policy if exists invites_read on public.invites;
drop policy if exists invites_create on public.invites;
drop policy if exists invites_revoke on public.invites;
create policy invites_read on public.invites for select to authenticated using(public.is_owner(server_id));
create policy invites_create on public.invites for insert to authenticated with check(public.is_owner(server_id) and expires_at>now() and expires_at<=now()+interval '7 days' and uses=0);
create policy invites_revoke on public.invites for delete to authenticated using(public.is_owner(server_id));
revoke insert(expires_at,max_uses) on public.invites from authenticated;
revoke execute on function public.save_server(uuid,text,text,text),public.save_server_role(uuid,uuid,text,text,integer,text[],boolean),public.assign_server_role(uuid,uuid,uuid,boolean) from authenticated;
-- Keep limited-use invite enforcement and preview validation; they are compatible with old clients.
commit;

import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {App} from '@/components/app';
// Título próprio: na aba, "Entrar" não pode ser igual ao da página inicial (o resto da metadata vem do layout).
export const metadata: Metadata = {title: 'Entrar · NACALL'};
export default async function Login(){
  // Quem já está logado não deveria cair aqui: a SPA carrega o app atrás da tela "entrar", o que confunde (URL "login", título "Entrar", conteúdo "Amigos").
  // O cookie de sessão do supabase-js vem no padrão sb-<ref>-auth-token. A presença basta para mandar para a home; a sessão em si é validada no cliente.
  const jar = await cookies();
  if (jar.getAll().some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))) redirect('/');
  return <App initialScreen="login"/>;
}

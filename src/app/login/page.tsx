import type {Metadata} from 'next';
import {App} from '@/components/app';
// Título próprio: na aba, "Entrar" não pode ser igual ao da página inicial (o resto da metadata vem do layout).
export const metadata: Metadata = {title: 'Entrar · NACALL'};
export default function Login(){return <App initialScreen="login"/>;}

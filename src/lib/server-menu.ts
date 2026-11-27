import type { Server } from './types';

/**
 * Menu do servidor (grupo), aberto pelo nome no topo da lateral, como no Discord: convidar e configurar em cima,
 * copiar o ID no meio e sair do grupo, em vermelho, no fim. Só aparece o que a pessoa tem permissão de fazer:
 * as mesmas regras do banco (has_server_permission e leave_server), para não mostrar botão que só daria erro.
 */
export type ServerMenuAction = 'invite' | 'settings' | 'create-channel' | 'roles' | 'copy-id' | 'leave';
export type ServerMenuItem = { id: ServerMenuAction; label: string; hint?: string; section: 'manage' | 'info' | 'danger'; danger?: boolean };

/** `manage: false` (app do celular, que ainda não tem as telas de configuração) deixa só copiar o ID e sair. */
export function serverMenuItems(server: Pick<Server, 'owner_id' | 'is_official'>, me: string, can: (permission: string) => boolean, { manage = true }: { manage?: boolean } = {}): ServerMenuItem[] {
  const owner = server.owner_id === me;
  const official = Boolean(server.is_official);
  const items: ServerMenuItem[] = [];
  if (manage) {
    if (can('manage_invites')) items.push({ id: 'invite', label: 'Convidar amigos', hint: 'Criar e copiar um link de convite', section: 'manage' });
    // Configurações: todos os membros de um grupo comum abrem (quem não pode editar vê o perfil só para leitura, como antes).
    if (!official) items.push({ id: 'settings', label: 'Configurações do grupo', hint: can('manage_group') ? 'Nome, foto e descrição' : 'Ver o perfil do grupo', section: 'manage' });
    if (!official && can('manage_channels')) items.push({ id: 'create-channel', label: 'Criar canal', hint: 'Texto ou sala de voz', section: 'manage' });
    if (!official && can('manage_roles')) items.push({ id: 'roles', label: 'Cargos e membros', hint: 'Hierarquia e permissões', section: 'manage' });
  }
  items.push({ id: 'copy-id', label: 'Copiar ID do grupo', section: 'info' });
  // Igual ao leave_server: ninguém sai da comunidade oficial e o dono não sai do próprio grupo.
  if (!official && !owner) items.push({ id: 'leave', label: 'Sair do grupo', section: 'danger', danger: true });
  return items;
}

/** Itens agrupados na ordem do menu, para desenhar um separador entre os blocos. */
export function serverMenuSections(items: ServerMenuItem[]): ServerMenuItem[][] {
  return (['manage', 'info', 'danger'] as const).map(section => items.filter(item => item.section === section)).filter(group => group.length > 0);
}

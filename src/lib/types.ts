export type Profile = { id: string; username: string; display_name: string; bio: string; avatar_path?: string; cover_path?: string };
export type Server = { id: string; name: string; owner_id: string; description?: string; icon_path?: string };
export type Channel = { id: string; name: string; kind: 'text' | 'voice'; server_id: string };
export type Message = { id: string; author_id: string; body: string; created_at: string; channel_id: string | null; dm_id: string | null };
export type Friendship = { id: string; sender_id: string; receiver_id: string; status: 'pending' | 'accepted' };
export type DM = { id: string; user_a: string; user_b: string };

export type ServerRole={id:string;server_id:string;name:string;color:string;position:number;permissions:string[]};
export type MemberRole={server_id:string;user_id:string;role_id:string};
export const groupPermissions=[['manage_group','Editar perfil do grupo'],['manage_channels','Criar e editar canais'],['manage_roles','Gerenciar cargos e membros'],['manage_invites','Criar e revogar convites']] as const;

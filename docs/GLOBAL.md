# Identidade e comunidade oficial

Cada perfil recebe um número global crescente e imutável, exibido como `Never #00001`.
Perfis existentes recebem números pela data de criação e UUID como desempate; novos cadastros usam uma sequence PostgreSQL, segura sob concorrência. Números não são reutilizados e podem ter lacunas por transações revertidas ou contas removidas. O username e o UUID permanecem iguais.

A busca de amigos aceita @username, Nome #00001 ou #00001. A tag identifica pelo número global; trocar o nome não altera o destinatário. Amizades, aceite e histórico de DMs existentes são preservados. A criação da DM também é publicada via Realtime, com a RLS já existente limitando cada conversa aos dois participantes. A assinatura social recarrega ao reconectar.

A comunidade NACALL - GLOBAL é criada uma única vez pela migration, sem proprietário humano. Todas as contas existentes e futuras recebem associação automática. Os membros comuns não podem editar seu perfil, cargos ou canais. Grupos particulares continuam com seus proprietários e permissões anteriores.

Canais: chat-geral; dicas-e-instruções; BRASIL 01 - GERAL; BRASIL 02 - GERAL; BRASIL 03 - GERAL; RCM GROUP.
A marca usa o símbolo N existente em public/brand/symbol.svg. O mascote continua nas ilustrações.

## Publicação

Migration nova: `202611050001_global_identity.sql`. Aplicar primeiro no Supabase HML confirmado, antes do merge em release. Testar cadastro, identificador, GLOBAL, amizade e troca de DMs em duas sessões. Depois aplicar no Supabase PRD NACALL e publicar pelo fluxo de docs/DEPLOY.md. Não aplicar no banco pessoal ON3VER.

A conexão Supabase disponível nesta execução só listou o projeto Nacall (vpqutlhziliiilrrkqll); não foi possível identificar com segurança um projeto HML acessível. Nenhuma migration remota foi aplicada. Vercel NACALL possui nacall-hml e nacall-prd no time team_0m3biijv5SSsYVljvDPNFAfM.

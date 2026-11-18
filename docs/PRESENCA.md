# Status de presença e "visto pela última vez"

Só entre **amigos** (amizade aceita). Quem não é amigo não mostra status.

## Estados
- **Online:** com o NACALL aberto e mexendo nele (mouse, teclado ou toque).
- **Ausente:** sem atividade há 5 minutos, ou escolhido pela pessoa.
- **Offline:** sem o NACALL aberto (sem sinal há mais de 100 segundos, ou a aba foi fechada), ou **invisível**.
- **Invisível:** a pessoa usa o NACALL normalmente, mas os amigos a veem offline e **não** ficam sabendo a hora real do último acesso (o "visto por último" para de andar).

A pessoa escolhe Online, Ausente ou Invisível no menu do avatar, no rodapé da barra lateral. A escolha fica no servidor (vale em qualquer aparelho).

## Onde aparece
Bolinha no avatar (verde online, amarela ausente, cinza offline) na lista de amigos (com a aba nova **Online**), nas conversas diretas, na lista de membros e no cartão de perfil. Ao **passar o mouse** em um amigo (telas com mouse) abre um cartão com foto, nome, status e "Visto pela última vez há 30 min" (ou "Online agora"), e a bio. No celular, tocar abre o cartão de perfil completo, que mostra o mesmo.

## Como funciona
- **Banco** (`supabase/migrations/202611190003_presenca.sql`, aditiva): tabela fechada `presence` (sem política e sem acesso direto) e funções `touch_presence(idle)`, `set_presence(status)`, `leave_presence()`, `my_presence()` e `friends_presence()`. O estado dos amigos é calculado no servidor, com a hora do servidor, e o status "invisível" nunca chega aos amigos.
- **App** (`src/components/use-presence.ts`): sinal de vida a cada 45 s (vale 100 s), aviso imediato ao fechar a aba (`leave_presence` com `keepalive`), consulta dos amigos a cada 30 s e ao voltar o foco da aba. "Há 30 min" usa a hora do servidor.

## Limites conhecidos
- O estado dos amigos atualiza em até ~30 s (não é instantâneo como no Discord).
- Se o navegador travar ou a energia cair sem avisar, a pessoa some em até ~100 s.
- O aviso ao fechar a aba depende do navegador permitir o envio na saída (se não permitir, vale o prazo de 100 s).

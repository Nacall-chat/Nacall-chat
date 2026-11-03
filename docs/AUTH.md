# Autenticação e segurança da conta

O Supabase Auth é a fonte da verdade: ele guarda as senhas (hash), envia e valida os códigos de email e faz o MFA (TOTP). O NACALL só acrescenta o que ele não oferece: login por username, limites de tentativas, códigos de recuperação do 2FA e a política de senha.

## Modelo de identidade

- **Identidade:** o email real, confirmado por código de 6 dígitos. Fica em `auth.users`; nada de email duplicado em tabelas nossas.
- **Username:** só em `profiles.username` (único, `^[a-z0-9_]{3,24}$`, sempre minúsculo, sem espaços). O trigger `handle_new_user` cria o perfil a partir dos metadados do cadastro.
- **Login por username:** o servidor (`/api/auth`) resolve username → email com a chave de serviço e chama o Supabase. A chave de serviço nunca vai ao navegador, e nenhuma tabela administrativa é lida pelo frontend.
- Contas do modelo antigo (email fictício `@accounts.nacall.invalid`) e o sistema próprio de recuperação (`account_recovery`, `account_emails`) foram removidos pela migration `202611030002_auth_seguranca.sql`.

## Fluxos

| Fluxo | Passos |
| --- | --- |
| Cadastro | `signup` valida usuário, email e senha (12+ caracteres, confirmada) → Supabase cria a conta e envia o código → tela de código → `verify` confirma → volta ao login |
| Código | 6 dígitos, uso único, validade configurada no Supabase (10 min), reenvio com intervalo de 60 s |
| Login | Usuário **ou** email + senha. Resposta única para usuário inexistente e senha errada |
| Recuperação | `recover` (resposta igual exista ou não a conta) → código por email → `recover-confirm` com nova senha 12+ confirmada → sessões antigas são encerradas |
| 2FA | Após o primeiro login, um convite oferece ativar. Configurações → Segurança: QR Code TOTP → código de 6 dígitos → só então o 2FA vale. Gera 10 códigos de recuperação (aparecem uma vez) |
| Login com 2FA | Sessão `aal1` → tela de código do app (ou código de recuperação) → sessão `aal2` |
| Sessões | "Sair dos outros dispositivos" (`scope: others`) e "Sair de todos" (`scope: global`); trocar a senha encerra as outras sessões |

## Rotas (servidor)

| Rota | Ações | Observações |
| --- | --- | --- |
| `POST /api/auth` | `signup`, `verify`, `resend`, `login`, `recover`, `recover-confirm` | Valida com zod, confere a origem, limita tamanho e tentativas |
| `POST /api/auth/mfa` | `status`, `generate-codes`, `use-code`, `disable` | Exige Bearer; `generate-codes` e `disable` exigem sessão `aal2`; `disable` pede a senha |
| `POST /api/auth/password` | troca de senha logado | Exige a senha atual e, com 2FA, sessão `aal2` |
| `POST /api/livekit/token` e `/rooms` | — | Conta com 2FA só passa com sessão `aal2` |

As mesmas regras (`src/lib/auth-schema.ts`) rodam no navegador (feedback imediato) e no servidor (decisão).

## Proteções

- **Limites de tentativas** (`consume_rate_limit`, só `service_role`): por IP, por email, por usuário e por ação. O banco guarda somente o HMAC (SHA-256 com a chave de serviço), nunca IP ou email puros. Além disso valem os limites nativos do Supabase para envio de email e verificação de código.
- **Enumeração:** `login` devolve a mesma mensagem para usuário inexistente e senha errada; `recover` e `resend` respondem igual exista ou não a conta; o cadastro com email já usado responde como se tivesse funcionado (comportamento do Supabase com confirmação ligada). Exceção deliberada: o cadastro informa que o **username** já está em uso, necessário para a experiência.
- **Código inválido e expirado** compartilham uma mensagem: o Supabase não distingue os dois casos.
- **Cadastros abandonados:** o perfil nasce no cadastro, então `purge_unconfirmed_accounts()` libera nicks de contas não confirmadas há mais de 1 dia (executa a cada cadastro).
- **Códigos de recuperação do 2FA:** 10 códigos de 12 caracteres (~59 bits), só o hash SHA-256 fica em `mfa_recovery_codes` (RLS ligado, sem acesso de clientes). Usar um código desfaz o 2FA (o Supabase não tem "aal2 por código de backup") e a pessoa configura de novo. Gerar novos invalida os anteriores.
- **Sem segredos no código:** a service role só existe no servidor.

## Configuração necessária no Supabase (cada projeto: HML e PRD)

Sem isto o cadastro por código não funciona. Feito no painel, em cada projeto.

1. **Authentication → Sign In / Providers → Email:** Email ligado; **Confirm email ligado**; **Email OTP Expiration = 600** (10 minutos); OTP de 6 dígitos; **Minimum password length = 12**.
2. **Authentication → SMTP Settings → Enable Custom SMTP.** O envio padrão do Supabase só entrega para membros do time do projeto e tem limite baixíssimo, então não serve para usuários reais. Com Gmail:
   - Sender: `suporte.nacall@gmail.com`, nome `NACALL`.
   - Host `smtp.gmail.com`, porta `465`, usuário `suporte.nacall@gmail.com`.
   - Senha: uma **senha de app** do Google (exige verificação em duas etapas ligada na conta). Cadastre só no painel, nunca no repositório. Limite do Gmail: cerca de 500 emails/dia; para produção em escala, migrar para um provedor transacional.
3. **Authentication → Email Templates:** em **Confirm signup** e **Reset Password**, cole o conteúdo de `supabase/templates/confirmar-cadastro.html` e `supabase/templates/recuperar-senha.html`. Eles usam `{{ .Token }}` (o código de 6 dígitos) em vez de link.
4. **Authentication → Rate Limits:** com SMTP próprio, ajuste "emails sent per hour" (ex.: 30) e mantenha o intervalo de 60 s entre envios.
5. **Authentication → Multi-Factor:** TOTP habilitado (padrão).
6. **Authentication → URL Configuration:** Site URL do ambiente (`https://nacall-hml.vercel.app` em HML, `https://nacall.vercel.app` em PRD).

Na Vercel não há variável nova: continuam as seis de `.env.example`.

## Banco

Migration `202611030002_auth_seguranca.sql`: remove contas e tabelas do modelo antigo; cria `mfa_recovery_codes`, `consume_rate_limit` e `purge_unconfirmed_accounts`. Em HML e PRD ela apaga contas com email `@accounts.nacall.invalid` (dados de teste, decisão registrada).

## Login por QR Code (arquitetura planejada, não implementada)

Objetivo: entrar no desktop confirmando num celular já autenticado, sem digitar email e senha. A arquitetura atual comporta isso sem reestruturar o módulo.

**Tabela** `qr_login_requests` (RLS ligado, só `service_role`): `id uuid` (identificador público, aleatório de 128 bits), `secret_hash` (hash de um segredo de 256 bits que só o desktop conhece), `status` (`pending` → `approved` | `rejected` | `expired` | `consumed`), `approved_by uuid`, `device_hint` (navegador/SO/IP aproximado vindos do desktop), `created_at`, `expires_at` (≈ 2 min).

**Fluxo**
1. Desktop: `POST /api/auth/qr/start` → o servidor cria a solicitação e devolve `id` + `secret` (o segredo só vai ao desktop). O QR contém apenas uma URL com o `id`, **nunca tokens**.
2. Mobile (já logado) escaneia → `POST /api/auth/qr/inspect {id}` com Bearer: devolve a descrição do dispositivo solicitante e só vale para solicitações `pending` e não expiradas.
3. Usuário confirma ou rejeita na tela do celular → `POST /api/auth/qr/decide {id, approve}`. Exige sessão `aal2` se a conta tem 2FA. O servidor faz uma transição atômica `pending → approved` e grava `approved_by`.
4. Desktop consulta (polling curto ou Realtime) `POST /api/auth/qr/poll {id, secret}`. Se `approved`, o servidor marca `consumed` na mesma transação e gera a sessão: `admin.generateLink({type:'magiclink', email})` e devolve o `hashed_token` ao desktop, que chama `verifyOtp({token_hash, type:'email'})`.

**Propriedades de segurança**
- Identificador aleatório e imprevisível; expiração curta; **uso único** (`consumed`); a vinculação ao pedido original vem do `secret` que só o desktop tem (o QR sozinho não libera nada).
- QR adulterado ou `id` inexistente: resposta única, sem detalhes. Replay: segunda leitura ou segundo `poll` de uma solicitação `consumed` falha.
- Confirmação explícita no dispositivo autenticado, mostrando de onde vem o pedido; a sessão só é liberada depois da aprovação registrada no backend.
- Limites de tentativas por IP e por `id` (`consume_rate_limit`), e limite de solicitações abertas por IP.
- Quem aprova com 2FA ativo precisa estar em `aal2`; a sessão criada para o desktop passa pelo mesmo desafio de 2FA se a conta o exigir.

## Riscos e limites conhecidos

- **Dependência do SMTP:** sem o Gmail configurado nos dois projetos, ninguém recebe o código. O Gmail tem limite diário.
- **`aal2` só é exigido pelas nossas APIs** (livekit e rotas de segurança). O acesso direto do navegador ao banco via PostgREST usa apenas o RLS por usuário; um token `aal1` de uma conta com 2FA continuaria lendo dados que o RLS permite. Fechar isso pede políticas restritivas com `auth.jwt()->>'aal'` em cada tabela, planejado como evolução.
- **Listagem de dispositivos:** o Supabase não expõe a lista de sessões ao cliente, então só há "sair dos outros" e "sair de todos". Mostrar dispositivos exigiria registrar sessões em tabela própria.
- **Usar um código de recuperação desativa o 2FA** até a pessoa configurar de novo.
- **Admins:** 2FA obrigatório para contas administrativas foi avaliado e fica como decisão futura (hoje a conta de dono do grupo é um papel do app, não uma conta administrativa do Supabase).

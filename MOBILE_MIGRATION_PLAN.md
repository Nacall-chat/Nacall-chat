# NACALL Mobile — plano de migração (Android e iOS)

> **Estado:** proposta para aprovação. **Nenhum código do app foi escrito.** Esta branch (`feature/mobile-app`) só contém este documento.
> Fontes: análise do repositório (somente leitura) e documentação oficial lida em 2026-11-20: Expo (DOM components, Router, Notifications, Audio, índice do SDK), LiveKit (Expo quickstart) e Supabase (Auth com React Native). Onde algo **não foi verificado**, está marcado como _a validar_.

---

## 0. Resumo

- **Dá para reaproveitar quase todo o backend** (Supabase: banco, RLS, Realtime, Storage, Auth; LiveKit; as rotas `/api/*` na Vercel). O que muda é a **camada de interface** e as integrações que dependem do navegador.
- A tela **não** será uma WebView do site. A interface será **React Native + Expo + Expo Router**, com componentes nativos, gestos e animações.
- A **call de voz e vídeo** é o maior risco e o maior trabalho: exige o SDK nativo do LiveKit, **não roda no Expo Go** (só em _development build_) e deve ter um **protótipo (spike) antes** de qualquer outra coisa.
- O **site e o app de desktop não mudam**. O app novo mora em `apps/mobile`, fora do `pnpm install` da raiz, para não afetar o build da Vercel nem a CI atual.
- **Pontos que dependem de decisão sua** estão na seção 12 (principalmente: a Loja/Asaas em iOS, notificações push e a conta de desenvolvedor da Apple).

---

## 1. Análise do projeto (Etapa 1)

### 1.1 Stack atual

| Camada | Tecnologia |
| --- | --- |
| Framework web | **Next.js 16** (App Router, build com webpack), **React 19**, **TypeScript 5.9** |
| Estilo | **CSS próprio** (~130 KB em `src/app/*.css`) + variáveis de tema (claro/escuro) e Tailwind 4 só como base |
| Banco e backend | **Supabase** (Postgres + RLS, Realtime, Storage, Auth) |
| Voz e vídeo | **LiveKit** (`livekit-client`, `@livekit/components-react`; token gerado no servidor com `livekit-server-sdk`) |
| Pagamentos | **Asaas** (Pix/cartão, webhook), produtos cosméticos Jacall Plus e Call Pro |
| Hospedagem | **Vercel** (HML = `release`, PRD = `main`, publicação por "Run workflow") |
| Desktop | **Electron** (`desktop/`, Windows) que abre o site |
| Testes | `node:test` via `tsx` (35 arquivos, inclui testes de banco com PGlite e RLS) |
| Gerenciador | **pnpm 11**, Node ≥ 22 |

Código: ~3,7 mil linhas de TS/TSX em `src/` (linhas muito densas), 16 migrations em `supabase/migrations`, 13 documentos em `docs/`.

### 1.2 Backend, banco, autenticação e APIs

- **Autenticação:** Supabase Auth (email com código de 6 dígitos, senha mínima de 12, MFA TOTP). Login também por **username**, resolvido no servidor (`/api/auth`) com a chave de serviço. Detalhes em `docs/AUTH.md`.
- **Acesso a dados:** o navegador fala **direto com o Supabase** (`supabase-js` com a chave anônima) e a segurança fica no **RLS**. Isso é uma vantagem para o app: o mesmo cliente e as mesmas regras servem ao celular.
- **Rotas do servidor (Next, Vercel)** — todas por HTTPS e com `Authorization: Bearer <token do Supabase>`:

| Rota | Uso | Reaproveitável no app? |
| --- | --- | --- |
| `POST /api/auth` | cadastro, código, login, recuperação | Sim (fetch). O servidor só recusa quando há cabeçalho `Origin` diferente do host; apps nativos não enviam `Origin` → deve funcionar sem mudar (_a validar_). |
| `/api/auth/mfa`, `/email`, `/password` | 2FA, email pendente, trocar senha | Sim |
| `POST /api/livekit/token` | token da sala de voz (exige `aal2` se a conta tem 2FA) | Sim |
| `POST /api/livekit/rooms` | quem está em cada sala + relógio do servidor | Sim |
| `/api/music/info` | título do vídeo do YouTube | Sim |
| `/api/payments/*` | checkout Asaas, benefícios, webhook | Sim, mas **ver risco de loja (seção 11)** |
| `GET /api/version` | versão do site | Não se aplica |

- **Dados** (nomes vistos no código): tabelas `profiles`, `friendships`, `servers`, `server_members`, `channels`, `dms`, `messages`, `room_media`, `stickers`, papéis de servidor, presença e leitura de DMs; ~20 funções RPC (ex.: `open_dm`, `unread_dms`, `mark_dm_read`, `friends_presence`, `touch_presence`, `create_server`, `join_server`); buckets `avatars`, `chat-audio`, `group-icons`, `profile-covers`, `stickers`; Realtime (`postgres_changes`) em mensagens, amizades e leitura de DMs.
- **Variáveis de ambiente** (só nomes): públicas `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`; **somente servidor** `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_*`, `ASAAS_*`. O app **só pode conter as duas públicas** (como `EXPO_PUBLIC_*`) e a URL base da API.

### 1.3 Funcionalidades e telas existentes

| Área | O que existe hoje | Onde (arquivos principais) |
| --- | --- | --- |
| Entrada | Landing, login, cadastro com código, recuperar senha, 2FA, email de contas antigas | `landing.tsx`, `auth.tsx`, `mfa.tsx`, `email-update.tsx` |
| Navegação | Barra de servidores, lista de canais/DMs, gaveta no celular, sino | `app.tsx`, `use-drawer-swipe.ts`, `notification-bell.tsx` |
| Amigos | Online / Em call / Todos / Pendente, adicionar por nome ou `#número`, presença | `friends-panel.tsx`, `use-presence.ts` |
| Chat (DM e canais) | Texto, balões, histórico com paginação, Realtime, não lidas e som | `app.tsx`, `composer.tsx`, `message-content.tsx`, `use-unread.ts` |
| Mídia no chat | Áudio gravado, figurinhas (editor e coleção), emojis (~1.800) | `use-audio-recorder.ts`, `audio-player.tsx`, `sticker-*.tsx`, `chat-picker.tsx` |
| Call | Sala de voz/vídeo, mic/fone, câmera, **compartilhamento de tela**, quem fala, cronômetro, DJ (YouTube sincronizado) | `voice.tsx`, `voice-bar.tsx`, `mic-gate.tsx`, `music.tsx` |
| Perfil | Cartão (capa, foto, bio, em call, membro desde), editar perfil, capa/foto | `profile-card.tsx`, `profile-settings.tsx`, `profile-cover-editor.tsx` |
| Servidores | Criar, convidar (link com validade), entrar, papéis e permissões, ícone | `group-settings.tsx`, `invite.tsx` |
| Ajustes | Aparência (claro/escuro/sistema), voz (supressão de ruído etc.), segurança | `preferences.tsx`, `mfa.tsx` |
| Loja | Jacall Plus e Call Pro via Asaas | `store-panel.tsx` |
| Outros | Novidades ("O que há de novo"), contagem da comunidade | `whats-new.tsx`, `community-count.tsx` |

### 1.4 Bibliotecas e APIs que **não** funcionam em React Native

| Hoje (web) | Problema no app | Substituto proposto |
| --- | --- | --- |
| `next/*` (`link`, `navigation`, `dynamic`, `server`) | Específico do Next | **Expo Router** (`expo-router`) |
| `react-dom` (`createPortal`), elementos HTML, CSS | Não existe DOM nem CSS | Componentes RN + `StyleSheet` + _design tokens_ |
| `lucide-react` | Gera elementos DOM | `lucide-react-native` + `react-native-svg` |
| `@livekit/components-react` e `livekit-client` na web | Dependem de WebRTC do navegador | `@livekit/react-native`, `@livekit/react-native-webrtc`, plugin de config do Expo, `livekit-client` (doc oficial do LiveKit) |
| `<dialog>` / `showModal()` | Não existe | Modais nativos e _bottom sheet_ |
| `localStorage` | Não existe | `@react-native-async-storage/async-storage` (usado pelo Supabase) |
| `MediaRecorder`, `AudioContext`, `new Audio()` | Não existe | `expo-audio` (gravar e tocar) |
| `navigator.mediaDevices`, `setSinkId`, `enumerateDevices` (escolha de microfone/saída) | Não existe; no celular o sistema controla | Permissões nativas; saída de áudio pelo `AudioSession` do LiveKit |
| `getDisplayMedia` (tela) | Diferente no celular | Compartilhamento de tela nativo do LiveKit (Android com serviço em primeiro plano; iOS com _broadcast extension_) — **complexo, ver fase 3** |
| `canvas`, `createImageBitmap` (figurinhas, capa, foto) | Não existe | `expo-image-manipulator`, `expo-image-picker`; editor de figurinhas pode ficar em **Expo DOM** no começo |
| `Notification`, som de aviso | Web | `expo-notifications` (push) e `expo-audio` |
| `navigator.clipboard`, `requestFullscreen`, `matchMedia`, `visibilityState`, `pagehide` | Web | `expo-clipboard`, orientação/tela cheia nativas, `Dimensions`/`useWindowDimensions`, `AppState` |
| Player do YouTube por iframe (`music.tsx`) | Iframe | `react-native-youtube-iframe` (WebView) ou **Expo DOM** |
| `qrcode-generator` (QR do 2FA) | Gera HTML | Funciona como lógica; desenhar com `react-native-svg` |
| `zod`, `@supabase/supabase-js` | **Compatíveis** | Mantidos |
| `emojibase-data` | JSON, **compatível** | Mantido (carregar sob demanda por tamanho) |
| `livekit-server-sdk`, `asaas`, rotas `route.ts` | Só servidor | **Ficam como estão** na Vercel |

### 1.5 O que precisa de adaptação para dispositivos móveis

- **Ciclo de vida:** app em segundo plano (Realtime e presença; `AppState`); renovação de sessão do Supabase só com o app ativo (padrão da doc do Supabase).
- **Permissões:** microfone, câmera, notificações e (iOS) tela. Texto de justificativa em português.
- **Teclado e áreas seguras** (notch, barra de gestos), **orientação**, **tela cheia** de vídeo.
- **Notificações push** (hoje só o sino com o app aberto).
- **Link de convite** (`?invite=`) → _deep link / universal link_.
- **Áudio da call:** sessão de áudio, Bluetooth, alto-falante, chamadas do sistema, tela bloqueada.
- **Desempenho de listas** (mensagens, membros, emojis): `FlashList`, imagens em cache.

---

## 2. Ferramentas (Etapa 2)

### 2.1 Plugin e skills (agente)

- **Plugin oficial `expo`** (publicado pela Expo Team, nível "partner" no diretório): **estava desabilitado** na sua conta. Mostrei o cartão de instalação; **a ativação é sua** (o app não permite que eu ative sozinho).
- Ele traz as skills que cobrem tudo o que você pediu, **sem precisar de mais nenhum plugin**:

| Necessidade | Skill do plugin `expo` |
| --- | --- |
| Migração Web → nativo | `expo-web-to-native` |
| React Native e Expo (visão, estrutura de projeto) | `expo-overview`, `expo-project-structure`, `expo-native-ui` |
| Navegação (Expo Router) | `expo-router` |
| Design system e UI mobile | `expo-design-system`, `expo-ui` |
| Animações e gestos | `expo-animation` |
| APIs e dados | `expo-data-fetching` |
| Reaproveitar web via Expo DOM | `expo-dom` |
| Teste em simulador/dispositivo | `eas-simulator`, `expo-dev-client` |
| Builds e lojas | `eas-app-stores`, `eas-workflows`, `eas-update`, `eas-observe` |
| Módulos nativos / upgrade | `expo-module`, `expo-upgrade` |

- **Não instalados de propósito:** os outros plugins de React Native do diretório (comunitários) — duplicam o que o plugin da Expo já cobre; um deles tem hooks e acesso amplo ("privileged"), então não vale o risco.

### 2.2 Dependências do projeto (instalar só **depois** da aprovação)

Lidas na documentação oficial; versões exatas são fixadas pelo `npx expo install` na hora (para casar com o SDK):

- Base: `expo`, `react-native`, `expo-router`, `expo-dev-client`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-screens`.
- Dados e sessão: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill` (receita oficial do Supabase para RN; `detectSessionInUrl: false` e `AppState` para o auto-refresh).
- Call: `@livekit/react-native`, `@livekit/react-native-webrtc`, `@livekit/react-native-expo-plugin`, `@config-plugins/react-native-webrtc`, `livekit-client` (registrar com `registerGlobals()`; **incompatível com o Expo Go**).
- Mídia: `expo-audio`, `expo-image`, `expo-image-picker`, `expo-image-manipulator`, `expo-clipboard`, `expo-haptics`.
- Notificações: `expo-notifications` (push no Android desde o SDK 53 **exige** _development build_; tokens FCM/APNs).
- UI: `lucide-react-native`, `react-native-svg`, `@shopify/flash-list`, `@gorhom/bottom-sheet`.
- Ambiente local: **você está no Windows**. Android Studio serve para o emulador Android. **iOS não roda no Windows**: o build do iPhone é feito na **nuvem (EAS Build)** e o teste é em **iPhone físico** (build interno/TestFlight).

### 2.3 Ambiente

- Conta Expo (EAS) e, para as lojas, conta **Google Play Console** e **Apple Developer Program** (ambos pagos; valores e prazos a confirmar nas páginas oficiais na hora).
- Tudo apontando para **HML** (Supabase de homologação e `nacall-hml.vercel.app`) até a aprovação final. **Nenhuma credencial de produção em desenvolvimento.**

---

## 3. Arquitetura proposta (Etapa 4)

**Princípio:** preservar os serviços que funcionam; trocar apenas a interface e o que depende do navegador.

```
 Celular (Expo / React Native)
   ├─ Expo Router (navegação por arquivos, abas, modais)
   ├─ Telas nativas (RN) ── hooks portados do site (presença, não lidas, Realtime)
   ├─ supabase-js  ───────────► Supabase (Auth, Postgres+RLS, Realtime, Storage)  [igual ao site]
   ├─ fetch Bearer ───────────► /api/* na Vercel (auth, token LiveKit, salas, pagamentos) [igual ao site]
   └─ @livekit/react-native ──► LiveKit (WebRTC)                                   [mesmo servidor]
```

### 3.1 Decisões técnicas

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Framework | **Expo SDK 58 (estável atual: `npm view expo` → 58.0.x) + React Native 0.88 + React 19.3 + TypeScript** | Pedido; ferramentas oficiais para build e lojas. Verificado na Fase 0 (`create-expo-app` e `expo-doctor` 20/20). |
| Navegação | **Expo Router** | Rotas por arquivos, layouts, abas, modais e _deep links_ |
| Layout principal | `Drawer` (gaveta com a coluna de servidores + lista de canais) e rotas empilhadas | É o desenho que já validamos no celular |
| Perfil | _Bottom sheet_ animado (sobe de baixo, não cobre a tela toda) | Pedido recente do produto |
| Estado | Hooks + Context (como no site); **sem Redux** | Evita dependência desnecessária; o estado forte vem do Supabase/Realtime |
| Estilo | `StyleSheet` + **tokens** extraídos das variáveis CSS (`--bg`, `--surface`, `--accent`…), claro/escuro/sistema | NativeWind com Tailwind 4 _não foi verificado_ como estável; o site usa CSS próprio mesmo |
| Animação/gestos | `react-native-reanimated` + `react-native-gesture-handler` | Padrão oficial; sheets e arrastar a gaveta |
| Listas | `FlashList` | Mensagens e membros |
| Sessão | AsyncStorage (receita oficial). _Avaliar_ `expo-secure-store` na revisão de segurança (limite de tamanho por item) | Sessão do Supabase |
| Call | `@livekit/react-native` em _development build_ | Único caminho oficial |
| Push | `expo-notifications` + FCM/APNs; **requer backend novo** (seção 5) | Sem isso só há aviso com o app aberto |

### 3.2 Expo DOM (reuso temporário do site) — vantagens e limitações

O Expo DOM (`'use dom'`) renderiza um componente **web** dentro do app, numa WebView, e o resto continua nativo.

- **Vantagens:** reaproveita rápido telas web complexas; mesmo _bundler_; depuração pelo Safari/Chrome.
- **Limitações (documentação oficial):**
  - roda numa **WebView** (desempenho e sensação menos "nativos");
  - **props viajam por uma ponte assíncrona**, e mudar uma prop **re-renderiza toda a árvore** do componente;
  - **funções só como props de nível superior** ("native actions"), sempre assíncronas e com argumentos serializáveis; callbacks aninhados e _refs_ são desaconselhados;
  - arquivos públicos (`public/`) não são suportados no Expo Update.
- **Onde usar (provisório):** editor de figurinhas (canvas), player do YouTube (DJ) e talvez o QR do 2FA.
- **Onde **não** usar:** chat, listas, navegação, call, perfil — o foco é experiência nativa.

---

## 4. Estrutura de pastas

```
Nacall-chat/
├─ src/ …                    site atual (NÃO muda)
├─ desktop/ …                app Windows (NÃO muda)
├─ supabase/ …               migrations (só mudam com aprovação, aditivas)
├─ MOBILE_MIGRATION_PLAN.md  este documento
└─ apps/mobile/              NOVO — independente da raiz
   ├─ package.json, package-lock.json (npm, próprios), app.json, metro.config.js, eas.json (Fase 5), tsconfig.json
   ├─ src/app/                     Expo Router (pasta `src/app`, padrão do SDK 58)
   │  ├─ _layout.tsx               provedores (sessão, tema, presença)
   │  ├─ (auth)/                   entrar, cadastro, código, recuperar, 2FA
   │  └─ (app)/                    _layout = Drawer (servidores + canais/DMs)
   │     ├─ index.tsx              Amigos
   │     ├─ dm/[id].tsx            conversa privada
   │     ├─ channel/[id].tsx       canal de texto
   │     ├─ call/[id].tsx          sala de voz/vídeo
   │     ├─ profile/[id].tsx       perfil (modal tipo sheet)
   │     └─ settings/…             perfil, aparência, voz, segurança, loja
   ├─ src/
   │  ├─ components/               UI nativa (Avatar, Bubble, Sheet…)
   │  ├─ features/                 social, chat, call, profile, settings
   │  ├─ hooks/                    useSession, usePresence, useUnread, useRooms
   │  ├─ lib/                      supabase.ts, api.ts (fetch Bearer), notifications.ts
   │  └─ theme/                    tokens claro/escuro
   └─ modules/ (se precisar)       módulo nativo Expo (ex.: serviço de call em 1º plano)
```

**Fora do `pnpm install` da raiz:** o `apps/mobile` usa **npm** (o padrão do Expo e do EAS) com lockfile próprio, não entra no `pnpm-workspace.yaml` e é ignorado pelo `tsconfig` e pelo build da Vercel (`.vercelignore`). A CI ganha um **workflow próprio** (como o `windows-desktop.yml`), disparado só quando `apps/mobile/**` muda. Assim o site e a Esteira atuais seguem intactos.

---

## 5. Reutilização do backend

| Camada | Estratégia |
| --- | --- |
| Banco, RLS, RPCs, Storage, Realtime | **Reuso total**, mesmo projeto Supabase (HML primeiro). Sem mudar nada para as telas que já existem. |
| Auth | Mesmo Supabase Auth; `/api/auth*` por `fetch`. |
| LiveKit | Mesmo servidor e mesmas rotas `/api/livekit/*`. |
| **Backend novo (somente se aprovado)** | (a) **Push:** tabela aditiva `device_tokens` + envio (função no servidor) quando chega mensagem; (b) possivelmente ajuste de CORS/origem se a validação mostrar necessidade; (c) decisão de Loja (seção 11). Cada item entra por **migration aditiva testada com PGlite**, aplicada primeiro em HML. |

---

## 6. O que é compartilhado com o site e o que será reconstruído

**Compartilhar (TypeScript puro, sem DOM):** regras de validação e de autenticação (`auth-schema`, `validation`), identidade (`identity`), presença (`presence`), não lidas (`unread`), relógio da sala (`room-clock`), quem fala (`speaking`), perfil (`profile-info`), tipos (`types`), avisos/novidades. A classificação do `src/lib` mostrou ~15 módulos sem dependência de navegador.
- **Como, sem tocar no site:** `apps/mobile` importa esses arquivos por **alias do Metro/TS** apontando para `../../src/lib` (somente leitura). **Fase posterior (opcional):** mover para `packages/core` e fazer o site importar de lá, em PR separado.
- Os testes existentes desses módulos continuam valendo.

**Reconstruir (UI e APIs de navegador):** todas as telas e componentes; gravação/reprodução de áudio; escolha de imagem/corte (foto, capa, figurinhas); a call (SDK nativo); notificações; compartilhamento de tela; player do YouTube; QR do 2FA (desenho); modais e gaveta (gestos nativos); tema.

---

## 7. Autenticação (estratégia)

1. Mesmo fluxo do site: cadastro com código de email, login por **username ou email**, recuperação, **2FA TOTP** (`aal2`) e código de recuperação.
2. O app chama `POST /api/auth` (como o site) e entrega a sessão ao `supabase-js` (`setSession`).
3. Sessão persistida em AsyncStorage; `autoRefreshToken` ligado só com o app em primeiro plano (`AppState`), conforme a doc do Supabase.
4. Nenhuma chave de serviço no app. Só `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` e a URL da API.
5. **Contas com 2FA:** o app precisa de sessão `aal2` para pedir token da call (regra que o servidor já aplica).
6. _A validar:_ o limite de tentativas por IP/email continua funcionando atrás de redes móveis (IPs compartilhados).

---

## 8. Navegação (estratégia)

- **Raiz:** grupos `(auth)` e `(app)` (redireciona conforme a sessão).
- **`(app)`:** **Drawer** com a coluna de servidores (ícones, bolinha vermelha de não lidas) e a lista de canais/DMs; abre pelo botão ou **arrastando para a direita** (como já fizemos no site).
- **Telas:** Amigos (início), conversa (DM e canal), call (tela cheia ou minimizada em barra), Ajustes (pilha).
- **Perfil:** rota modal apresentada como **bottom sheet** (sobe de baixo, arrastar para fechar).
- **Barra de voz:** componente fixo no rodapé enquanto há call, em toda tela.
- **Deep links:** convite (`nacall.site/?invite=…`) abre o app (universal links / app links — exige arquivos de associação no domínio; _a validar_).

---

## 9. Compatibilidade Android e iOS

| Tema | Android | iOS |
| --- | --- | --- |
| Versões mínimas | definidas pelo SDK do Expo escolhido (_a validar_) | idem |
| Call em segundo plano | serviço em primeiro plano + notificação persistente | modo de áudio em segundo plano (`UIBackgroundModes`) |
| Compartilhar tela | MediaProjection (serviço em primeiro plano) | _Broadcast Upload Extension_ (mais trabalhoso) |
| Push | FCM (v1) | APNs |
| Build | EAS Build (nuvem) ou local | **EAS Build (nuvem)** — você está no Windows |
| Teste | emulador Android Studio e aparelho | **iPhone físico** (build interno/TestFlight) |
| Loja | Google Play | App Store (revisão mais rígida) |
| Pagamento de itens digitais | regras de cobrança da Google | **regras de _In-App Purchase_ da Apple** (seção 11) |

Ambos usam **a mesma base de código**; as diferenças ficam em arquivos de configuração e módulos nativos.

---

## 9.1 Funcionalidades: o que migra e quando

| Funcionalidade | Fase | Estratégia |
| --- | --- | --- |
| Login, cadastro, recuperação, 2FA | 0–1 | Reconstruir (telas), reaproveitar API e regras |
| Amigos + presença + perfil (sheet) | 1 | Reconstruir; regras compartilhadas |
| DMs e canais de texto, Realtime, não lidas, sino | 1 | Reconstruir; hooks portados |
| Gaveta de servidores, criar/entrar/convite | 1–2 | Reconstruir |
| Áudio no chat, emojis, figurinhas | 2 | Reconstruir (`expo-audio`); editor de figurinhas em Expo DOM no início |
| **Call de voz/vídeo, quem fala, cronômetro** | **3 (com spike antes)** | Reconstruir com SDK nativo |
| Compartilhar tela | 3 (opcional) | Nativo; pode ficar para depois |
| DJ (YouTube sincronizado) | 3 | Expo DOM / player nativo |
| Ajustes (aparência, segurança, perfil, capa) | 2–4 | Reconstruir |
| Push | 4 | **Backend novo + FCM/APNs** |
| Loja (Asaas) | **decisão** | Ver seção 11 |
| Modo claro/escuro | 0 | Tokens do tema |
| Landing | — | Não migra (o app abre direto no login) |

---

## 10. Cronograma (estimativa, 1 pessoa + agente; sujeito ao spike da call)

| Fase | Entrega | Estimativa |
| --- | --- | --- |
| **0 — Fundação** | App Expo em `apps/mobile`, development build Android, tokens de tema, CI própria, cliente Supabase, login/cadastro/2FA contra HML | 1–2 semanas |
| **0.5 — Spike da call** | Entrar numa sala LiveKit (HML) com áudio no Android e no iPhone físico; medir áudio em segundo plano | 3–5 dias |
| **1 — Núcleo social** | Drawer, Amigos, presença, DMs/canais de texto, não lidas, perfil em sheet | 2–3 semanas |
| **2 — Mídia e mais** | Áudio, emojis, figurinhas, fotos/capa, criar/entrar em servidor, convites | 2–3 semanas |
| **3 — Call completa** | Voz/vídeo, barra de voz, quem fala, cronômetro, (tela, DJ) | 3–4 semanas |
| **4 — Push, Ajustes, Loja** | Push com migration aditiva, segurança, decisão de pagamentos | 2 semanas |
| **5 — Qualidade e lojas** | Testes em aparelhos, beta fechado (TestFlight/teste interno), política de privacidade, envio às lojas | 2–3 semanas |

Total aproximado: **12–18 semanas**. Cada fase termina em **PR para a `release`**, testado em HML, como o fluxo atual.

---

## 11. Riscos técnicos

1. **Call nativa (alto).** SDK com código nativo; não roda no Expo Go; áudio em segundo plano, Bluetooth e interrupções diferem entre aparelhos. _Mitigação:_ spike antes de tudo; testar em aparelhos reais.
2. **Compartilhar tela no iPhone (alto).** Exige _broadcast extension_. _Mitigação:_ deixar para a fase final ou fora do primeiro lançamento.
3. **Cobrança de itens digitais (alto, de negócio).** Jacall Plus e Call Pro são benefícios digitais vendidos via Asaas (Pix/cartão). As lojas costumam exigir **compra no app** (Apple In-App Purchase / cobrança da Google) para esse tipo de item. _Mitigação:_ **lançar sem a Loja no app** (esconder/ocultar) ou decidir um fluxo de pagamento por loja — **decisão sua** e conferir as diretrizes atuais das lojas antes.
4. **iOS sem macOS (médio).** Sem simulador local; depende de EAS Build e iPhone físico. _Mitigação:_ ter um iPhone de teste; builds na nuvem.
5. **Push (médio).** Precisa de backend novo, credenciais FCM/APNs e tratamento de tokens inválidos. _Mitigação:_ migration aditiva em HML, fase própria.
6. **Segurança (médio).** Sessão no aparelho, nada de segredo no app, limite de tentativas atrás de IPs compartilhados, _deep links_ de convite. _Mitigação:_ revisão de segurança antes do beta; só variáveis públicas.
7. **Desempenho (médio).** Listas longas, imagens e GIFs animados (capa) no celular. _Mitigação:_ `FlashList`, `expo-image`, limites de tamanho.
8. **Manutenção em duas bases (médio).** Regras duplicadas podem divergir. _Mitigação:_ compartilhar TS puro; documentar contratos; testes.
9. **Expo DOM (baixo/médio).** Desempenho e ponte assíncrona. _Mitigação:_ uso provisório e pontual.
10. **Lojas (médio).** Revisão, política de privacidade, classificação etária, contas pagas. _Mitigação:_ começar o cadastro cedo.
11. **Esforço de conhecimento do produto:** só o Android foi imaginado por inteiro; o iPhone entra com limites claros acima.

---

## 12. Decisões que preciso de você (aprovação)

1. **Plataforma primeiro:** Android + iPhone juntos ou **Android primeiro**? (iPhone exige iPhone físico e conta Apple.)
2. **Loja (Asaas) no app:** ficar fora do primeiro lançamento (recomendado) ou tratar já?
3. **Push:** entra no primeiro lançamento? (exige migration nova e credenciais FCM/APNs.)
4. **Compartilhar tela no celular:** fora do primeiro lançamento?
5. **Identificador do app** (por exemplo `app.nacall.mobile`) e **nome nas lojas**; quem cria as contas de desenvolvedor.
6. **Estrutura:** `apps/mobile` independente (recomendado) ou repositório separado?
7. **Ativar o plugin `expo`** na sua conta (o cartão foi exibido).

**Enquanto você não aprovar, nada de implementação começa.**

---

## 13. Segurança e preservação (garantias)

- Branch `feature/mobile-app`; PRs para a `release`, HML, depois produção — **o fluxo de hoje não muda**.
- **Site, backend, banco e desktop não são alterados** por este plano. Mudanças de backend só por migration aditiva, com testes, em HML primeiro, e **com a sua aprovação**.
- Nenhuma chave de serviço, segredo ou variável privada entra no app ou no repositório.
- Nenhum deploy automático; builds de loja só quando você mandar.

---

## 14. Andamento

### Fase 0 — Fundação (concluída no código; falta teste em aparelho)

Entregue em `apps/mobile` (PR da branch `feature/mobile-app`):
- App **Expo SDK 58** + Expo Router com **rotas protegidas** (`(auth)`, `mfa`, `(app)`), tema claro/escuro/sistema com os mesmos tokens do site, cliente Supabase (AsyncStorage, renovação de sessão só em primeiro plano), cliente das rotas `/api` (Bearer, tempo limite, mensagens de erro).
- **Telas:** entrar (usuário ou email), cadastro com verificação ao vivo de usuário/email, código de email, recuperar senha, **2FA** (app autenticador e código de recuperação) e uma tela inicial provisória que lê o perfil (prova de sessão + RLS).
- **Reuso do site sem tocar nele:** `validation` e `auth-schema` (TS puro) importados de `../../src/lib` via `@nacall/core/*`.
- **Proteções:** raiz com `tsconfig` e `.vercelignore` excluindo `apps`; workflow próprio `mobile.yml` (tipos, testes, bundle Android) por `paths`.
- **Verificação:** `tsc` limpo, **21 testes** (inclui conferência de contraste e de que as cores do app são as do `jacall.css`), `expo export` Android gerou o bundle Hermes **também sem o `node_modules` da raiz** (condição da CI), `expo-doctor` 20/20 e fluxo de login/cadastro/tema exercitado na versão web contra um servidor de mentira local.
- **Não verificado:** execução em **Android/iPhone reais ou emulador**, login contra a **HML de verdade**, 2FA real, teclado/áreas seguras no aparelho.

### Fase 1 — Núcleo social (em andamento: primeira entrega no código)

Entregue em `apps/mobile` (PR `feature/mobile-fase-1`):
- **Gaveta** (Drawer do Expo Router) com a coluna de servidores (Início + os seus, com a bolinha de call e a soma de não lidas), lista de canais de texto e de voz (quem está em cada sala e o cronômetro), amigos e mensagens diretas ordenadas por não lidas; abre pelo botão ou arrastando de qualquer ponto da tela.
- **Amigos:** abas Online / Em call / Todos / Pendente, busca, adicionar por nome #número ou @usuário, aceitar, recusar, cancelar e remover (com confirmação), presença (online, ausente, offline).
- **Conversas e canais de texto:** balões (os seus à direita), histórico com paginação, tempo real do Supabase + reconciliação a cada 15 s, envio de texto, **não lidas** (marca como lida ao abrir). Áudio e figurinha aparecem como aviso até terem tela própria.
- **Perfil em folha** (sobe de baixo, arrasta para fechar): em voz, sobre mim, membro do NACALL desde, e as ações (mensagem, solicitação, aceitar, recusar).
- **Ajustes:** tema, status de presença e sair.
- Regras compartilhadas com o site (`presence`, `unread`, `identity`, `profile-info`, `room-clock`, `types`) importadas de `src/lib`.
- **Verificação:** `tsc` limpo e testes das regras (amigos, conversas, mensagens, endereços de imagem); fluxo visto na versão web contra um servidor de mentira local (login, gaveta, servidor e canais, envio de mensagem, DM com balões, perfil, pedidos pendentes).
- **Não verificado:** execução em celular/emulador, Realtime de verdade (o servidor de mentira não tem websocket), push, gestos reais de arrastar com o dedo, e o app contra a HML de verdade.
- **Fica para as próximas entregas:** criar/entrar em servidor e convites, editar perfil/capa/foto, áudio e figurinhas, 2FA nos Ajustes, push, e a call.

### Próximo: Fase 0.5 — Spike da call
Entrar numa sala LiveKit (HML) com áudio no Android e no iPhone físico. Exige um _development build_ (conta Expo e, para iPhone, conta Apple) e aparelho; ainda não iniciado.

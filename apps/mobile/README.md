# NACALL Mobile (Android e iOS)

App nativo em **Expo (SDK 58) + React Native + Expo Router**. Reaproveita o backend do site (Supabase, LiveKit e as rotas `/api`) — veja `../../MOBILE_MIGRATION_PLAN.md`.

> **Fase 0 (atual):** base do app, tema claro/escuro, login, cadastro, código de email, recuperar senha e 2FA. Amigos, conversas, servidores e call chegam nas próximas fases.

## Rodar
```
cd apps/mobile
npm install
cp .env.example .env.local     # só valores PÚBLICOS, da HOMOLOGAÇÃO
npx expo start                 # w = navegador, a = Android
```
- **Expo Go** serve para as telas desta fase. A **call** (LiveKit) exige um _development build_ (`expo-dev-client`), e o **iPhone** só compila na nuvem (EAS Build) e testa em aparelho físico.
- Sem `.env.local`, o app mostra a tela "O app ainda não foi configurado" (nunca exibe valores).

## Verificar
```
npm run typecheck && npm test
npx expo export --platform android   # confere o bundle
npx expo-doctor
```

## Regras
- Só variáveis `EXPO_PUBLIC_*` (visíveis em texto puro no app). **Nunca** coloque chave de serviço, LiveKit ou Asaas aqui.
- Código compartilhado com o site: só TypeScript puro de `../../src/lib` (`validation`, `auth-schema`), importado como `@nacall/core/*`. Não importe nada de `next/*` nem do DOM.
- O app é independente da raiz: tem `package-lock.json` próprio e fica fora do `pnpm install`, do `tsconfig` e do build da Vercel do site.

## Instalar o APK de teste no celular Android (sem Expo Go e sem Android Studio)
O APK é compilado pela CI do GitHub e publicado como **pré-release** do repositório.
1. **Uma vez só**, em GitHub > Settings > Secrets and variables > Actions > **Variables**, cadastre os valores **públicos da homologação**: `MOBILE_SUPABASE_URL` e `MOBILE_SUPABASE_ANON_KEY` (opcional: `MOBILE_API_URL`, padrão `https://nacall-hml.vercel.app`). Nada de chave de serviço.
2. GitHub > Actions > **Mobile · APK de teste (Android)** > **Run workflow**. Leva uns 15 a 25 minutos.
3. No fim, abra **Releases** pelo celular (logado no GitHub), baixe o `.apk` e toque nele. Se o Android pedir, permita instalar apps desta fonte.
- É um app de **teste**: aponta para a homologação e é assinado com a chave de depuração (não serve para as lojas). Só celulares Android 64 bits (arm64), que são quase todos os atuais.
- Não aparece na landing page: o repositório é privado e o app ainda é a Fase 0.

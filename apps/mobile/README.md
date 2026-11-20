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

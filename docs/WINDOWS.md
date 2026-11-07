# NACALL Desktop — Windows (primeira versão instalável)

O NACALL já funciona no navegador. Esta primeira entrega acrescenta suporte a **instalação como aplicativo web (PWA)** no Windows, sem duplicar a base de código de voz e mensagens.

## Instalar no Windows
1. Abra a URL de produção do NACALL no **Microsoft Edge** ou **Google Chrome**.
2. Edge: menu `...` → **Aplicativos** → **Instalar este site como um aplicativo**.
3. Chrome: menu `...` → **Transmitir, salvar e compartilhar** → **Instalar página como app** (ou o ícone de instalação da barra de endereços, quando disponível).
4. Fixe o NACALL na barra de tarefas ou no menu Iniciar. O aplicativo abre numa janela independente.

## Segurança e limitações
- **Não é um instalador .exe/.msi**: é a primeira versão desktop instalável, executada pelo navegador.
- Requer conexão com a internet para login, DMs, voz, câmera e compartilhamento de tela.
- Permissões de microfone, câmera e tela são solicitadas pelo navegador/sistema operacional; o navegador pode restringir o compartilhamento de áudio.
- O manifesto reaproveita o ícone já existente do NACALL. Não incluímos service worker offline para evitar cache de sessões/mensagens em um app de comunicação em tempo real.
- Uma futura versão com instalador nativo pode usar Tauri/Electron, depois de validação de segurança, assinatura de código e pipeline Windows.

## Próximas verificações
- Testar login, DMs, voz, câmera (inclusive vertical), tela cheia e parar/retomar transmissão no Edge Windows 11.
- Verificar notificações e permissões por plataforma antes de prometer comportamento em background.

# NACALL Desktop v0.1.0 — Windows e macOS

Aplicativo para Windows e macOS, desenvolvido com **Electron 45**, mantendo o NACALL web como interface e backend. **É online**: usa `https://nacall.vercel.app` com a mesma conta e comunidades.

## O que esta versão entrega
- Janela independente, ícone oficial Jacall na barra de tarefas e instalador, inicialização de instância única, atualizar com Ctrl+R e tela cheia com F11.
- Isolamento de contexto, sandbox, integração Node desabilitada, navegação restrita ao domínio oficial, links externos HTTPS no navegador padrão.
- Permissões de câmera/microfone e **seleção explícita** de tela ou janela ao transmitir no Windows (sem compartilhar a tela automaticamente).
- Reaproveita login, chats, servidores e chamadas já presentes na versão web, sem duplicar a lógica LiveKit/Supabase.

## Gerar o .exe
O workflow `Desktop · Build Windows` compila em `windows-latest` e disponibiliza dois artefatos: `NACALL-Setup-0.1.0-x64.exe` e `NACALL-Portable-0.1.0-x64.exe`.

No GitHub: **Actions → Desktop · Build Windows → executar workflow (branch selecionada)**. Depois baixe o artefato da execução. Também é acionado automaticamente por alterações em `desktop/**` no PR.

Localmente no Windows com Node 22 ou mais recente:

```powershell
cd desktop
npm install
npm run check
python -m pip install Pillow==11.3.0
python scripts/make_icon.py
npm run dist:win
```

Arquivos saem em `desktop/dist`.

## Leve para jogar
O app foi ajustado para gastar o mínimo de RAM, CPU e GPU enquanto a pessoa joga (`performance.cjs`):
- Sem o processo "reserva" do Chromium, sem buscas em segundo plano, sem corretor ortográfico e sem capturar as teclas de mídia.
- Com a janela escondida ou minimizada, a página é estrangulada (timers e desenho quase param); a call continua normal.
- O site não redesenha mais a tela inteira a cada segundo por causa do cronômetro da call, e a detecção de fala lê o microfone 20 vezes por segundo em vez de a cada quadro (antes eram 144 ou 240 vezes por segundo num monitor gamer).
- **Modo leve para jogos** (menu NACALL, ou Janela no Mac): deixa a placa de vídeo só para o jogo e tira animações e desfoques. Pede para reiniciar. Se a call ou o vídeo travar num PC fraco de CPU, desligue.
- Se a página cair (falta de memória, driver de vídeo), ela recarrega sozinha.

## macOS (para testar)
O workflow `Desktop · Build macOS` gera dois `.dmg`: `NACALL-0.1.0-arm64.dmg` (Apple Silicon: M1, M2, M3, M4) e `NACALL-0.1.0-x64.dmg` (Mac com Intel). No Mac, veja em menu Apple > Sobre este Mac qual é o seu.

1. GitHub: **Actions → Desktop · Build macOS → Run workflow** (ou abra a execução do PR) e baixe o artefato `NACALL-macOS-v0.1.0`.
2. Abra o `.dmg` e arraste o NACALL para Aplicativos.
3. Primeira vez: o app não tem certificado da Apple, então o macOS bloqueia. Clique com o botão direito no NACALL → **Abrir** → Abrir. No macOS 15 (Sequoia) ou mais novo: tente abrir, depois vá em Ajustes do Sistema → Privacidade e Segurança → **Abrir Mesmo Assim**.
4. Ao entrar numa call o macOS pede o microfone (e a câmera, se ligar o vídeo). Para transmitir a tela, libere o NACALL em Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela e reabra o app.

O build também abre o app por 25 s no runner do GitHub e mostra no log quanta RAM ele usou.

## Limites e próximos passos
- **Build sem assinatura digital:** Windows SmartScreen pode exibir aviso de editor desconhecido. Não desative o antivírus nem ignore avisos de procedência de arquivos de terceiros; baixe apenas dos Actions oficiais. Distribuição pública exige certificado e assinatura.
- **Áudio do sistema na transmissão:** ainda não implementado nesta versão, apenas vídeo da tela/janela. Testar seleção de janela e compartilhamento de câmera com usuários reais antes de lançar publicamente.
- O aplicativo precisa de conexão e da implantação correta de `nacall.vercel.app`. Alterações de interface não dependem de atualizar o instalador.
- Sem autoatualização, bandeja ou notificações em segundo plano nesta primeira versão.
- Build inicial usa dependências diretas fixadas, mas ainda precisa do lockfile reproduzível antes da distribuição ampla.
- Uma versão futura pode incluir ícone oficial `.ico`, assinatura digital, atualização automática, atalhos do microfone e tray.

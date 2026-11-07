# NACALL Desktop v0.1.0 — Windows

Primeiro aplicativo nativo para Windows, desenvolvido com **Electron 45**, mantendo o NACALL web como interface e backend. **É online**: usa `https://nacall.vercel.app` com a mesma conta e comunidades.

## O que esta versão entrega
- Janela independente, ícone na barra de tarefas (genérico na v0.1), inicialização de instância única, atualizar com Ctrl+R e tela cheia com F11.
- Isolamento de contexto, sandbox, integração Node desabilitada, navegação restrita ao domínio oficial, links externos HTTPS no navegador padrão.
- Permissões de câmera/microfone e **seleção explícita** de tela ou janela ao transmitir no Windows (sem compartilhar a tela automaticamente).
- Reaproveita login, chats, servidores e chamadas já presentes na versão web, sem duplicar a lógica LiveKit/Supabase.

## Gerar o .exe
O workflow `Build NACALL Windows` compila em `windows-latest` e disponibiliza dois artefatos: `NACALL-Setup-0.1.0-x64.exe` e `NACALL-Portable-0.1.0-x64.exe`.

No GitHub: **Actions → Build NACALL Windows → executar workflow (branch selecionada)**. Depois baixe o artefato da execução. Também é acionado automaticamente por alterações em `desktop/**` no PR.

Localmente no Windows com Node 22 ou mais recente:

```powershell
cd desktop
npm install
npm run check
npm run dist:win
```

Arquivos saem em `desktop/dist`.

## Limites e próximos passos
- **Build sem assinatura digital:** Windows SmartScreen pode exibir aviso de editor desconhecido. Não desative o antivírus nem ignore avisos de procedência de arquivos de terceiros; baixe apenas dos Actions oficiais. Distribuição pública exige certificado e assinatura.
- **Áudio do sistema na transmissão:** ainda não implementado nesta versão, apenas vídeo da tela/janela. Testar seleção de janela e compartilhamento de câmera com usuários reais antes de lançar publicamente.
- O aplicativo precisa de conexão e da implantação correta de `nacall.vercel.app`. Alterações de interface não dependem de atualizar o instalador.
- Sem autoatualização, bandeja ou notificações em segundo plano nesta primeira versão.
- Build inicial usa dependências diretas fixadas, mas ainda precisa do lockfile reproduzível antes da distribuição ampla.
- Uma versão futura pode incluir ícone oficial `.ico`, assinatura digital, atualização automática, atalhos do microfone e tray.

# Identidade JACALL e nova entrada

Implementação na branch `feat/jacall-landing-mobile`, a partir de `release`.

## Comportamento

- Visitante sem sessão vê a landing em `/`; quem já está conectado continua entrando no workspace.
- Login, cadastro e recuperação ficam em `/login`. Links de convite existentes continuam abrindo o convite e a autenticação.
- Identidade menta `#8FE3B0`, azul-água `#7FD6E8`, lavanda `#B8A9F0`, grafite `#14181F`, superfície `#1D232D` e texto `#E8ECF2`. Fonte Nunito variável, hospedada pelo próprio aplicativo.
- Artes originais da conversa **Folha de personagem Jacall**, sem redesenhar o mascote. Prancha e avatar codificados em WebP; favicon otimizado. A composição do personagem principal usa recorte CSS da prancha, preservada integralmente no arquivo.
- Windows e Android aparecem como **Em breve**, com botões desativados e sem arquivos de instalação fictícios.
- Rodapé com contribuição (Chave em breve) e crédito ao grupo RCM, em texto discreto.
- `GET /api/community` consulta apenas o cabeçalho e o total de perfis, pelo servidor. Resposta pública: `{count: number}`. Nenhum perfil, e-mail ou chave é devolvido. Sem cache; atualização a cada 15 segundos, ao voltar à aba e ao concluir cadastro. Não representa usuários online. Falhas mostram estado de indisponibilidade, sem inventar zero.
- Nenhuma migration ou ampliação de acesso às tabelas públicas é necessária.
- Controles da call em coluna compacta à esquerda no desktop e na call em foco no celular. No modo conversa + call do celular, os controles ficam numa faixa compacta, com saída sempre acessível e rolagem interna se necessário.
- Navegação mobile por painel de canais sobreposto, sem ocupar metade da altura da conversa. A call continua montada durante a navegação.
- Configurações e cartões de perfil usam portal no `document.body`. Isso evita um modal invisível bloquear a interface quando `.main` é ocultada pela call em foco. Abertura e fechamento são seguros durante o ciclo de efeitos do modo estrito.
- Recursos de voz e configurações carregam sob demanda. Opções LiveKit são estáveis entre renderizações; consultas de salas não rodam sem salas e respostas iguais não provocam nova atualização do roster.

## Validação local

- Checagem de tipos e build devem passar antes do PR.
- `pnpm test`: 17 testes, incluindo subtestes do agregado público. A execução foi limitada a um arquivo de cada vez porque múltiplos bancos PGlite simultâneos esgotaram a memória do Windows nesta máquina.
- Navegador: landing desktop e 390px; navegação para login; troca para cadastro e campo e-mail; imagens; ausência de rolagem horizontal; downloads desativados; rodapé.
- Fixture local temporário (não incluído no aplicativo): renderização dos controles reais de call com LiveKit desconectado, call em foco e compacta; configurações reais dentro de um pai oculto, mostrando o portal no body; fechamento e novo clique respondendo. Sem contas, salas ou mídia reais.
- Ainda depende de validação no Preview/HML: total com banco real e cadastro novo, microfone, câmera, tela, música e conversa entre dois dispositivos. Não confundir a fixture desconectada com esse teste.

## Entrega

Abrir PR para `release`, acompanhar CI e Preview. O merge para homologação segue a confirmação exigida pelo fluxo do repositório. Nenhum merge para `main`, alteração de infraestrutura ON3VER ou publicação em produção faz parte desta entrega.

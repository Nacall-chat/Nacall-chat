# Chat: áudio, emojis e figurinhas

Tudo usa o chat que já existia (`messages`, canais e DMs, Realtime). Não há segundo sistema de mensagens.

## Barra de envio
`src/components/composer.tsx`: emojis/figurinhas · texto · microfone · enviar. O botão de enviar é compacto (só a seta, mesmas cores e hover). Gravar áudio troca a barra pela interface de gravação.

## Mensagens de áudio
- Gravação: `MediaRecorder` com o melhor formato que o navegador aceita (WebM/Opus, Ogg/Opus ou MP4/AAC, nessa ordem; sem suporte declarado, usa o padrão do navegador), 48 kbps, no máximo 5 minutos. A permissão do microfone é pedida ao tocar no microfone. Nunca envia sozinho: o envio só acontece ao tocar na seta; a lixeira cancela. Se o envio falhar, o áudio fica guardado na barra para tentar de novo.
- Armazenamento: bucket **privado** `chat-audio`, caminho `<seu id>/<canal ou DM>/<uuid>.<webm|ogg|m4a>`. Os metadados ficam em `messages` (`kind='audio'`, `media_path`, `media_duration_ms`); o áudio nunca vai em `body`.
- Quem ouve: o app pede links assinados de 1 hora (`createSignedUrls`, em lote, renovados sozinhos). A política de leitura do Storage só libera o arquivo para quem pode ler a mensagem que o referencia (membro do canal ou participante da DM). Por isso o destinatário ouve depois de atualizar a página ou reabrir a conversa: o que persiste é o arquivo e a linha da mensagem, não o link.
- Excluir a mensagem apaga também o arquivo (a pessoa é a dona da pasta).

## Emojis
`src/components/chat-picker.tsx`. Painel flutuante com abas **Emojis** e **Figurinhas** (não fecha ao escolher). Biblioteca em português, ~1.900 emojis de Unicode até 15.1, em 9 categorias, com busca sem acento e recentes (por aparelho). Entram no cursor, quantos forem. A biblioteca é gerada por `node scripts/gerar-emojis.mjs` a partir do pacote `emojibase-data` (devDependency) em `src/lib/emoji-data.json` e só é baixada quando o painel abre. Mensagem só de emojis (até 8) aparece grande.

## Figurinhas
- Coleção pessoal: tabela `stickers` (RLS: só o dono), arquivos no bucket privado `stickers`, até **200** por pessoa. O nome do arquivo (`<seu id>/<id da figurinha>.<ext>`) é gerado pelo banco; o upload só é aceito para a linha que o banco acabou de criar.
- Importar: WEBP, PNG, JPEG e GIF (animações preservadas), até 1 MB e 1024×1024, conferidos pelos bytes. Funciona com figurinhas do WhatsApp salvas no aparelho (sem integração com a API do WhatsApp).
- Criar: escolher imagem, enquadrar (arrastar e zoom), preencher/inteira, girar, quadrado/arredondado/círculo, remover **fundo liso** (a partir da cor dos cantos, com tolerância) e pré-visualizar. Salva WEBP 512×512 transparente (PNG se o navegador não codifica WEBP). GIF animado vira imagem parada no criador; para manter o movimento, use Importar.
- Organizar: favoritar (aparecem primeiro), mover para antes/depois e excluir (com confirmação). Reordenar usa `reorder_stickers(ids)`.
- Enviar: `messages` com `kind='sticker'` e `media_path`. O arquivo só sai do Storage se nenhuma mensagem o usa, então o destinatário não perde figurinhas já recebidas quando o remetente exclui da coleção.

## Segurança e limites
| Item | Cliente | Servidor (banco/Storage) |
| --- | --- | --- |
| Áudio | formato pelo conteúdo (WebM/Ogg/MP4), até 5 MB, 0,7 s a 5 min | bucket: 5 MB e `audio/webm,ogg,mp4`; política de upload: caminho `<seu id>/<conversa onde você escreve>/<uuid>.<ext>`; `messages_content_check`: duração 0,5 s a 305 s e caminho do próprio autor na própria conversa |
| Figurinha | formato pelos bytes, até 1 MB e 1024 px | bucket: 1 MB e imagens WEBP/PNG/JPEG/GIF (SVG não entra); upload só para linha existente do dono |
| Taxa | — | 20 uploads de áudio e 20 mensagens de mídia por minuto por pessoa; 200 figurinhas |
| Leitura | link assinado de 1 h | só quem lê a mensagem (ou o dono da pasta) |

Limite conhecido: o Storage valida o `Content-Type` informado, não o conteúdo do arquivo; a conferência por bytes é feita no cliente. Não há varredura de malware nem cota total de espaço por pessoa.

## Migration
`supabase/migrations/202611190001_audio_e_figurinhas.sql` (aditiva): colunas `kind`, `media_path`, `media_duration_ms` e `body` com padrão `''` em `messages`; troca `messages_body_check` por `messages_content_check`; tabela `stickers`; buckets `chat-audio` e `stickers`; funções `chat_media_readable`, `chat_media_in_use`, `chat_audio_upload_ok`, `reorder_stickers`; gatilhos de limite. O app antigo continua enviando só texto sem alteração. Aplique em HML e, depois de aprovada, em PRD **antes** do deploy do código.

## Novidades
`src/components/whats-new.tsx` mostra uma vez por conta (chave em `localStorage`, `UPDATE_ID` em `src/lib/novidades.ts`) um carrossel com o que mudou. Para anunciar uma nova atualização, troque `UPDATE_ID` e os slides.

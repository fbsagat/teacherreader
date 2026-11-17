# TODO — Plano de revisão do Teacher Reader

Plano de execução em fases para os achados da revisão geral. **Nada aqui deve ser
implementado de uma vez:** cada fase é um PR independente, com lint + testes +
build verdes no fim (o Dockerfile repete esse gate no deploy da VPS).

Referências de linha foram levantadas no commit `b9e4275` (2026-11-15) e podem
deslocar alguns linhas ao longo da execução — use o texto como âncora.

---

## Estado verificado antes do plano

| Verificação | Resultado |
|---|---|
| `npm run lint` (`tsc --noEmit`) | limpo |
| `npx tsx --test "src/utils/*.test.ts"` | 98 testes, 98 passam |
| `npm run build` | ok, 1 chunk JS de 860 kB (~257 kB gzip) |
| `npm run clean` | **quebrado no Windows** (`rm -rf`) |
| CI | existe (`.github/workflows/ci.yml`), mas AGENTS.md diz que não |

Bugs reproduzidos em runtime (não são suspeita):

```
isWordMatch('right','nine') = true        isWordMatch('do','so')       = true
isWordMatch('know','show')  = true        isWordMatch('thought','taught') = true
evaluateWordPronunciation('he','the')     → passed, score 92
evaluateWordPronunciation('in','point')   → passed, score 92
calculateSimilarity('', 'banana')         → 100
cleanString('café') = 'caf'               cleanString('não') = 'no'
cleanSpeech('I can’t wait') = 'i can t wait'
segmentBookText(<frase de 500 chars>)     → 0 sentenças
segmentBookText('Yes!')                   → 0 sentenças
```

---

## Decisões já tomadas (não reabrir)

1. **Título e metadados em inglês são intencionais.** `index.html` mantém
   `Teacher Reader — Learn While You Read` e os `og:*` em inglês, mesmo com a UI
   em pt-BR. Em vez de “corrigir”, o AGENTS.md passa a registrar a exceção
   (`copy de interface = pt-BR; título/OG = EN por decisão de produto`).
2. **Libs do cliente continuam em `devDependencies`** (React, Firebase, qrcode,
   lucide, motion). Não mover para `dependencies`: a imagem da API usa
   `npm ci --omit=dev` e isso a manteria enxuta. Documentar o porquê.
3. **Fonte da verdade de deploy é o `DEPLOY.md`.** O README não repete detalhes
   de produção.

---

## Regras de execução

- Toda string nova de UI/erro em **pt-BR**.
- Regra de negócio nova vai para `src/utils/*.ts` (puro, sem DOM) **com** teste
  em `src/utils/*.test.ts` (`node:test` + `node:assert/strict`).
- Não introduzir dependência nova sem necessidade real.
- Não editar `dist/`, `.vercel/`, `.aistudio/`.
- Não tocar em `/opt/MemeTrigger`, nginx, portas 80/443 nem nos containers dele.
- Ao terminar cada fase: `npm run lint` + `npx tsx --test "src/utils/*.test.ts"` +
  `npm run build`.
- Mensagens de commit no padrão já usado no repo (pt-BR, prefixo de área):
  `Pronúncia: ...`, `Import: ...`, `docs: ...`, `Deploy: ...`.

---

# Fase 1 — Corrigir o que altera o resultado do usuário (P0)

Objetivo: o app não deve mais dar nota falsa, perder texto no import, contar
dia errado nem continuar gravando áudio.

### [x] 1.1 Nota de pronúncia aprova palavras erradas (crítico)
- Onde: `src/utils/shadowing.ts:310-397` (grupos de homófonos, `isWordMatch`,
  `calculateSimilarity`), `src/utils/challengeFlow.ts:73-84`.
- Evidência: `isWordMatch('right','nine')`, `('do','so')`, `('thought','taught')`
  retornam `true`; `evaluateWordPronunciation` passa qualquer alvo curto por
  causa de `cleanSpoken.includes(cleanTarget)` e ainda força `score = max(score, 92)`.
- Impacto: alimenta `SentenceProgress.bestScore`, SRS (`lastQuality`),
  `masteredWords`, streak e o gráfico de evolução.
- Correção:
  - remover o piso artificial de 92 (devolver a similaridade real e deixar o
    threshold decidir);
  - trocar `includes` por igualdade de token inteiro (ou remover esse atalho);
  - podar/validar a tabela de homófonos: cada palavra deve pertencer a **um**
    grupo, sem pares mínimos (`right/nine`, `do/so/go/no/know/show/low`,
    `thought/taught`, `through/night/old` sobrepostos);
  - guardar alvo vazio em `calculateSimilarity` (hoje `''` vs `banana` = 100);
  - `Number.isFinite` nos caminhos numéricos que geram `NaN` (ver 2.10).
- Aceite: testes de regressão para `right/nine`, `do/so`, `in/point`, `art/part`,
  `''`/alvo vazio; nenhuma nota ≥ 92 sem correspondência real.

### [x] 1.2 Import descarta sentenças longas e muito curtas (alto)
- Onde: `src/utils/shadowing.ts:698-736` (gate `restored.length > 10 && < 420`).
- Evidência: frase de 500 chars → `[]`; `'Yes!'` → `[]`. Afeta todos os imports
  (`fileParsers.ts:451-502`, `LibraryModal.tsx:117`).
- Correção: dividir frases acima do limite com `segmentEnglishTokensIntoClauses`
  em vez de descartar; manter frases curtas (só descartar vazio/ruído);
  adicionar cauda sem pontuação final (`'A. B sem ponto'`).
- Aceite: testes com 400/500/800 chars, frase curta de 1 palavra e texto sem
  pontuação final; soma das palavras do resultado == entrada (sem perda).

### [x] 1.3 Hands-free concede 100% sem fala (alto)
- Onde: `src/App.tsx:1714-1718` (`resolve(targetSentence)` em erro de mic com
  `autoHandsFree`), `src/components/OverlaysAndModals.tsx:175-181` (auto-envio
  da própria frase-alvo após 1,1 s).
- Impacto: conclui frases, incrementa `totalSentencesCompleted`, `bestStreak`,
  `masteredWords` e a meta diária sem o aluno falar.
- Correção: resolver `''` (ou `{ text: '', assisted: true }`) e tratar como
  pausa/retry; marcar submissões assistidas para **não** gravar progresso.
- Aceite: teste de fluxo garantindo que submissão assistida não altera stats.

### [x] 1.4 “Dia” é UTC → meta, streak e gráfico errados no Brasil (alto)
- Onde: `src/services/storageService.ts:403`,
  `src/components/StatsModal.tsx:103,124,171`,
  `src/components/VocabModal.tsx:57` (nome do arquivo exportado).
- Evidência: `toISOString().slice(0,10)`; em UTC-3 o dia vira às 21h. Em
  `StatsModal` o **rótulo** é local e a **chave** é UTC, então a barra “sáb”
  mostra dados de domingo.
- Correção: `localDayKey(date = new Date())` puro em `src/utils/` (ano/mês/dia
  locais, zero-padded), usado nos 4 pontos.
- Aceite: teste com `TZ=America/Sao_Paulo` e data fixa às 22h.

### [x] 1.5 Microfone pode continuar gravando após o fim da captura (alto/privacidade)
- Onde: `src/App.tsx:1174-1229`.
- Causa: `await getUserMedia()` resolve depois de `stopVoiceRecordingAndAnalyser()`
  e o stream é atribuído mesmo assim (`recorder.start()` sem dono). Também
  sobrescreve `micStreamRef` sem parar o stream anterior.
- Correção: `captureGenerationRef`; após `getUserMedia`, se a geração mudou,
  `stream.getTracks().forEach(t => t.stop())` e retornar; parar stream/recorder
  existentes no início.
- Aceite: teste manual (negar permissão durante a captura, navegar de frase
  durante a captura) sem indicador de gravação aceso.

### [x] 1.6 Ciclo de vida de áudio: AudioContext vazando e re-render de 90 ms (alto)
- Onde: `src/App.tsx:1188-1203` (`new AudioCtx()` por captura, nunca `close()`),
  `:1198-1202` (`setMicVolumeLevel` a cada 90 ms re-renderiza o App inteiro).
- Correção: `audioCtxRef`/`analyserRef` reutilizados e `await ctx.close()` no
  stop; publicar o nível por ref/CSS var em componente folha (ex.: `MicLevelBar`).
- Aceite: durante captura, o App não re-renderiza a 11 Hz; abrir/fechar 10
  capturas seguidas não estoura o limite de AudioContext do Chrome.

### [x] 1.7 Promise do desafio pode ficar pendurada ou resolver duas vezes (alto)
- Onde: `src/App.tsx:1967-1986` (resolver sem flag `settled`),
  `:2760` (`jumpToSentence`) e `:4086` (chip de etapa) anulam
  `postSentenceChallengeRequest` sem resolver, `:3876-3878` (Escape) e `:6566`
  (`onFinish`) podem resolver de novo.
- Impacto: `await runPostSentenceChallenges(...)` nunca resolve (frame suspenso
  com a closure da frase); resolução dupla chama `stopAllAudioPlayback()` global
  e pode abortar o mic/TTS da frase seguinte.
- Correção: `pendingChallengeResolveRef` + `settled`; sempre `resolve('cancel')`
  antes de anular/trocar; limpar no `stopLoop`.
- Aceite: teste em `studyFlowLifecycle` cobrindo resolve único e navegação
  durante o desafio.

### [x] 1.8 Restauração de sessão frágil (alto)
- Onde: `src/App.tsx:936-1005`.
- Causa A: o efeito de bookmark (`:998-1005`) grava **síncronamente**
  `sr_active_book_id` com o livro demo (`SAMPLE_BOOKS[0]`) antes de
  `getActive()` resolver — corrida com a restauração e ponteiro envenenado.
- Causa B: `sr_masterpiece_beacon_v1` (`:940-957`) força o livro demo no
  primeiro load de quem já tinha livro ativo, ignorando `getActive()`.
- Correção: `isSessionRestoredRef` bloqueando escrita de bookmark até a
  restauração terminar; só cair no demo quando `getActive()` voltar vazio.
- Aceite: reload com livro próprio abre o livro próprio e a frase salva.

### [x] 1.9 Fechamento da fase 1
- [x] rodar lint + testes + build
- [x] atualizar `todo.md` marcando o que foi feito
- [x] commit: `Pronúncia/Import/Sessão: correções de pontuação, segmentação e restauração`

---

# Fase 2 — Confiabilidade de dados, servidor e acessibilidade (P1)

### [x] 2.1 Normalizar settings na fronteira (alto)
- Onde: `src/services/storageService.ts:244-336` (só `fontSizeScale` é
  normalizado), `src/utils/driveSync.ts:140` (`settings as PedagogicalSettings`).
- Sintomas: `threshold: NaN` (nada aprova para sempre), `threshold: 0`,
  `ttsSpeedEn: 5`, `blindMaxErrorsBeforeReveal: -1`, `cardSequence: []` chegam
  à UI e ao motor; `<input type="range">` renderiza fora de faixa.
- Correção: `normalizeSettings(partial)` puro: clamp/arredondamento de todos os
  numéricos, validação de enums (`ttsEngine`, `sttProvider`, `themeMode`,
  `audioFlow`, `studyViewMode`), `cardSequence`/`visualCardOrder` filtrados
  contra os tipos válidos, chaves desconhecidas descartadas.
- Usar em `loadSavedSettings` **e** `parseDriveBackupSnapshot`.
- Aceite: testes com payloads hostis (NaN, negativos, strings, array vazio).

### [x] 2.2 Reconcile do Drive re-dispara a cada frase (alto)
- Onde: `src/App.tsx:832-852` + `583-684` + `505-514`.
- Causa: efeito de auth depende de `reconcileWithGoogleDrive`, que depende de
  `exportCurrentDriveSnapshot`, que depende de `currentIndex` e `settings`. Cada
  frase re-subscreve `onAuthStateChanged` → `findAppDataBackupFile` +
  `downloadAppDataBackup` + possível reabertura do modal com confirmação.
- Correção: `reconcileRef` (ref estável) + efeito de auth com `[]`; chamar via
  `reconcileRef.current(...)`.
- Aceite: com Drive conectado, avançar 10 frases não dispara novas chamadas de
  list/download; modal não reabre sozinho.

### [x] 2.3 Tirar efeitos colaterais dos updaters de `setState` (alto)
- Onde (6 pontos): `App.tsx:1896-1924` (`setSentenceProgress` → `updateBookmark`
  com transação IDB; `setStudyStats` → `recordEvaluation` grava localStorage),
  `:1104-1133` (`handleUpdateSettings` persiste e mexe em `settingsRef` dentro
  do updater), `:3674-3695`, `:3702-3708`, `:3730-3734`, `:3739-3743`.
- Impacto: trabalho de storage no render (jank no mobile), escrita duplicada se
  React repetir o update (bloqueia adoção de `StrictMode`), bookmark podendo
  regredir `currentIndex`.
- Correção: refs espelho (`sentenceProgressRef`, `settingsRef`) para calcular o
  próximo valor, `setX(next)` puro e persistência depois (efeito ou chamada
  imediata).
- Aceite: nenhum `localStorage`/IndexedDB dentro de updater; grep de revisão.

### [x] 2.4 Erros de persistência e import engolidos (alto)
- Onde: `App.tsx:3813-3845` (`handleUploadBook`), `:3778-3811` (`handleSelectBook`),
  `:3849-3856` (`handleDeleteSavedBook`).
- Sintomas: muta o prop (`newBook.sentences[0].pt = …`); `await
  fetchSentenceTranslation` sem `try` (sem rede = import morre calado); ignora
  `books.save()` falso (IndexedDB cheio) e mostra “Livro salvo na memória!”;
  deletar o livro ativo não limpa bookmark nem reposiciona a sessão.
- Correção: copy-on-write, try/catch com fallback (`pt` vazio → tradução sob
  demanda), checar retorno e avisar em pt-BR, tratar exclusão do livro ativo.
- Aceite: importar com rede bloqueada carrega o livro; simular quota cheia
  mostra erro em pt-BR (e não o toast de sucesso).

### [x] 2.5 Resetar estado local dos modais ao abrir (alto)
- Onde: `GoogleDriveSyncModal.tsx:113-114` (`confirmOverwriteWarning` e
  `confirmDeleteBackup` continuam armados entre aberturas → 1 toque sobrescreve
  o backup), `LibraryModal.tsx:59-66` (aba/texto/erro velhos), `:585-589` (input
  de arquivo não reseta → mesmo arquivo duas vezes não faz nada),
  `VocabModal.tsx:26-29` (deck/filtro/cardIndex), `SentenceNavigatorModal.tsx:26-29`
  (busca/filtros → parece que as frases sumiram).
- Correção: `useEffect` de reset em `isOpen` em cada modal; `e.target.value = ''`
  após upload; `crypto.randomUUID()` no id do livro importado
  (`LibraryModal.tsx:91`, hoje `Date.now()` colide).
- Aceite: abrir/fechar cada modal duas vezes sempre no estado inicial; nenhuma
  confirmação destrutiva pré-armada.

### [ ] 2.6 Acessibilidade — bloco de correções (alto)
- [x] **2.6a** Remover `select-none` do `<body>` (`index.html:17`) e aplicar só
  em chrome/overlays (já feito em `OverlaysAndModals.tsx:23`). Hoje só a linha EN
  dos cards é copiável (`App.tsx:5755`); texto em modo parágrafo
  (`:4978-5003`, `:5055-5060`), dicionário, vocab, navegador e biblioteca não.
- [ ] **2.6b** Criar `<Modal>` compartilhado: `role="dialog"`, `aria-modal`,
  `aria-labelledby`, foco inicial, trap de Tab, restauração de foco ao fechar,
  slot `aria-live`. Migrar os 11 componentes (hoje: 0 `autoFocus`, 0
  `aria-controls`, 0 `role="tabpanel"`).
- [x] **2.6c** `role="status" aria-live="polite"` no `#stateBadge`/`#scoreBadge`
  (`App.tsx:4407-4414`, `:6057-6066`) e `assertive` para erro; contador do blind
  (`:5612-5616`, `:5694-5700`) também.
- [x] **2.6d** Escape fecha só o modal do topo (hoje `App.tsx:3861-3880` fecha
  todos, inclusive empilhados como Dicionário sobre Estatísticas).
- [x] **2.6e** Aumentar alvos de toque: `HeaderBar.tsx:132-254`
  (`min-w-[34px]` → 44 px no mobile), `VocabModal.tsx:280,317`,
  `LibraryModal.tsx:530`.
- [x] **2.6f** Contraste: `text-slate-500` em 9–10 px dá ~3,97:1 no tema escuro
  (`StatsModal.tsx:388,413,438,641`, `VocabModal.tsx:310,317`,
  `SettingsModal.tsx:2203`, `GoogleDriveSyncModal.tsx:456`,
  `SentenceNavigatorModal.tsx:219`) → usar `text-slate-400` abaixo de `text-sm`
  e escurecer `--color-slate-500` nos temas claro/sépia.
- [x] **2.6g** Rótulos acessíveis em botões só-ícone (`SettingsModal.tsx:709-748`,
  setas/🔁/✕) e foco visível no preset radio
  (`SettingsModal.tsx:599-613`, hoje `opacity-0` sem ring).
- Aceite: navegação completa por teclado; leitor de tela anuncia resultado e
  erros; texto selecionável.

### [x] 2.7 Markup e estado do Settings (médio)
- [x] **2.7a** Remover a duplicação de `blindMaxErrorsBeforeReveal` e
  `blindSpeakingOnFullSentence` (`SettingsModal.tsx:823-915` e `:1580-1689`),
  extraindo um `<BlindSpeakingControls>` renderizado uma vez.
  → Resolvido sem subcomponente: o bloco da aba **Texto & Tema** foi removido e
  no lugar ficou um atalho para **Etapas**, que é a fonte única da regra (a aba
  de etapas fica ao lado do card `speak_blind_en`, como o `plano-notas.md` item 9
  decidiu).
- [x] **2.7b** “Restaurar Padrões” (`SettingsModal.tsx:2158-2197`) omite
  `themeMode`, `studyViewMode`, `showConnectedSpeech`, `dailyGoalSentences`,
  `practiceDaysGoal` → usar `DEFAULT_SETTINGS` completo (ou separar “Áudio/Fala”
  de “Tudo”).
- [x] **2.7c** “Salvar e Fechar” (`:2208`) não salva nada (persistência é
  imediata) e não há Cancelar → renomear para “Fechar” ou implementar cancelar
  de verdade.
- [x] **2.7d** Toast de voz mostra `voiceURI` (`:1317-1324`, `:1347-1354`) →
  mostrar `name (lang)`.

### [x] 2.8 Servidor: deadline, limites e semântica de erro (alto)
Arquivo: `server.ts` (referências do commit atual).
- [x] **2.8a** `express.json({ limit: '15mb' })` (`:511`) roda antes dos rate
  limits (`:530-531`, `:544`, `:610`) → montar limiter antes do body parser e
  reduzir limite de TTS/STT para poucas centenas de KB.
- [x] **2.8b** Nenhum timeout/abort nas chamadas Gemini (`:650-669`, `:679-744`):
  cliente desiste em 7,5–14,5 s e o servidor segue queimando cota. Criar
  `AbortController` por request ligado a `req.on('close')`, passar
  `config.abortSignal` e usar orçamento abaixo do timeout do cliente; teto para
  a fila do semáforo (503 quando cheia).
- [x] **2.8c** Rate limiter: map sem teto (`:461-465`) → LRU/FIFO com cap +
  varredura periódica com `.unref()`; chave IPv6 normalizada para /64;
  documentar/validar `trust proxy 1` (`:510`).
- [x] **2.8d** Semântica de erro: 429 do Gemini vira 500 no STT (`:756-759`);
  devolver 429/503 com `Retry-After` derivado dos cooldowns; 500 só para bug
  real. TTS `:600-602` idem.
- [x] **2.8e** Truncamento silencioso: `text.trim().slice(0, 1500)` (`:559`)
  usando literal, enquanto `MAX_TTS_TEXT_CHARS` (`:18`) não é usado → rejeitar
  com 400 em pt-BR ou devolver `truncated: true`.
- [x] **2.8f** Recomeço da cadeia: falha de 1 chunk no modelo principal refaz
  todos os chunks no lite (`:265-293`) → memoizar por índice de chunk.
- [x] **2.8g** Circuit breaker só abre com 429 (`:296-298`) → adicionar breaker
  por falhas consecutivas (ex.: 3 em 60 s → pausa 90 s).
- [x] **2.8h** `provider: 'online'` pode servir voz TikTok e repetir GTX que
  acabou de falhar (`:563-594`) → para `online`: GTX → neural, sem repetir.
- [x] **2.8i** `concatenateWavBase64` pode devolver áudio parcial marcado como
  `gemini_tts` (`src/utils/ttsPlayback.ts:342-345`) → retornar `null`/erro e
  deixar a cadeia de fallback decidir (regra “nunca servir áudio parcial”).
- [x] **2.8j** STT: validar base64 (decodificar, remover prefixo `data:`),
  sniff de magic bytes, alinhar a mensagem de 413 (diz 6 MB, guarda 8 MB de
  base64, `:625-630`), aceitar `audio/x-m4a`, `audio/aac`, `audio/3gpp`,
  `video/webm`.
- [x] **2.8k** `targetSentence` interpolado cru no prompt (`:663`, `:692`) →
  passar como parte separada/JSON com delimitador fixo.
- [x] **2.8l** Coach: `JSON.parse` sem try (`:746`), defaults 85 sem clamp
  (`:749-751`) → try/catch com 503 e clamp 0–100; `transcript` vazio = falha.
- [x] **2.8m** Looks de protótipo em string do usuário: `STYLE_RATE_MULTIPLIER[voiceStyle]`
  (`:560`), `NEURAL_CLOUD_PERSONA_*[voiceName]` (`:259`, `:344-345`) →
  `Object.hasOwn`/Map + allowlist explícita.
- [x] **2.8n** Error middleware não é o último (`:767-786` antes de `:819-826`) →
  mover para o fim; `startServer()` sem `.catch` (`:836`); `Vary` via `res.vary`
  (`:518`); logs sem corpo e sem chave.
- [x] **2.8o** Limpeza: `MAX_TTS_TEXT_CHARS` morto, `provider` aceito e ignorado
  no STT (`:616`), `speed` enviado pelo cliente e nunca lido, `styleMultiplier`
  devolvido e nunca consumido, `googleStream: true` hardcoded (`:538`).
- Aceite: `/api/voice-hub/status` continua igual; testes existentes verdes;
  adicionar teste de `concatenateWavBase64` com clip sem RIFF.

### [x] 2.9 Parser de arquivos e cobertura (médio)
- [x] **2.9a** Criar `src/utils/fileParsers.test.ts` (módulo é puro e testável em
  Node): JSON malformado, CRLF, CSV com campos entre aspas e vírgulas, RTF com
  `\'e9`, HTML, EPUB/DOCX sem `DecompressionStream`.
- [x] **2.9b** `JSON.parse` sem guarda (`fileParsers.ts:231`) vaza
  `SyntaxError` em inglês → try/catch com mensagem pt-BR.
- [x] **2.9c** RTF: `\'e9` vira espaço (`:191-202`) e o toggle de aspas quebra
  `""` e células multilinha → decodificar CP1252 e usar máquina de estados.
- [x] **2.9d** ZIP/DOCX/EPUB: continuar em vez de abortar no data descriptor
  (`:295`), `await writer.write()` (`:315`), erro pt-BR para navegador sem
  `DecompressionStream` (`:311`), ordenar capítulos pelo *spine* do OPF
  (`META-INF/container.xml`) em vez do nome do arquivo (`:373`).
- [x] **2.9e** Extensões desconhecidas (`.doc`, `.mobi`, `.azw3`, `.xls`) caem no
  branch de texto puro e geram livro binário (`:497-503`) → erro “formato não
  suportado” em pt-BR.
- [x] **2.9f** Modo Página: `App.tsx:348-351` zera `extraLoadedStagesCount` a
  cada substituição de `sentences` (o prefetch traduz e colapsa a paginação) →
  resetar só em troca de livro.
- [x] **2.9g** `fileParsers.ts:404-406` duplica versão/URL do pdf.js do
  `index.html:15` → centralizar constante.
- Aceite: suite nova verde; nenhum caminho de import lança mensagem em inglês.

### [x] 2.10 Robustez de utilitários (médio)
- [x] **2.10a** `cleanString` apaga acento em vez de normalizar
  (`shadowing.ts:16-19`, `matchingPairs.ts:53-59`) → NFD + strip
  `\u0300-\u036f`; alinhar com `normalizePtWord` (`shadowing.ts:1868`).
- [x] **2.10b** Apóstrofo curvo quebra contratação no STT mobile
  (`shadowing.ts:292-303`) → normalizar `[’‘`´]` → `'` em `cleanSpeech` e
  `normalizeSpokenTranscriptNumbers`.
- [x] **2.10c** `alignPortugueseClauses` duplica a frase PT inteira quando
  `P <= M` (`shadowing.ts:1951-1953`, fallback `:2244`) → distribuir
  proporcionalmente ou devolver vazio; testar `P == M` e `P < M`.
- [x] **2.10d** Precedência em `isContentWord` (`shadowing.ts:1985`) →
  `!EN_NON_FINAL_WORDS.has(cleanEn) && cleanEn.length >= 3`.
- [x] **2.10e** `mergeDriveSnapshots` usa `Date.now()` (`driveSync.ts:405`) →
  determinístico (`max(local, remote)`), com o bump feito no ponto de escrita.
- [x] **2.10f** Fingerprint sensível à ordem das chaves de `settings`
  (`driveSync.ts:185-193`) → canonicalizar (chaves ordenadas/allowlist); hoje
  dois aparelhos idênticos podem entrar em “confirmar mesclagem” para sempre.
- [x] **2.10g** Merge de stats por `Math.max` (`driveSync.ts:374-396`) perde
  dados de dois aparelhos no mesmo dia → decidir e documentar (somar deltas por
  device/sessão, ou assumir max-wins explicitamente).
- [x] **2.10h** `splitTextIntoTtsChunks` sem guarda de `maxChunkChars`
  (`ttsPlayback.ts:175-176`) → default quando `NaN`/≤0 e hard-split de token
  gigante (hoje `NaN` gera 1 chunk por palavra).
- [x] **2.10i** Regra de “máximo efetivo” do blind duplicada em 3 lugares
  (`voiceCompatibility.ts:145-148`, `shadowing.ts:2740-2750`, `App.tsx:3185-3212`)
  → uma função exportada e testada; `getHandsFreeEffectiveMaxAttempts` hoje é
  morta.
- [x] **2.10j** Duas fórmulas de velocidade (`shadowing.ts:494-503` clamp
  0,6–1,8 vs `voiceCompatibility.ts:30-53` 0,72–1,5) → browser TTS chega a 1,8x
  e cloud a 1,5x com o mesmo ajuste; unificar.
- [x] **2.10k** `isVocabDueForReview` com `nextReviewDate` inválido nunca vence
  (`shadowing.ts:2636-2639`) → tratar `NaN` como vencido.
- [x] **2.10l** `studyFlowLifecycle.ts:126` (`Math.floor(NaN)` → `NaN`) e
  `calculateSimilarity('', x) = 100` → guards.
- Aceite: testes para cada item acima.

### [x] 2.11 Fechamento da fase 2
- [x] lint + testes + build
- [x] revisar `todo.md`
- [x] commit: `Confiabilidade: settings, Drive, servidor e acessibilidade`

---

# Fase 3 (detalhada) — Performance e higiene de build

### [x] 3.1 Code splitting do bundle (860 kB / 257 kB gzip)
- Onde: `App.tsx:3-20` (todos os modais estáticos), `:35-49`
  (`googleDriveSyncService` → Firebase), `DonateCoffeeModal.tsx:2` (qrcode).
- Ações:
  - mover `CoffeeCupIcon` para módulo de ícones (hoje arrasta `qrcode` para
    todo usuário);
  - `React.lazy` + `Suspense` para Settings, Library, Stats, Drive, Donate,
    Challenge, Vocab, SentenceNavigator, Dictionary (renderizam `null` fechados);
  - `await import('firebase/auth')` dentro de `initDriveAuth`/`signIn…`;
  - opcional: `manualChunks` para vendor.
- Aceite: chunk inicial < 350 kB gzip; login do Drive continua funcionando;
  modais abrem sem flash perceptível.

### [x] 3.2 Remover peso morto do `public/`
- [x] `public/assets/aistudio/shadowreader_aprenda_ingl_s_com_seus_livros_94a71ff3.html`
  (166 kB, protótipo antigo publicado em produção) → remover.
- [x] `favicon.ico` (360 kB) duplicado na raiz e em `public/` → otimizar para
  ~15–30 kB, manter só `public/` e declarar `<link rel="icon">` no `index.html`.
- Aceite: `dist/` sem o HTML antigo e com favicon < 30 kB.

### [x] 3.3 Cabeçalho do HTML e carregamento de terceiros
- [x] pdf.js carregado de CDN no `<head>`, bloqueante e sem SRI
  (`index.html:15`) → carregar sob demanda no import de PDF; adicionar
  `integrity`/`crossorigin` quando carregado.
- [x] Adicionar `theme-color`, `apple-touch-icon` e `color-scheme` por tema
  (hoje scrollbars/inputs nativos ficam do tema errado no claro/sépia).
- [x] `::-webkit-scrollbar-thumb` hardcoded (`index.css:239-245`) → usar tokens
  do tema.
- [x] Manter título/OG em inglês (decisão registrada); só garantir
  `og:image`/`og:url` válidos.
- Aceite: import de PDF continua funcionando offline-de-CDN com mensagem pt-BR.

### [x] 3.4 Configuração de build
- [x] `vite.config.ts:11` `__dirname` → `import.meta.dirname` (aviso do build).
- [x] Definir `build.target` explícito (hoje herda default e o bundle pode
  incluir lookbehind de `ttsPlayback.ts:180,192` e `shadowing.ts:729`, que
  quebra Safari/iOS < 16.4 em parse-time) → substituir lookbehind por
  split com capture group.
- Aceite: build sem warnings; bundle sem lookbehind.

### [x] 3.5 Fechamento da fase 3
- [x] medir bundle antes/depois e registrar no PR
- [x] commit: `Performance: code splitting, favicon e carregamento do pdf.js`
- Resultado: chunk inicial **261,7 kB → 188,5 kB gzip**; 9 modais + `firebase/auth`
  viraram chunks sob demanda; `favicon.ico` **368 kB → 591 B**; pdf.js saiu do
  `<head>` (carregado só no import de PDF, com SRI).

---

# Fase 4 (detalhada) — Docs e agentes

### [x] 4.1 AGENTS.md
- [x] Corrigir `"No CI or pre-commit hooks"` (falso): descrever
  `.github/workflows/ci.yml` (npm ci, lint, testes, build) e que ele **não**
  bloqueia deploy.
- [x] `engines`: `>=22` → `>=22.18` (Vite 8 pede ≥22.12; `npm start` =
  `node server.ts` pede type stripping nativo).
- [x] Substituir a nota histórica sobre `.env.local` por aviso atual: existe
  `.env.local` com `VERCEL_OIDC_TOKEN` (Vercel CLI), gitignored — nunca
  commitar/copiar para a VPS.
- [x] Registrar que libs do cliente ficam em `devDependencies` **de propósito**
  (imagem da API usa `npm ci --omit=dev`).
- [x] Registrar que o título/OG em inglês é intencional (exceção à regra pt-BR).
- [x] Documentar acoplamento de build: `vercel.json:29` fixa o host da API no
  CSP; trocar `VITE_API_BASE_URL` exige editar o CSP e redeploy.
- [x] Seção “onde as coisas vivem / gotchas”: strings inline em `App.tsx` e
  `components` (não há i18n), contrato `/api/voice-hub/*` (request/response e
  formato de `providerUsed`), `src/data/` (SAMPLE_BOOKS consumido por testes),
  `dist/` e `.vercel/` gerados.
- [x] Checklist “adicionar um card/step”: tipo em
  `types/shadowreader.ts`, `STEP_CARD_META`, `buildEffectiveCardSequence`,
  migração em `loadSavedSettings`, render em `App.tsx`, preset no Settings.
- [x] Convenções anti-bug (aprendidas nesta revisão): sem efeito colateral em
  updater de `setState`; nunca `toISOString().slice(0,10)` para “dia” do
  usuário; não usar `select-none` global; toda string de UI em pt-BR.
- [x] Formatos aceitos: incluir `.markdown` e `.htm`.
- [x] Nota de segurança: restringir a API key web do Firebase por referrer no
  Google Cloud.

### [x] 4.2 README.md
- [x] Pré-requisitos: Node 22.18+.
- [x] `cp -n .env.example .env` (hoje sobrescreve um `.env` com chave válida).
- [x] Corrigir “funciona sem GEMINI_API_KEY”: TTS cai em fallback, correção de
  pronúncia devolve 503.
- [x] Como rodar 1 teste (`npx tsx --test src/utils/shadowing.test.ts`) e que
  são `node:test` puros.
- [x] Completar estrutura: `src/components/`, `src/data/`, `scripts/`,
  `Dockerfile`, `.github/workflows/ci.yml`.
- [x] Remover duplicação da tabela de produção (apontar para DEPLOY.md).
- [x] Troubleshooting local: porta 3000 ocupada, 503 sem chave, `npm start` sem
  `dist`.
- [ ] Badge de CI (opcional).

### [x] 4.3 DEPLOY.md
- [x] **Segurança (prioritário):** o `tar` manual (`:106-113`) exclui `.env` mas
  não `.env.local` → trocar por `--exclude='.env*' --exclude=.vercel
  --exclude='tmp_probe*.ts'`.
- [x] Remover `PORT=3000` do `.env` da VPS (compose fixa 3000; só confunde) e
  remover `http://localhost:3000` do `CORS_ORIGINS` de produção.
- [x] Passo 0 do primeiro install: clonar em `/opt/teacherreader` + criar `.env`
  antes de rodar `install-vps-auto-deploy.sh`.
- [x] Corrigir diagrama: `git checkout -f -B main "$REMOTE_SHA"` (não
  `origin/main`).
- [x] Corrigir “CI em todo push/PR” → push na `main`, PRs e `workflow_dispatch`.
- [x] Corrigir “rollback = `compose down`” (isso é desligar); rollback real é
  `vps-deploy.sh` no commit anterior / wrapper.
- [x] Corrigir `trust proxy`: o Express confia em exatamente 1 hop (não “confia
  no X-Forwarded-For” genericamente).
- [x] Documentar `.vercel/` não versionado: `npx vercel link` antes de
  `vercel deploy`.
- [x] Pré-requisito de `sudo` sem senha para o service (`User=ubuntu` +
  `sudo docker`).
- [x] Instruções de build Docker local para validar o gate.
- [x] Tabela única de variáveis: servidor, build (`VITE_API_BASE_URL`) e
  operação (`REPO`, `SERVICE`, `HEALTH_URL`, `HEALTH_ATTEMPTS`, `BRANCH`).
- [x] Marcar a cota do Gemini como “verificada em <data>” (número externo).
- [x] Documentar `connect-src` do CSP ↔ `VITE_API_BASE_URL` e o rewrite
  `/api/` ausente no Vercel (404 sem dica).
- [x] Corrigir formato de `providerUsed` na cadeia de fallback.

### [x] 4.4 .env.example / package.json / scripts / ignorers
- [x] `.env.example`: separar blocos “Servidor (dotenv)” × “Frontend (build
  Vite)” × “Operação”; adicionar `DISABLE_HMR`; comentar que `PORT` no VPS é
  fixado pelo compose.
- [x] `package.json`: `name` → `teacherreader`, descrição/repositório,
  `version` inicial real; script `test` (`tsx --test "src/utils/*.test.ts"`) e
  usar em README/AGENTS/CI/Dockerfile; `clean` cross-platform
  (`node -e "require('fs').rmSync('dist',{recursive:true,force:true})"`).
- [x] Lockfiles: manter `package-lock.json` (npm em CI/Docker/Vercel) e remover
  `bun.lock` ou documentar que está congelado — hoje os dois convivem.
- [x] `scripts/install-vps-auto-deploy.sh:121`: incluir
  `firebase-applet-config\.json` no filtro de rebuild (é copiado para a imagem
  em `Dockerfile:10`).
- [x] `.gitattributes`: `*.sh text eol=lf`.
- [x] `.dockerignore`/`.vercelignore`: remover `Dockerfile` duplicado, excluir
  `.vercel/` e `bun.lock`.
- [x] `Dockerfile`: `COPY .npmrc` e remover flags duplicadas (ou justificar).

### [x] 4.5 Fechamento da fase 4
- [x] diff revisado por um “leitor cético”: nenhuma afirmação do doc deve
  contradizer o código
- [x] commit: `docs: alinhar README, AGENTS e DEPLOY com o código`

---

# Fase 5 — Melhorias contínuas (backlog priorizado)

### [ ] 5.1 Observabilidade mínima
Hoje não existe um único `console.error` no projeto — falhas são `catch {}`.
- [ ] Error boundary global com tela pt-BR e botão “recarregar”.
- [ ] Log leve de eventos (provider usado, fallback acionado, 429, falha de
  import) sem PII, agregado em memória e exposto em
  `/api/voice-hub/status` (ou `/diagnostics`).

### [ ] 5.2 PWA / offline
- [ ] `manifest.webmanifest` + service worker cacheando shell e áudio já ouvido.
- [ ] Tela de “sem conexão” com o que ainda funciona (leitura, dicionário local).

### [ ] 5.3 Consistência de gamificação (`StatsModal.tsx`)
- [ ] `rewardXp` anunciado mas nunca concedido (`:224-279`, `:686-690`) →
  conceder e persistir ou remover do copy.
- [ ] “Meta de Dias de Prática” conta todo o histórico (`:155-164`) e nunca
  reinicia; mudar `dailyGoal` reescreve o passado → janela dos últimos N dias
  ou `DailyStatEntry.goal` congelado.
- [ ] Tier fantasma “Domínio Supremo” (`:63-67`).
- [ ] Gráfico de 30 dias: barras vazias com 10% de altura (`:606`) e rótulos só
  com o dia (`:608-612`) → 0 para dia vazio e `dd/MM` em virada de mês.
- [ ] “Próxima em {interval}d” mostra intervalo, não dias restantes, e
  `undefined` quando legado (`VocabModal.tsx:302`) → `nextReviewDate` + guard.
- [ ] Vocabulário/dicionário: “Salvar no Caderno” salva `Buscando tradução...`
  (`DictionaryModal.tsx:37,43-52,180`) → desabilitar durante o load e não
  embutir o placeholder na frase salva.
- [ ] “Limpar Tudo” do caderno (`VocabModal.tsx:329-336`) e exclusão de livro
  (`LibraryModal.tsx:525-545`) sem confirmação → reusar o padrão do
  `GoogleDriveSyncModal`; oferecer exportar antes.
- [ ] `extendedLexicon.ts:999-1010`: `ipa: /<palavra>/` fabricado para ~983
  entradas, `pos: 'Vocabulário'` e `def` boilerplate (peso no bundle), 25
  entradas com `pt === word` (`boston`, `pizza`, `hotel`), chave morta `Till`
  (`:827`) → `ipa: ''` + ocultar a linha, remover boilerplate, corrigir as 25.
- [ ] Prefetch pode enfileirar ~30–40 TTS por frase
  (`sentencePrefetch.ts:215-220,256-266`) — no free tier isso empurra tudo para
  o fallback → limitar palavras de conteúdo e tornar prefetch de palavra opt-in.
- [ ] `donations.ts:74-104`: PIX BR Code sem uppercase/sem remover acento no
  nome/cidade e `padStart(2)` estoura com valor ≥ 100 → sanitizar e validar
  tamanhos.
- [ ] `matchingPairs.ts:81-85`: cognatos legítimos viram string vazia e o card
  PT mostra inglês; `deduplicateMatchingTranslations` usa pool fixo de 8
  distratores (`:363-378`).

### [ ] 5.4 Testes que faltam
- [x] `fileParsers.test.ts` (ver 2.9a).
- [ ] `cardSequencePresets.test.ts` (`formatCardSequenceSummary`,
  `STEP_CARD_META`, presets).
- [x] `normalizeSettings` e `localDayKey`.
- [ ] Casos de borda: livro vazio, livro de 1 frase, CRLF em CSV/SRT/RTF,
  `alignPortugueseClauses` com `P <= M`, `parseDriveBackupSnapshot` rejeitando
  livro inválido.
- [ ] Substituir asserções que nunca falham (`shadowing.test.ts:430-431`,
  `speechCaptureTiming.test.ts:24`, `voiceCompatibility.test.ts:60`) e o teste
  tautológico de `donations.test.ts:12-34`.
- [ ] Mover para spec de serviço os testes que hoje dependem de
  `storageService`/`SAMPLE_BOOKS` em `shadowing.test.ts` (`:203,322,435,478,508`).

### [ ] 5.5 Dívida de arquitetura
- [ ] Extrair `useShadowingEngine` + `useSpeechCapture` de `App.tsx` (6.584
  linhas), mantendo regras puras em `src/utils/`. Facilita corrigir 1.5/1.6/2.3
  e reduz risco de regressão.
- [ ] Remover exports mortos (`getPresetById`, `getStudyExecutionMode`,
  `getHandsFreeEffectiveMaxAttempts`, `getApiBaseUrl` público).
- [ ] Alinhamento PT/EN depende de vocabulário escrito à mão
  (`EN_TO_PT_ANCHOR_MAP`, `EN_PRENOMINAL_MODIFIERS` com `barista`,
  `cobblestone`, `bioluminescent`) → documentar como heurística calibrável.
- [ ] SM-2 usa EF anterior em vez do atualizado (`shadowing.ts:2599-2609`) —
  desvio pequeno e determinístico; decidir se corrige.

---

## Ordem, dependências e risco

| Fase | Depende de | Risco | Motivo |
|---|---|---|---|
| 1 | — | baixo/médio | mudanças localizadas, cobertas por testes novos |
| 2 | 1.1 (compartilha `shadowing.ts`) | médio | toca motor e servidor; fazer em sub-PRs |
| 3 | — | baixo | build/perf; validar manualmente login e PDF |
| 4 | 2.8 (documenta o servidor real) | baixo | só texto + configs |
| 5 | 1–3 | variável | melhorias incrementais |

## Definition of Done global

```bash
npm run lint
npm test
npm run build
```

- [x] zero warnings novos no build
- [x] nenhuma string de UI em inglês (exceto título/OG, por decisão)
- [x] `grep` de `toISOString().slice(0,10)` retorna só usos legítimos
- [x] `grep` de `localStorage` no código de produção fora de `storageService.ts` retorna zero
- [x] `grep` de `select-none` no `index.html` retorna zero
- [x] `todo.md` atualizado com o que foi concluído

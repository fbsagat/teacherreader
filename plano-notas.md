# Plano de execução — itens do `notas.md`

Documento de planejamento. **Nenhuma alteração de código foi feita ainda.**
Referências de linha levantadas no commit `f9054e7` (árvore limpa) e podem
deslocar durante a execução — use o texto como âncora.

Baseline verificado agora:

| Verificação | Resultado |
|---|---|
| `npm run lint` (`tsc --noEmit`) | limpo |
| `npm test` | 137 testes, 137 passam |
| Árvore git | limpa, `f9054e7 Update notas.md` |

---

## Status de execução

| Fase | Itens | Estado |
|---|---|---|
| A | 4, 5, 6, 7 | **concluída** — `lint` limpo, 138 testes verdes, `build` ok |
| B | 1, 2 | **concluída** — `lint` limpo, 145 testes verdes, `build` ok |
| C | 9, 8 | **concluída** — `lint` limpo, 145 testes verdes, `build` ok |
| D | 10 | **concluída (código)** — causa raiz do STT vazio corrigida, coach em `gemini-3.8-flash`, `/status` com cooldowns, `scripts/check-apis.mjs`; falta só a gravação humana no app |
| E | 11 (`iniciar-servidor.bat`) | **concluída** |

Notas da Fase C (itens 9 e 8):

- **Item 9:** `SettingsTabId` virou `'presets' | 'steps' | 'voice_ai' | 'text_theme'`;
  rótulos "Presets / Etapas / Voz & IA / Texto & Tema", ids das abas
  (`tabSettingsPresets`, `tabSettingsSteps`, `tabSettingsVoiceAi`,
  `tabSettingsTextTheme`) com `aria-controls`, `role="tabpanel"` e
  `aria-labelledby` nos painéis. Badge "Novo" removido. O bloco duplicado do
  "Falar Sem Inglês" (aba Texto & Tema) saiu; no lugar ficou um atalho para
  Etapas, que é a fonte única da regra.
- **Item 8 (layout):** ~~duas colunas a partir de `lg`~~ → **revisado após
  revisão visual: todos os cards empilhados de cima para baixo** (decisão do
  usuário em 2026-11-17). O `main` voltou a ser uma coluna flex centralizada
  (`max-w-4xl lg:max-w-5xl xl:1180 2xl:1280`): cards de texto e card de fala em
  sequência, e o dock de controles voltou a ser um `<footer>` fixo no rodapé
  (`#sessionControlsDock`), visível em todos os breakpoints. Nada de grid, nada
  de `sticky`, nenhum `id`/handler duplicado.
- **Item 8 (chrome, revisado):** o menu `⋯` foi **removido** por ser redundante —
  cada item já tinha outro caminho: Café = botão do header; Voz & IA e Mãos
  Livres = Configurações (Voz & IA / Texto & Tema); Modo Bolso = botão mobile;
  "Salvo" = indicador inline da barra de status. O que sobrou no desktop:
  `Cards | Página`, `🎛️ Etapas` (abre Configurações → Etapas), `Mãos Livres
  ON/OFF`, `Sentença N/M` e `✓ Salvo`. O resumo da sequência saiu do botão
  (duplicava a barra de etapas logo abaixo) e virou `title`, junto com
  "Editar etapas e repetições". O "Editar Etapas" duplicado da barra de etapas
  fica só no mobile. O chip `#sessionStepPositionBadge` também foi removido
  (a própria barra de etapas já mostra a etapa atual e o total).
- **Item 8 (polimento, mantido):** `focus-visible:ring` nos controles principais
  do fluxo, "Nível" neutro (sem indigo decorativo).
- Não implementado nesta rodada (recomendações do item 9 fora da decisão
  aprovada): extração dos subcomponentes de aba, resumo lateral "Como seu treino
  vai rodar" e rodapé fixo de Configurações.

Notas da Fase B (desvios):

- O CTA de avanço virou **um botão único dentro da `#sentenceStepOrderBar`**
  (`#btnFreeModeNextCta`), ao lado das etapas, com três rótulos: "Próxima parte →",
  "Próxima sentença →" e "Concluir livro →". O plano previa um CTA perto do
  `#stateBadge`; a barra de etapas é o lugar onde a navegação já vive e evita
  duplicar controle na mesma linha do badge de status.
- **Não** foi criado um CTA "próxima fala" para pular de `speak` para
  `speak_blind_en`: dentro da mesma parte o avanço continua sendo o clique na
  etapa (os chips já fazem isso e o `title` explica). Só parte e sentença ganharam
  CTA, como no pedido.
- `progressPercent` passou a ser recalculado **no merge do Drive para todos os
  livros** (inclusive os que existem só de um lado), não apenas nos que colidem,
  para nunca sobrar percentual ausente/antigo no JSON exportado.

Notas da Fase A (desvios aprovados na execução):

- `audioFlow` padrão passou de `pt_first` para `blind_en`: era o único jeito de a
  aba de Presets não mostrar "Ciclo Essencial" como ativo enquanto a sequência
  real tinha "Falar Sem Inglês". O preset `blind_en` já existia com exatamente
  essa sequência.
- A etapa lenta usa **taxa absoluta** (`EN_SLOW_PLAYBACK_RATE = 0.6`) em vez de
  multiplicador: com o piso de 0.72 do áudio neural, nenhum multiplicador
  conseguiria ficar abaixo de 0.72. `computeEffectiveTtsRate` ganhou
  `absoluteRate`, que ignora o piso mas respeita os limites do navegador
  (0.5–1.5). O caminho normal continua com o piso.

---

## Visão geral

| # | Item | Tipo | Fase | Risco |
|---|---|---|---|---|
| 1 | Não avançar automaticamente fora do modo treino | Motor/FSM | B | médio |
| 2 | Progresso por livro medido por conclusão real | Dados + UI + sync | B | médio |
| 4 | Card "The Secret of Beacon Hill" quebra a altura da linha | CSS/UI | A | baixo |
| 5 | Modal de Configurações maior e com tamanho fixo | CSS/UI | A | baixo |
| 6 | Modal Progresso/Metas/Léxico com tamanho fixo | CSS/UI | A | baixo |
| 7 | Novos padrões de velocidade, "Falar sem inglês" e revelação | Defaults | A | baixo/médio |
| 8 | Home desktop mais clean sem perder funcionalidade | Layout | C | médio |
| 9 | Recomendações para limpar o menu de Configurações | UX/estrutura | C | médio |
| 10 | Verificar e corrigir APIs conectadas | Diagnóstico + servidor | D | médio |

Ordem recomendada: **A → B → C → D**, com o item 10 podendo começar em paralelo
porque mexe em `server.ts`/serviço de áudio, não no layout.

---

# 1. Não avançar automaticamente fora do modo treino

## Diagnóstico

"Modo treino" = `isPlayingLoop === true` (Ciclo Guiado). Fora dele (`Modo Livre`),
o app hoje encadeia etapas sozinho em quatro pontos de `src/App.tsx`:

| Local | Comportamento atual |
|---|---|
| `evaluateTargetOrStep` — `:3096-3168` | depois de acertar uma fala, executa TODAS as etapas seguintes não-fala (`pt`, `en`, `literal`, desafios) |
| `evaluateTargetOrStep` — `:3174-3265` | inicia automaticamente a próxima etapa de fala (`speak_blind_en`, `speak_challenge`, segundo `speak`) e já abre o microfone |
| `evaluateTargetOrStep` — `:3273-3302` | conclui a sub-parte e já avança `activeStepIdx` + toca o preview da próxima parte |
| `evaluateTargetOrStep` — `:3303-3322` | conclui a frase inteira e chama `jumpToSentence(idx + 1)` |
| `handleOpenChallengeManual` — `:3587-3593` | ao concluir/saltar um desafio, chama `jumpToSentence(idx + 1)` |

O `runShadowingStep` (`:2437`) já tem a guarda `if (!isPlayingLoopRef.current) return`,
ou seja, o motor do treino não roda em Modo Livre. O encadeamento acima é o que
dá a sensação de "executei uma etapa e ele foi para a próxima".

## O que entendi do pedido

Fora do treino, executar **uma** etapa deve terminar **naquela** etapa. Nada de
tocar o áudio da etapa seguinte, abrir desafio sozinho, iniciar a próxima fala,
avançar sub-parte ou pular de frase. O avanço passa a ser sempre explícito:
"Próxima parte", "Pular", "Próxima sentença" ou "Iniciar/Continuar Treino".

## Plano

1. Criar um helper puro em `src/utils/studyFlowLifecycle.ts`:
   ```ts
   resolveFreeModeCompletion({
     isPlayingLoop: boolean,
     isIntermediateSubClause: boolean,
     sentenceFinished: boolean
   }): 'stay_on_step' | 'stay_on_sentence'
   ```
   Regra: `isPlayingLoop === true` → comportamento atual (não é este helper que
   decide o treino); `false` → sempre `stay_on_step`/`stay_on_sentence`.
   Testar no `studyFlowLifecycle.test.ts` (incluindo `NaN`/estado inconsistente).
2. Em `evaluateTargetOrStep`, quando **não** está em loop:
   - continuar calculando nota, `applyEvaluationFeedback`, chime, `lastScore`,
     `wordResults`, progresso e bookmark;
   - **não** executar o laço `:3096-3168`;
   - **não** entrar no bloco `hasMoreSpeakSteps` (`:3174`);
   - **não** avançar `activeStepIdx` (`:3273`);
   - **não** chamar `jumpToSentence` (`:3314`);
   - finalizar com `enginePhase = 'IDLE'`, limpar destaques, `activeSequenceStepIdx = null`
     e um toast pt-BR: `✓ Etapa concluída! Use "Próxima parte" ou "Próxima sentença" para continuar.`
3. Em `handleOpenChallengeManual`, quando o outcome for `'advance'` e não estiver
   em loop: manter a sentença, limpar estado, toast
   `🏆 Desafio concluído! Sentença mantida — use "Próxima sentença" para avançar.`
   Não abrir o modal de livro concluído; isso passa a acontecer só no
   `handleNextSentenceButton` explícito (`:3699`).
4. Sub-parte: ao concluir a parte, marcar `completedStepIndices` e mostrar um
   CTA explícito **"Próxima parte →"** perto do `#stateBadge` (visível quando
   `isStepByStepMode && activeStudyStep && !activeStudyStep.isFull &&
   completedStepIndices.includes(activeStepIdx) && !isPlayingLoop`). O clique
   faz exatamente o bloco que hoje roda automático (`:3287-3302`).
5. Manter o "Pular" da revisão palavra-por-palavra (`handleSkipWordByWord`,
   `:3710-3789`) como está: é um comando explícito de avanço, não automático.
6. Treino (`isPlayingLoop`) fica intocado.

## Arquivos

- `src/App.tsx` (motor/FSM)
- `src/utils/studyFlowLifecycle.ts` + `.test.ts`
- Strings inline em `App.tsx` (pt-BR)

## Aceite

- Em Modo Livre, tocar "Falar Agora" e acertar **não** toca TTS de `pt`/`en`
  seguinte, **não** abre desafio, **não** inicia segunda fala e **não** muda de
  sentença.
- Terminar um desafio manual não muda de sentença.
- Concluir uma sub-parte não avança para a próxima; o CTA "Próxima parte" aparece.
- "Iniciar/Continuar Treino" continua avançando tudo automaticamente.
- `studyFlowLifecycle.test.ts` cobre o helper novo.

## Risco

O usuário pode sentir que "travou". Mitigação: toasts claros + CTA de próxima
parte + o botão "Próxima sentença" do dock, que já existe.

---

# 2. Progresso por livro medido por conclusão real

## O que entendi (pedido explícito de retorno antes de codar)

Hoje o progresso de um livro é **posição de leitura**, não conquista: em
`src/App.tsx:548-552`, `src/services/storageService.ts:64` e `:130`,
`progressPercent = ((currentIndex + 1) / total) * 100`. Basta chegar na sentença
para o livro aparecer como avançado. Na Biblioteca, o card mostra "Sentença X de
Y (Z%)"
(`LibraryModal.tsx:485-487` e `:519`).

O app **já tem** a informação certa: `sentenceProgress[idx].completed` só é
marcado quando a fala final da frase inteira passa
(`App.tsx:2024-2046`, `sentenceCompleted = passed && isFinalSentencePass`). Esse
campo já é persistido no IndexedDB e sincronizado no Drive.

Proposta: **progresso do livro = % de frases dominadas** (`completed === true`
dividido pelo total). A posição de leitura continua sendo o bookmark
(`sr_bookmark_*` / `currentIndex`) e continua alimentando o botão "Continuar".
São dois conceitos separados:

- **Onde estou:** sentença N;
- **Quanto dominei:** X de Y frases concluídas (Z%).

Assim o usuário pode ler/ouvir 10 frases sem falar e o livro continua em 0% —
o que é o comportamento desejado pelo pedido.

## O que conta como "concluída"

Recomendação para a v1: **fala final da frase inteira aprovada**
(`sentenceProgress[idx].completed`). Já existe, não muda schema, não quebra
sync. Alternativa mais rígida (fala + desafios, ou sequência inteira) exigiria
novos campos por sentença (`challengeCompleted`, `stepsCompleted`) e migração;
fica como fase 2b opcional.

## Plano

1. Novo helper puro `src/utils/bookProgress.ts`:
   ```ts
   computeBookProgress(total: number, progress: Record<number, SentenceProgress>):
     { completedCount: number; total: number; percent: number }
   ```
   - ignora índices negativos, não inteiros e `>= total`;
   - `percent = completedCount === total && total > 0 ? 100 : min(99, round(...))`
     (nunca 100% antes da última frase);
   - `total = 0` → 0%, sem divisão por zero.
   Testes: 0/3, 1/3, 2/3, 3/3, 199/200 (não pode dar 100), mapa vazio, índices
   inválidos.
2. Trocar todos os cálculos de `progressPercent` pelo helper:
   - `App.tsx:548-552` (`exportCurrentDriveSnapshot`);
   - `storageService.ts:47-79` (`saveBookToDB`);
   - `storageService.ts:102-148` (`updateBookmarkInDB` — aplicar o update e
     recalcular a partir do mapa final);
   - `driveSync.ts:45-84` (`sanitizeBook`);
   - `driveSync.ts:297-335` (`mergeDriveSnapshots`).
3. Biblioteca (`LibraryModal.tsx:483-529`):
   - texto: `X de Y frases dominadas (Z%)` + linha separada `Você está na
     sentença N`;
   - barra usa o novo percentual;
   - "Continuar" continua usando `currentIndex` (posição), não o progresso.
4. Barra de progresso do topo (`App.tsx:4203`): passar a usar o mesmo percentual
   e adicionar `title`/rótulo `Frases dominadas: X de Y`. O contador
   `Sentença N/M` continua visível.
5. Sincronização: como `progressPercent` derivado já é recalculado no sanitize e
   no merge, não há conflito novo — o fingerprint (`driveSync.ts:163-210`) não
   inclui `progressPercent` (só índice + `sentenceProgress`). Confirmar com teste
   de merge existente.
6. Migração/legado: **não** semear `completed` para trás. Livros antigos podem
   cair de 80% para 0% até a primeira fala aprovada — comportamento aprovado
   (progresso = conquista, posição = bookmark). Tooltip na Biblioteca:
   "Progresso conta frases realmente dominadas; a posição de leitura aparece em
   'Você está na sentença N'."

## Arquivos

- `src/utils/bookProgress.ts` + `.test.ts` (novo)
- `src/App.tsx`, `src/services/storageService.ts`, `src/utils/driveSync.ts`
- `src/components/LibraryModal.tsx`

## Aceite

- Chegar numa sentença sem falar mantém o progresso em 0%.
- Aprovar a fala final da frase inteira incrementa exatamente 1 frase.
- Livro 100% só quando todas as sentenças estão `completed`.
- Card da Biblioteca mostra "X de Y dominadas" e "Você está na N".
- Drive: exportar, restaurar e mesclar mantêm o mesmo percentual derivado.
- `npm test` verde com os novos casos.

## Risco

Mudança de expectativa (números caem). Mitigação: copy explicativa e não mexer
no bookmark/botão "Continuar".

---

# 4. Card "The Secret of Beacon Hill" quebra a altura da linha

## Causa

Na grade do catálogo (`LibraryModal.tsx:349-436`, 3 colunas no desktop), os cards
são `flex flex-col justify-between` sem altura fixa. O card da obra-prima tem
conteúdo extra:

- badge de nível longo: `A1 → A2 → B1 → B2 → C1 · Progressivo` (quebra em 2 linhas);
- título longo ("The Secret of Beacon Hill (Obra-Prima A1→C1)");
- parágrafo extra exclusivo (`:411-415`): "Romance, mistério e drama em Boston…".

A linha da grade estica para o card mais alto, enquanto as outras linhas ficam
menores.

## Plano

1. Grade: `auto-rows-fr` + cards `h-full` (`:349-352` e `:372`).
2. Anatomia fixa para todos os cards:
   - linha de badges com altura fixa e `flex-nowrap`; encurtar o badge da
     obra-prima para `A1→C1 · Progressivo` e usar `title` com a versão longa;
   - título com `line-clamp-2` e `min-h` de 2 linhas em todos;
   - autor `truncate` (1 linha);
   - descrição: **remover o parágrafo exclusivo** da obra-prima do corpo do card;
     a informação vira `title` do badge/contextTag ou entra no rodapé como
     `contextTag` truncado, que todos já têm (`:418-421`);
   - rodapé com 1 linha (`truncate`).
3. Com a mesma quantidade de linhas em todos, as linhas da grade ficam iguais
   mesmo sem altura mágica. O `auto-rows-fr` é a rede de segurança.
4. Conferir 3 larguras: `sm` (2 colunas), `lg` (3 colunas) e mobile (1 coluna).

## Aceite

- Em 1024/1280/1440 px, todos os cards do catálogo têm a mesma altura dentro da
  linha e entre linhas.
- Nenhum texto informativo é perdido (descrição acessível via tooltip).
- Filtros e clique do card continuam funcionando.

---

# 5. Modal de Configurações: maior + tamanho/posição fixos

## Estado atual

`SettingsModal.tsx:455-468`: overlay centralizado, card
`max-w-2xl lg:max-w-3xl xl:max-w-[880px] w-full max-h-[92dvh]`, altura livre.
Ao trocar de aba o conteúdo muda e o modal "pula"/muda de altura.

## Plano

1. Largura: `w-[min(1120px,95vw)]` (de 880 → ~1120 no desktop).
2. Altura fixa: `h-[min(820px,92dvh)]` — o `92dvh` protege telas baixas e o
   `820px` fixa o desktop. Nada de `max-h` apenas.
3. Manter o overlay `fixed inset-0 flex items-center justify-center` (posição
   fixa na tela, sem deslocar entre abas) e o `overflow-hidden` no card.
4. Conteúdo já é `flex-1 min-h-0 overflow-y-auto` (`:571`): com altura fixa, só
   o miolo rola; header e abas ficam parados. Revisar as duas listas internas
   com `max-h-44`/`max-h-32` (`:675`, `:942`) para não criarem scroll duplo.
5. Em telas muito baixas (`< 640px` de altura), `h-[min(820px,92dvh)]` resolve;
   testar 360×640 e 390×844.

## Aceite

- Abrir em "Modelos" e trocar para "Voz & IA" não muda largura, altura nem
  posição do modal.
- Desktop 1440×900: modal ~1120×820, centralizado, header/abas visíveis e apenas
  o conteúdo rolando.
- Mobile: ocupa ~95% da largura sem overflow horizontal.

---

# 6. Modal Progresso, Metas & Domínio Lexical: tamanho/posição fixos

## Estado atual

`StatsModal.tsx:306-319`: mesmo padrão, `max-w-2xl lg:max-w-3xl xl:max-w-[880px]
max-h-[92dvh]` e altura variável por aba (Metas, Conquistas, Léxico).

## Plano

1. `w-[min(1040px,95vw)] h-[min(760px,92dvh)]`.
2. Overlay centralizado fixo (já está) e `flex flex-col overflow-hidden` no card
   (já está); miolo com `flex-1 min-h-0 overflow-y-auto` (`:448`).
3. Verificar se os gráficos/barras usam `%` e não `vh` (para não reagirem à
   altura fixa).
4. Alinhar o padrão visual dos dois modais (5 e 6) para não divergirem.

## Aceite

- Trocar entre as 3 abas não altera o tamanho nem a posição.
- Conteúdo mais longo (histórico de 30 dias) rola dentro, sem empurrar o header.
- Mobile sem overflow horizontal.

---

# 7. Novos padrões

## Mudanças em `src/utils/settingsNormalizer.ts:17-57`

| Campo | Atual | Novo | Observação |
|---|---|---|---|
| `ttsSpeedEn` | `0.85` | **`0.7`** | slider aceita 0.65–1.20 (step 0.05) |
| `ttsSpeedPt` | `1.15` | **`1.35`** | slider aceita 0.80–1.40 |
| `enableBlindSpeakingStage` | `false` | **`true`** | intenção: "Falar sem inglês" ativo |
| `cardSequence` | `['pt','en','speak','challenges']` | **`['pt','en','speak','speak_blind_en','challenges']`** | coerente com o blind ativo |
| `blindMaxErrorsBeforeReveal` | `2` | **`4`** | "revelar texto após errar: 4x" |
| `blindSpeakingOnFullSentence` | `true` | **`false`** | "revelar/etapa apenas em partes" |

## Impactos e cuidados

1. **Escopo dos padrões:** `DEFAULT_SETTINGS` afeta instalações novas e o botão
   "Restaurar Padrões". Usuários existentes com `shadowreader_opts` salvo
   continuam com os valores deles. Recomendação: manter assim ("novas
   configurações padrão"); se for para aplicar em todos, criar uma migração
   versionada (`_v5Defaults`) — decisão de produto.
2. **Conflito 0.7x × piso técnico:** `computeEffectiveTtsRate`
   (`src/utils/voiceCompatibility.ts:31-55`) limita Gemini/online a `0.72`.
   Com `ttsSpeedEn = 0.7`, o slider mostra 0.7x mas o áudio efetivo fica 0.72x.
3. **Conflito 0.7x × etapa "Ouvir EN 0.7x":** o card `en_slow` toca em `0.72`
   fixo (`App.tsx:2545`, `:3615`) e o rótulo é "Ouvir EN 0.7x". Com a velocidade
   normal em 0.7, os dois passos ficam praticamente idênticos. Opções:
   - **A (APROVADA):** aceitar o pedido (normal 0.7) e baixar a etapa lenta
     para `0.6x`, renomeando os rótulos (`STEP_CARD_META.en_slow`, Settings,
     preset `en_first`) para "Ouvir EN 0.6x";
   - ~~B: manter a etapa lenta em 0.72 e aceitar que soem iguais~~ (descartada);
   - ~~C: definir o padrão como 0.72 (audível) em vez de 0.7~~ (descartada).
4. **Testes:** `voiceCompatibility.test.ts:145` espera
   `effectiveNormalEnRate = 0.83` (derivado de 0.85). Com 0.7 o valor efetivo
   será `0.72` (piso) — atualizar a expectativa junto com a decisão acima.
   `normalizeSettings({})` continua igual a `DEFAULT_SETTINGS`, então os outros
   testes de normalização seguem.
5. **Blind por padrão:** mais uma etapa de fala no ciclo; `blindSpeakingOnFullSentence:
   false` faz a etapa aparecer só no modo "Em Partes" (padrão `isStepByStepMode =
   true`), o que está alinhado com "apenas em partes".
6. **Restaurar Padrões** já deve usar `DEFAULT_SETTINGS` completo; conferir
   (`SettingsModal.tsx:2175`) para não duplicar valores hardcoded.

## Aceite

- Instalação nova abre com 0.7x EN, 1.35x PT, sequência com "Falar Sem Inglês",
  revelação após 4 erros e blind só em partes.
- "Restaurar Padrões" devolve exatamente esse conjunto.
- Settings salvos de usuários antigos continuam intactos.
- `npm test` verde com a expectativa de `voiceCompatibility` ajustada.

---

# 8. Home desktop mais clean (sem perder funcionalidade)

## Diagnóstico da tela atual

Em desktop, antes dos cards, existem três faixas de chrome:

1. `HeaderBar` com logo, pill do livro, café, tema, Drive, Stats, Biblioteca,
   Caderno, Configurações;
2. linha de status + toolbar com modo, estado, nível, ato, streak,
   Cards/Página, resumo da sequência, Mãos Livres, Voz & IA, navegador de
   sentenças, "Salvo";
3. barra de etapas + botão "Editar Etapas".

Depois disso, os cards PT/EN/Revisão e o card de fala são empilhados em uma
coluna larga (`max-w-[1380px]`), com muito espaço horizontal e pouca hierarquia.
A ação principal ("Iniciar Treino") só aparece no dock inferior. Há funções
duplicadas: o resumo da sequência, "Editar Etapas" e o "Voz & IA" abrem o mesmo
modal em abas diferentes.

## Plano (4 etapas, desktop-first, mobile intacto)

### Etapa 1 — Consolidar o chrome

> **Revisado em 2026-11-17 (feedback visual):** o menu `⋯` foi descartado por
> ser redundante (todos os itens tinham outro caminho). A consolidação final é:
> topo com livro/sentença/CEFR/ato/streak à esquerda e `Cards | Página`,
> `Etapas`, `Mãos Livres` e `Sentença N/M` à direita — sem menu escondido.

- Criar uma única "barra de sessão" no topo do `main` com, à esquerda: livro,
  sentença N/M, CEFR, ato e streak; à direita: `Cards | Página`, resumo da
  sequência (abre Configurações → Etapas) e um menu `⋯`.
- Mover para o `⋯` apenas os atalhos secundários: Mãos Livres, Voz & IA, Modo
  Bolso, Café, "Salvo". Continuam existindo, com um clique a mais. No mobile,
  manter os botões atuais como estão.
- Manter a barra de etapas visível (é o mapa do treino), mas sem o botão
  "Editar Etapas" duplicado no desktop — a edição fica no resumo/menu.
- Preservar todos os `id` usados por `querySelector`/testes e todos os
  handlers (`#sentenceStepOrderBar`, `#btnViewCards`, etc.).

### Etapa 2 — Layout em duas colunas (≥ lg)

> **Revisado em 2026-11-17 (feedback visual):** a versão final ficou em **uma
> coluna**, com todos os cards empilhados de cima para baixo (texto → fala) e o
> dock de ações fixo no rodapé, como antes. O texto abaixo fica como registro da
> alternativa avaliada; o que foi implementado é o empilhamento centralizado.

```
┌────────────────────────── Header ──────────────────────────┐
│ TR  [📖 Livro atual]        Stats  Biblioteca  Caderno  ⚙  │
├────────────────────────────────────────────────────────────┤
│ Sentença 3/50 · B1 · ⭐ Ato 1 · 🔥4      [Cards|Página] [⋯] │
├───────────────────────────────┬────────────────────────────┤
│ [01 Português]                │ 🎤 Resultado da fala       │
│ [02 Inglês]                   │ [Iniciar Treino] [Falar]   │
│ [03 Revisão Automática]       │ ◀  Próxima  ▶              │
│                               │ Etapas · Progresso         │
└───────────────────────────────┴────────────────────────────┘
```

- Envolver o `#visualCardsStackContainer` e o `#speechFeedbackContainer` num
  wrapper `lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start` com o card
  de fala em `lg:sticky lg:top-3`.
- Mover o conteúdo do dock inferior para a coluna direita no desktop; manter o
  dock fixo apenas no mobile (`lg:hidden` no footer, `hidden lg:flex` no painel).
- Limitar a coluna de leitura a ~65–75 caracteres (`max-w-[72ch]`) para o texto
  não esticar; os cards ficam mais altos e legíveis.
- Não duplicar handlers: os mesmos botões são renderizados uma vez; só mudam de
  posição via CSS/estrutura.

### Etapa 3 — Hierarquia e linguagem

- Um acento principal (brand) + cores semânticas: verde = acerto, âmbar = atenção,
  rosa = microfone. Remover roxo/ciano/teal decorativos do chrome.
- Rótulos de etapa mais curtos nos cards (`Português`, `Inglês`, `Revisão`) com o
  texto completo em `title`; manter a numeração discreta.
- Estado da sessão explícito: `Modo Livre` / `Ciclo Guiado` + `Etapa 2 de 4 ·
  Ouvir EN` em vez de só "Pronto".
- CTA primário: "Iniciar Treino"/"Continuar Treino" com peso visual maior;
  "Falar Agora" secundário; navegação terciária.
- Barra de progresso com o novo texto do item 2 (`3 de 50 frases dominadas`).

### Etapa 4 — Polimento

- Espaçamento consistente (gap 2.5–3), raio 12–16 px, uma sombra só no card ativo.
- Foco visível (`focus-visible:ring`) em todos os controles.
- `aria-label` nos botões só-ícone do novo menu.
- Verificar 1280×800, 1440×900, 1920×1080 e zoom 125%.

## Fora de escopo

- Não remover nenhuma ação existente.
- Não mexer no layout mobile além de manter o atual.
- Não trocar emoji por biblioteca de ícones nesta rodada (custo/benefício baixo).

## Aceite

- Em 1440×900, todo o fluxo principal (ler PT/EN, ouvir, falar, navegar, iniciar
  treino, abrir etapas) está visível sem rolagem horizontal e com no máximo uma
  rolagem vertical curta.
- Nenhum botão/função desapareceu; secundários estão no menu `⋯` no desktop e
  visíveis no mobile.
- Todos os `id` e handlers continuam funcionando.
- Tema claro/sépia e os 6 temas continuam legíveis.
- **Revisado:** os cards seguem empilhados (uma coluna) em qualquer largura.

---

# 9. Menu de Configurações mais limpo — recomendações

> Item pede recomendação antes de código. Abaixo, o diagnóstico e a proposta.

## Problemas atuais

1. **Duplicação real:** os controles de "Falar Sem Inglês — revelar após errar"
   e "na frase inteira" aparecem duas vezes: em `SettingsModal.tsx:828-920`
   (aba Etapas) e `:1589-1691` (aba Texto, Tema & Regras). Já registrado no
   `todo.md` 2.7a.
2. **Abas com assuntos misturados:**
   - `Modelos`: presets;
   - `Etapas`: sequência + ordem dos cards visuais + regras do blind;
   - `Voz & IA`: TTS + vozes + STT + calibração + coach;
   - `Texto, Tema & Regras`: blind (de novo) + velocidades + rigor + mãos livres
     + tema + fonte + restaurar.
3. **Excesso de texto explicativo** em cada controle (parágrafos de 2–3 linhas),
   criando uma parede de texto e rolagem longa.
4. **Mistura de padrões de controle:** botões segmentados, selects, sliders,
   "toggles" que na verdade são botões, chips e cards clicáveis.
5. **Cores decorativas por seção** (indigo, teal, amber, purple, emerald) sem
   relação com estado.
6. **Rodapé de ações** ("Restaurar Padrões", "Fechar") no fim do scroll.

## Recomendações (em ordem de impacto)

1. **Eliminar a duplicação do blind** e escolher um único lugar: a aba de
   etapas, ao lado do card `speak_blind_en` (é uma regra da etapa). Remover o
   bloco da aba de texto/tema.
2. **Reorganizar em 4 abas com um assunto cada:**
   | Aba | Conteúdo |
   |---|---|
   | **Presets** | 5 presets recomendados + resumo da sequência ativa + "Personalizar" |
   | **Etapas** | construtor da sequência + ordem dos cards visuais + regras do blind |
   | **Voz & IA** | TTS + voz/persona + STT + calibração + coach + testes de amostra |
   | **Texto & Tema** | tema, tamanho da fonte, velocidades, rigor, mãos livres |
   Renomear "Modelos" → "Presets" e "Texto, Tema & Regras" → "Texto & Tema".
3. **Divulgação progressiva:** cada aba mostra o essencial; o que é avançado
   (calibração de pausa, supressão de ruído, construtor manual de sequência,
   repetições) fica atrás de um bloco "Avançado" recolhível. Presets e sliders
   principais sempre visíveis.
4. **Layout em 2 colunas no desktop** dentro das abas: controles à esquerda,
   resumo "Como seu treino vai rodar" fixo à direita (sequência, velocidades
   efetivas, blind, metas). Aproveita a largura nova do item 5.
5. **Padronizar controles:** um componente de linha (`label` + descrição curta +
   controle) e um de "switch" acessível (`role="switch"`, `aria-checked`).
   Segmentados só para 2–4 opções mutuamente exclusivas; select para listas
   longas; slider só para valores contínuos.
6. **Reduzir texto:** uma linha de ajuda por controle + `title` para detalhes;
   remover parágrafos repetidos e badges "Novo".
7. **Cores por função, não por seção:** brand para seleção; verde/âmbar/rosa só
   para estado. Ícones de seção podem continuar coloridos.
8. **Rodapé fixo** com "Restaurar Padrões" (com confirmação) e "Fechar"; o
   resumo do estado ativo fica no header.
9. **Extrair subcomponentes** (`SettingsTabPresets`, `SettingsTabSteps`,
   `SettingsTabVoice`, `SettingsTabRulesTheme`) para reduzir o arquivo de ~2.2k
   linhas e permitir revisar cada aba isoladamente. Sem mudança funcional.
10. **Acessibilidade:** foco visível, alvos ≥ 40 px, `aria-controls`/`role="tabpanel"`
    nas abas e `aria-label` nos botões só-ícone.

## Impacto esperado

- Uma única fonte para cada configuração (fim do bug de editar em dois lugares).
- Abas previsíveis, menos scroll, leitura escaneável.
- Mudanças de valor continuam imediatas (sem "Salvar"), com toast curto.

## Decisão (aprovada)

Reorganização das 4 abas **aprovada**:

| Aba | Conteúdo |
|---|---|
| **Presets** | 5 presets recomendados + resumo da sequência ativa + "Personalizar" |
| **Etapas** | construtor da sequência + ordem dos cards visuais + regras do blind |
| **Voz & IA** | TTS + voz/persona + STT + calibração + coach + testes de amostra |
| **Texto & Tema** | tema, tamanho da fonte, velocidades, rigor, mãos livres |

"Modelos" → "Presets"; "Texto, Tema & Regras" → "Texto & Tema". O bloco de blind
da aba de texto/tema é **removido**; fica só em Etapas, ao lado do card
`speak_blind_en`. A ordem dos cards visuais continua em Etapas.

---

# 10. APIs conectadas — verificação feita agora

## Resultado dos testes (produção)

| Serviço / rota | Teste | Resultado |
|---|---|---|
| VPS `/api/voice-hub/status` | GET | **200** `{"providers":{"gemini":true,"googleStream":true}}` |
| CORS da API | Origin `teacherreader.vercel.app` | **200** com `access-control-allow-origin` correto |
| CORS com origem estranha | Origin `evil.example` | sem header de liberação (ok) |
| Gemini TTS | POST pedindo `gemini_tts` | **200**, mas servido por `neural_cloud:en_us_001` (Gemini em cooldown/sem cota — esperado no free tier) |
| TikTok neural worker | GET | **405** (rota existe; só POST) e TTS via worker **200** `audio/mpeg` |
| Google Translate GTX (texto) | GET | **200** tradução correta |
| Google Translate GTX (TTS) | GET | **200** `audio/mpeg` |
| MyMemory | GET | **200**, `responseStatus: 200` |
| dictionaryapi.dev | GET | **200** com fonética/definições |
| STT transcrição (`evaluatePronunciation:false`) | 3 clipes limpos de TTS | **200 com `transcript: ""`** em 1,7–5,3 s — **quebrado** |
| STT coach (`evaluatePronunciation:true`) | 3 tentativas | **504** em ~7,0 s (orçamento do servidor) — **quebrado** |
| Firebase `__/auth/iframe` (proxy first-party) | GET | **200** |
| Identity Toolkit / OAuth certs | GET | alcançáveis (certificados **200**) |
| Google Drive API | GET `about` sem token | **401** (API no ar; só falta credencial) |
| Vercel app | GET | **200** |
| `/__/firebase/init.json` (Vercel e Firebase) | GET | **404** — rewrite morto; o app passa o config explicitamente, então é inofensivo |
| Servidor local 3110 | GET | conexão recusada (esperado; não há servidor local rodando) |

## Achados que exigem correção

1. **STT coach sempre estoura o deadline.**
   `server.ts:30` usa `STT_DEADLINE_MS = 7_000` e o cliente
   (`audioAndTranslationService.ts:1355`) aborta em 7,5 s. O modelo
   `gemini-4-hydrogen` não responde em 7 s nem com áudio de 1 s. Ou o modelo é
   lento/indisponível, ou o `thinkingLevel: LOW` + prompt JSON está caro.
   Correção: medir o tempo real com log, considerar modelo mais rápido/fallback,
   subir o orçamento do servidor para ~12 s **e** o timeout do cliente para
   ~13 s, mantendo o abort ligado a `res.on('close')`.
2. **STT transcrição devolve vazio com status 200.**
   `gemini-3.5-transcribe` respondeu sem texto para três áudios claros (TTS).
   Isso engana o cliente, que aceita `transcript: ""` e cai no fallback local
   sem avisar. Correção: tratar transcript vazio como falha (502/504 com
   `Retry-After`), logar o motivo (sem PII) e/ou usar um modelo alternativo de
   transcrição; nunca devolver `providerUsed` como sucesso com texto vazio.
3. **Mensagem de erro errada no STT.** `server.ts:779` devolve "Tempo esgotado
   ao gerar o áudio" para STT também. Separar por escopo (`tts` vs `stt`) e usar
   pt-BR correto: "Tempo esgotado ao avaliar sua fala. Tente novamente."
4. **Gemini TTS indisponível na prática.** O fallback TikTok está funcionando,
   mas o app não informa o cooldown. Expor no `/status` (sem detalhes sensíveis)
   algo como `geminiTtsCooldownUntil` para a Central de Voz mostrar "Gemini em
   pausa até HH:MM" em vez de o usuário achar que a voz neural está ativa.
5. **CSP está em `Content-Security-Policy-Report-Only`** (`vercel.json:29`), ou
   seja, não bloqueia nada. Não é API, mas é uma lacuna de segurança: promover
   para `Content-Security-Policy` depois de validar os relatórios.
6. **Diagnóstico reproduzível:** criar `scripts/check-apis.mjs` (Node 22,
   `fetch`) com os checks acima, opt-in via `--with-tts` para não gastar cota,
   e um clipe WAV pequeno embutido para o STT. Rodar manualmente e no deploy da
   VPS (sem bloquear) para detectar regressões.

## Plano de correção (item 10)

1. `server.ts`: separar budgets `TTS_DEADLINE_MS` (13 s) e `STT_DEADLINE_MS`
   (12 s), mensagens de erro por escopo, e resposta 502/504 quando `transcript`
   vier vazio.
2. Medir o modelo do coach com um log temporário de duração/modelo; escolher
   entre aumentar budget + baixar custo do prompt ou trocar de modelo.
3. `audioAndTranslationService.ts`: timeout do STT para 13 s; ao falhar, um
   toast único em pt-BR ("Não foi possível avaliar com IA agora; usando a
   avaliação local.") em vez de silêncio.
4. `/api/voice-hub/status`: expor cooldowns (Gemini TTS) e último estado do STT
   de forma grosseira (ok/erro/hora), sem chaves nem prompts.
5. `scripts/check-apis.mjs` + documentação curta no `DEPLOY.md`.
6. Validar com uma gravação real de 2–3 s no app: transcrição não vazia, coach
   JSON em < 10 s, e falha forçada mostrando mensagem clara.

## Resultado da correção (executado)

| Ponto | O que mudou | Medição real (áudio TTS limpo, "Good morning, how are you today?") |
|---|---|---|
| Budget STT | `STT_DEADLINE_MS` 7 s → **12 s** (TTS segue 13 s) | coach agora responde em ~4,9 s |
| Mensagens | `ROUTE_ERROR_MESSAGES` por escopo (`tts`/`stt`) | timeout do STT devolve "Tempo esgotado ao avaliar sua fala." |
| Transcrição vazia | 502 com `Retry-After`, log sem PII, `noteSttOutcome('empty')` | antes: 200 com `transcript: ""`; agora: 200 com o texto correto |
| **Causa raiz do transcript vazio** | o `gemini-3.5-transcribe` devolve o texto num part **não-texto** `audioTranscription`, não em `response.text`. Adicionado `extractTranscriptionText()` | transcrição: **200 em 2,5–5,9 s** com o texto exato |
| Modelo do coach | `gemini-4-hydrogen` (>25 s) → **`gemini-3.8-flash`** (`STT_COACH_MODEL`), com `gemini-3.8-flash` também como reserva da transcrição | coach: **200 em 4,9 s** com scores + dica em pt-BR (benchmark: 3.5-flash 13,8 s, 3.5-flash-lite 9,7 s, hydrogen >25 s) |
| Cliente | timeout 7,5 s → **13 s**; `onFailure` reporta `timeout`/`empty_transcript`/`http_error`/`network`; toast único em pt-BR (máx. 1/60 s) | — |
| `/status` | `cooldowns` (`geminiTtsUntil`, `geminiBreakerUntil`, por modelo, `serverNow`) + `stt.lastOutcome/lastOutcomeAt/lastProvider` | badge "⏸️ TTS do Gemini em pausa até HH:MM" na aba Voz & IA |
| Diagnóstico | `scripts/check-apis.mjs` (PASS/WARN/FAIL, `--with-tts`, `--stt-file`) + seção no `DEPLOY.md` | 8 checks gratuitos passando no local |

Pendências conscientes:

- A CSP segue em `Content-Security-Policy-Report-Only` (`vercel.json`): promover
  para bloqueio exige revisar os relatórios reais de produção; não foi feito às
  cegas para não quebrar PDF.js/Firebase/áudio.
- Validação com gravação humana de 2–3 s (item 6 do plano) fica para o teste
  manual no app; o caminho servidor↔Gemini já foi validado ponta a ponta.
- `/__/firebase/init.json` continua 404 na Vercel (rewrite morto, inofensivo: o
  app passa o config explicitamente).

## Aceite

- Uma fala real de 2–3 s retorna transcrição não vazia e coach com scores.
- STT que falha devolve erro claro em pt-BR e o app avisa (não finge sucesso).
- TTS continua com fallback e o status informa o cooldown do Gemini.
- `scripts/check-apis.mjs` roda e imprime PASS/FAIL por serviço.

---

# 11. Script para subir o servidor local (`.bat`)

> Pedido durante a execução; não estava no `notas.md` original.

## Objetivo

Duplo-clique no Windows para subir o servidor local sem decorar comandos.

## O que o script faz (`iniciar-servidor.bat`, raiz do repo)

- Confere se o Node existe e é **≥ 22** (o `npm start` depende de type stripping
  nativo); se não for, explica como resolver em vez de falhar em silêncio.
- Roda `npm install` **só** se `node_modules` estiver ausente.
- Avisa quando `.env` não existe (o servidor sobe sem `GEMINI_API_KEY`, TTS/STT
  ficam desativados) e quando a porta 3000 já está ocupada.
- Abre `http://localhost:3000` no navegador após 4 s, em segundo plano.
- Roda `npm run dev` (Express + Vite middleware) em primeiro plano, mostra o
  código de saída e termina com `pause`.
- Arquivo em CRLF (obrigatório para `cmd.exe` interpretar bem labels/`goto`) e
  com `chcp 65001` para os acentos aparecerem certos.

## Aceite

- Duplo clique abre o app em `http://localhost:3000`.
- Sem Node 22+ ou sem `node_modules`, o script explica o que fazer.
- Testado com `npm` simulado: checagem de versão, instalação condicional, avisos
  de `.env`/porta e propagação do código de saída.

---

# Fases de execução

## Fase A — UI e padrões (itens 4, 5, 6, 7)

Baixo risco, sem tocar no motor.
1. Item 4 (cards da Biblioteca).
2. Itens 5 e 6 (modais fixos).
3. Item 7 (defaults + teste de `voiceCompatibility` + decisão 0.7/en_slow).
4. `npm run lint && npm test && npm run build`.

## Fase B — Fluxo e progresso (itens 1 e 2)

1. Item 1 (helper + remoção do auto-avanço + CTA de próxima parte).
2. Item 2 (helper de progresso + 5 pontos de cálculo + Biblioteca + topo).
3. Testes novos; validar manualmente: Modo Livre não avança; treino continua;
   progresso só sobe após falar.
4. Gate completo.

## Fase C — Design (itens 8 e 9)

1. Item 9 primeiro (estrutura das abas + dedupe), pois o item 8 usa a barra de
   sessão e o modal novo.
2. Item 8 em sub-etapas (chrome → duas colunas → hierarquia → polimento).
3. Revisão visual em 6 temas e 3 resoluções; gate completo.

## Fase D — APIs (item 10)

Independente; pode rodar em paralelo. Mexe em `server.ts`, então o build Docker
(`tsc --noEmit` + testes) é o gate real. Validar em produção após o deploy
automático da VPS.

---

# Decisões aprovadas (2026-11-17)

Plano fechado. Nada acima está em aberto; qualquer desvio daqui exige nova
confirmação.

| # | Decisão | Escolha |
|---|---|---|
| 1 | Item 1 — alcance do congelamento | **Congelar sentença e sub-parte.** Concluir uma parte mostra o CTA "Próxima parte →"; concluir a frase mantém a sentença. Só o treino avança sozinho. |
| 2 | Item 2 — métrica de frase dominada | **Fala final da frase inteira aprovada** (`sentenceProgress[idx].completed`). Sem schema novo, sem migração. |
| 3 | Item 7 — conflito 0.7 × etapa lenta | **Normal 0.7x e etapa lenta 0.6x**, renomeando os rótulos para "Ouvir EN 0.6x". |
| 4 | Item 7 — alcance dos padrões | **Só instalações novas e "Restaurar Padrões".** Usuários existentes mantêm os valores salvos; nenhuma migração forçada. |
| 5 | Item 8 — layout desktop | **Revisado em 2026-11-17 durante a revisão visual: cards empilhados de cima para baixo** (era "duas colunas" na aprovação inicial). Centralização horizontal mantida; dock de ações continua fixo no rodapé; mobile inalterado. |
| 6 | Item 9 — abas de Configurações | **Presets / Etapas / Voz & IA / Texto & Tema**, com remoção do bloco duplicado do "Falar Sem Inglês". |

## Consequências diretas no plano

- **Item 1:** os quatro pontos de auto-avanço de `evaluateTargetOrStep`
  (`:3096-3168`, `:3174-3265`, `:3273-3302`, `:3304-3322`) e o de
  `handleOpenChallengeManual` (`:3587-3593`) passam a rodar apenas com
  `isPlayingLoop === true`. O CTA "Próxima parte →" é obrigatório na Fase B,
  não opcional.
- **Item 2:** `completed` já existe em `SentenceProgress`; `bookProgress.ts` é a
  única fonte de `progressPercent`. `sanitizeBook` e `mergeDriveSnapshots`
  recalculam a partir do mesmo helper.
- **Item 7:** tabela de defaults fica `ttsSpeedEn: 0.7`, `ttsSpeedPt: 1.35`,
  `enableBlindSpeakingStage: true`, `cardSequence` com `speak_blind_en`,
  `blindMaxErrorsBeforeReveal: 4`, `blindSpeakingOnFullSentence: false`. O card
  `en_slow` passa a tocar em `0.6` e `STEP_CARD_META.en_slow.shortLabel` vira
  "Ouvir EN 0.6x" (mesma troca no presets `en_first` e no slider de Settings).
  `voiceCompatibility.test.ts:145` espera `effectiveNormalEnRate = 0.72`
  (piso técnico, pois 0.7 × 0.98 < 0.72).
- **Item 8:** a coluna direita hospeda `#speechFeedbackContainer` + dock; o
  footer fixo passa a ser `lg:hidden`. Nenhum handler duplicado.
- **Item 9:** a aba "Modelos" é renomeada para "Presets" e "Texto, Tema & Regras"
  para "Texto & Tema"; o bloco de blind sai da aba de texto/tema e fica só em
  Etapas.

## Ordem de execução confirmada

`A (4,5,6,7)` → `B (1,2)` → `C (9 depois 8)` → `D (10)`, com gate
`lint + test + build` ao fim de cada fase.

---

# Definition of Done global

```bash
npm run lint
npm test
npm run build
```

- Nenhuma string nova de UI fora de pt-BR.
- Nenhum `localStorage`/IndexedDB dentro de updater de `setState`.
- Nenhum `id`/handler removido sem substituto.
- Mobile continua funcionando (testar 390×844).
- `todo.md`/`notas.md` atualizados ao fim de cada fase.

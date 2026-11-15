import { Book, WordEntry } from '../types/shadowreader';
import { EXTENDED_DICT_DB } from './extendedLexicon';

export const DICT_DB: Record<string, WordEntry> = {
  ...EXTENDED_DICT_DB,
  // Core pronouns, auxiliaries, common verbs & descriptors
  he: { pt: 'ele', pos: 'Pronome pessoal', ipa: '/hiː/', def: 'Pessoa do sexo masculino mencionada anteriormente.' },
  she: { pt: 'ela', pos: 'Pronome pessoal', ipa: '/ʃiː/', def: 'Pessoa do sexo feminino mencionada anteriormente.' },
  we: { pt: 'nós', pos: 'Pronome pessoal', ipa: '/wiː/', def: 'Primeira pessoa do plural; eu e outros.' },
  you: { pt: 'você / tu / vocês', pos: 'Pronome', ipa: '/juː/', def: 'A pessoa com quem se fala diretamente.' },
  his: { pt: 'dele / seu', pos: 'Pronome possessivo', ipa: '/hɪz/', def: 'Pertencente a ele.' },
  him: { pt: 'o / lhe / a ele', pos: 'Pronome oblíquo', ipa: '/hɪm/', def: 'Forma oblíqua de ele.' },
  their: { pt: 'deles / delas / seu', pos: 'Pronome possessivo', ipa: '/ðɛər/', def: 'Pertencente a eles ou a elas.' },
  my: { pt: 'meu / minha', pos: 'Pronome possessivo', ipa: '/maɪ/', def: 'Pertencente à primeira pessoa.' },
  your: { pt: 'seu / sua / teu', pos: 'Pronome possessivo', ipa: '/jɔːr/', def: 'Pertencente à pessoa com quem se fala.' },
  our: { pt: 'nosso / nossa', pos: 'Pronome possessivo', ipa: '/ˈaʊ.ər/', def: 'Pertencente a nós.' },
  its: { pt: 'dele / dela (coisa)', pos: 'Pronome possessivo', ipa: '/ɪts/', def: 'Pertencente a um animal, objeto ou entidade neutra.' },
  is: { pt: 'é / está', pos: 'Verbo', ipa: '/ɪz/', def: 'Forma presente do verbo to be para 3ª pessoa.' },
  were: { pt: 'eram / estavam / fomos', pos: 'Verbo (passado)', ipa: '/wɜːr/', def: 'Forma do passado plural ou segunda pessoa do verbo to be.' },
  been: { pt: 'sido / estado', pos: 'Particípio', ipa: '/biːn/', def: 'Particípio passado do verbo to be.' },
  have: { pt: 'ter / haver', pos: 'Verbo', ipa: '/hæv/', def: 'Possuir, conter ou experimentar.' },
  had: { pt: 'tinha / teve / havia', pos: 'Verbo (passado)', ipa: '/hæd/', def: 'Passado do verbo to have.' },
  has: { pt: 'tem / possui', pos: 'Verbo', ipa: '/hæz/', def: 'Terceira pessoa do singular do verbo to have.' },
  can: { pt: 'pode / consegue', pos: 'Verbo modal', ipa: '/kæn/', def: 'Expressa capacidade, habilidade ou permissão.' },
  could: { pt: 'podia / poderia', pos: 'Verbo modal', ipa: '/kʊd/', def: 'Passado ou condicional de can.' },
  will: { pt: 'vai / haverá (futuro)', pos: 'Verbo auxiliar', ipa: '/wɪl/', def: 'Indica tempo futuro ou determinação.' },
  would: { pt: 'faria / iria', pos: 'Verbo auxiliar', ipa: '/wʊd/', def: 'Indica condicional ou hábito no passado.' },
  must: { pt: 'deve / tem que', pos: 'Verbo modal', ipa: '/mʌst/', def: 'Indica obrigação estrita ou forte dedução lógica.' },
  shall: { pt: 'deverei / vou (futuro)', pos: 'Verbo modal', ipa: '/ʃæl/', def: 'Expressa intenção futura ou determinação formal.' },
  go: { pt: 'ir', pos: 'Verbo', ipa: '/ɡoʊ/', def: 'Deslocar-se de um ponto para outro.' },
  went: { pt: 'foi / foram', pos: 'Verbo (passado)', ipa: '/wɛnt/', def: 'Passado irregular do verbo to go.' },
  come: { pt: 'vir / chegar', pos: 'Verbo', ipa: '/kʌm/', def: 'Mover-se em direção a quem fala.' },
  came: { pt: 'veio / chegaram', pos: 'Verbo (passado)', ipa: '/keɪm/', def: 'Passado do verbo to come.' },
  see: { pt: 'ver / enxergar', pos: 'Verbo', ipa: '/siː/', def: 'Perceber com a visão.' },
  know: { pt: 'saber / conhecer', pos: 'Verbo', ipa: '/noʊ/', def: 'Ter conhecimento ou familiaridade com algo.' },
  knew: { pt: 'sabia / conhecia', pos: 'Verbo (passado)', ipa: '/njuː/', def: 'Passado do verbo to know.' },
  take: { pt: 'pegar / levar / tomar', pos: 'Verbo', ipa: '/teɪk/', def: 'Segurar com as mãos ou conduzir algo.' },
  took: { pt: 'pegou / levou', pos: 'Verbo (passado)', ipa: '/tʊk/', def: 'Passado do verbo to take.' },
  give: { pt: 'dar / doar', pos: 'Verbo', ipa: '/ɡɪv/', def: 'Conceder algo a outrem sem contrapartida.' },
  gave: { pt: 'deu / entregou', pos: 'Verbo (passado)', ipa: '/ɡeɪv/', def: 'Passado do verbo to give.' },
  make: { pt: 'fazer / criar', pos: 'Verbo', ipa: '/meɪk/', def: 'Produzir ou fabricar algo.' },
  made: { pt: 'fez / feito', pos: 'Verbo (passado)', ipa: '/meɪd/', def: 'Passado do verbo to make.' },
  tell: { pt: 'contar / dizer a', pos: 'Verbo', ipa: '/tɛl/', def: 'Narrar ou informar algo a alguém.' },
  told: { pt: 'contou / disse', pos: 'Verbo (passado)', ipa: '/toʊld/', def: 'Passado do verbo to tell.' },
  feel: { pt: 'sentir', pos: 'Verbo', ipa: '/fiːl/', def: 'Experimentar uma sensação física ou emoção.' },
  felt: { pt: 'sentiu / sentido', pos: 'Verbo (passado)', ipa: '/fɛlt/', def: 'Passado do verbo to feel.' },
  find: { pt: 'encontrar / achar', pos: 'Verbo', ipa: '/faɪnd/', def: 'Localizar algo que se buscava ou desconhecia.' },
  found: { pt: 'encontrou / achou', pos: 'Verbo (passado)', ipa: '/faʊnd/', def: 'Passado do verbo to find.' },
  think: { pt: 'pensar / achar', pos: 'Verbo', ipa: '/θɪŋk/', def: 'Exercer o raciocínio ou ter uma opinião.' },
  leave: { pt: 'partir / deixar', pos: 'Verbo', ipa: '/liːv/', def: 'Sair de um local ou abandonar algo.' },
  left: { pt: 'partiu / deixou / esquerda', pos: 'Verbo / Adjetivo', ipa: '/lɛft/', def: 'Passado de leave; lado oposto ao direito.' },
  time: { pt: 'tempo / hora / vez', pos: 'Substantivo', ipa: '/taɪm/', def: 'Duração contínua dos acontecimentos.' },
  day: { pt: 'dia', pos: 'Substantivo', ipa: '/deɪ/', def: 'Período de vinte e quatro horas ou de luz solar.' },
  people: { pt: 'pessoas / povo', pos: 'Substantivo (pl.)', ipa: '/ˈpiː.pəl/', def: 'Conjunto de seres humanos.' },
  way: { pt: 'caminho / jeito / forma', pos: 'Substantivo', ipa: '/weɪ/', def: 'Trajeto ou modo de agir.' },
  world: { pt: 'mundo / planeta', pos: 'Substantivo', ipa: '/wɜːrld/', def: 'A Terra com todos os seus habitantes.' },
  life: { pt: 'vida', pos: 'Substantivo', ipa: '/laɪf/', def: 'Existência dos seres vivos.' },
  man: { pt: 'homem', pos: 'Substantivo', ipa: '/mæn/', def: 'Ser humano adulto do sexo masculino.' },
  woman: { pt: 'mulher', pos: 'Substantivo', ipa: '/ˈwʊm.ən/', def: 'Ser humano adulto do sexo feminino.' },
  child: { pt: 'criança / filho', pos: 'Substantivo', ipa: '/tʃaɪld/', def: 'Ser humano em fase de infância.' },
  children: { pt: 'crianças / filhos', pos: 'Substantivo (pl.)', ipa: '/ˈtʃɪl.drən/', def: 'Plural de child.' },
  good: { pt: 'bom / boa', pos: 'Adjetivo', ipa: '/ɡʊd/', def: 'De qualidade superior ou moralmente correto.' },
  new: { pt: 'novo / nova', pos: 'Adjetivo', ipa: '/njuː/', def: 'Que existe há pouco tempo.' },
  great: { pt: 'ótimo / grande / excelente', pos: 'Adjetivo', ipa: '/ɡreɪt/', def: 'De proporção notável ou eminência.' },
  small: { pt: 'pequeno / pequena', pos: 'Adjetivo', ipa: '/smɔːl/', def: 'De dimensão reduzida.' },
  little: { pt: 'pequeno / pouco', pos: 'Adjetivo', ipa: '/ˈlɪt.əl/', def: 'De tamanho menor ou quantidade restrita.' },
  much: { pt: 'muito / muita', pos: 'Advérbio / Det.', ipa: '/mʌtʃ/', def: 'Grande quantidade de substantivo incontável.' },
  many: { pt: 'muitos / muitas', pos: 'Determinante (pl.)', ipa: '/ˈmɛn.i/', def: 'Grande número de itens contáveis.' },
  more: { pt: 'mais', pos: 'Advérbio', ipa: '/mɔːr/', def: 'Em quantidade ou grau superior.' },
  all: { pt: 'todo / toda / todos', pos: 'Pronome', ipa: '/ɔːl/', def: 'A totalidade sem exceção.' },
  some: { pt: 'algum / alguns / um pouco', pos: 'Pronome', ipa: '/sʌm/', def: 'Quantidade indeterminada.' },
  other: { pt: 'outro / outra', pos: 'Pronome', ipa: '/ˈʌð.ər/', def: 'Diferente deste ou daquele.' },
  only: { pt: 'apenas / só / único', pos: 'Advérbio / Adj.', ipa: '/ˈoʊn.li/', def: 'Sem outro igual; exclusivamente.' },
  even: { pt: 'mesmo / até / par', pos: 'Advérbio', ipa: '/ˈiː.vən/', def: 'Incluindo até casos extremos.' },
  now: { pt: 'agora / já', pos: 'Advérbio', ipa: '/naʊ/', def: 'No momento presente.' },
  never: { pt: 'nunca / jamais', pos: 'Advérbio', ipa: '/ˈnɛv.ər/', def: 'Em tempo algum.' },
  always: { pt: 'sempre', pos: 'Advérbio', ipa: '/ˈɔːl.weɪz/', def: 'Em todas as ocasiões.' },
  here: { pt: 'aqui / cá', pos: 'Advérbio', ipa: '/hɪər/', def: 'Neste lugar onde quem fala se encontra.' },
  there: { pt: 'lá / ali / havia', pos: 'Advérbio', ipa: '/ðɛər/', def: 'Em local distante de quem fala.' },
  where: { pt: 'onde', pos: 'Advérbio', ipa: '/wɛər/', def: 'Em que lugar.' },
  how: { pt: 'como / quanto', pos: 'Advérbio', ipa: '/haʊ/', def: 'De que maneira ou modo.' },
  what: { pt: 'o que / que / qual', pos: 'Pronome interrogativo', ipa: '/wɒt/', def: 'Pergunta sobre coisas ou fatos.' },
  who: { pt: 'quem', pos: 'Pronome interrogativo', ipa: '/huː/', def: 'Pergunta sobre identidade de pessoa.' },
  which: { pt: 'qual / que', pos: 'Pronome relativo', ipa: '/wɪtʃ/', def: 'Especifica um item entre alternativas.' },
  so: { pt: 'tão / então / assim', pos: 'Advérbio / Conj.', ipa: '/soʊ/', def: 'Dessa forma ou com tal intensidade.' },
  up: { pt: 'para cima / acima', pos: 'Preposição / Adv.', ipa: '/ʌp/', def: 'Em direção ao alto.' },
  down: { pt: 'para baixo / abaixo', pos: 'Preposição / Adv.', ipa: '/daʊn/', def: 'Em direção ao solo ou plano inferior.' },
  out: { pt: 'fora / para fora', pos: 'Advérbio', ipa: '/aʊt/', def: 'No exterior ou distante do centro.' },
  about: { pt: 'sobre / cerca de', pos: 'Preposição', ipa: '/əˈbaʊt/', def: 'A respeito de algo ou aproximadamente.' },
  into: { pt: 'para dentro de', pos: 'Preposição', ipa: '/ˈɪn.tuː/', def: 'Movimento em direção ao interior.' },
  back: { pt: 'de volta / costas', pos: 'Advérbio / Subst.', ipa: '/bæk/', def: 'Ao ponto de origem ou parte posterior.' },
  from: { pt: 'de / a partir de', pos: 'Preposição', ipa: '/frɒm/', def: 'Ponto de partida no espaço ou tempo.' },
  at: { pt: 'em / às', pos: 'Preposição', ipa: '/æt/', def: 'Indica localização pontual no tempo ou espaço.' },
  on: { pt: 'sobre / em / ligado', pos: 'Preposição', ipa: '/ɒn/', def: 'Apoiado sobre uma superfície.' },
  as: { pt: 'como / enquanto / já que', pos: 'Conjunção / Adv.', ipa: '/æz/', def: 'Indica comparação, tempo ou causa.' },
  if: { pt: 'se', pos: 'Conjunção condicional', ipa: '/ɪf/', def: 'Expressa uma condição necessária.' },
  because: { pt: 'porque / já que', pos: 'Conjunção causal', ipa: '/bɪˈkɒz/', def: 'Expressa a razão ou motivo.' },
  prince: { pt: 'príncipe', pos: 'Substantivo', ipa: '/prɪns/', def: 'Filho de rei ou monarca soberano.' },
  drawing: { pt: 'desenho', pos: 'Substantivo', ipa: '/ˈdrɔː.ɪŋ/', def: 'Arte de traçar formas e contornos.' },
  swallow: { pt: 'engolir / andorinha', pos: 'Verbo / Subst.', ipa: '/ˈswɒl.oʊ/', def: 'Fazer passar alimento pela garganta.' },

  // Common grammatical & structural words
  once: { pt: 'certa vez / uma vez', pos: 'Advérbio', ipa: '/wʌns/', def: 'Em alguma ocasião no passado; uma única vez.' },
  when: { pt: 'quando', pos: 'Conjunção', ipa: '/wɛn/', def: 'No momento ou na ocasião em que algo ocorre.' },
  i: { pt: 'eu', pos: 'Pronome', ipa: '/aɪ/', def: 'Pronome pessoal da primeira pessoa do singular.' },
  was: { pt: 'era / estava / tinha', pos: 'Verbo (passado)', ipa: '/wʌz/', def: 'Forma do passado do verbo to be (ser/estar/idade).' },
  six: { pt: 'seis', pos: 'Numeral', ipa: '/sɪks/', def: 'Número correspondente a 6.' },
  years: { pt: 'anos', pos: 'Substantivo (pl.)', ipa: '/jɪərz/', def: 'Períodos de 365 dias que medem a idade ou o tempo.' },
  old: { pt: 'de idade / velho', pos: 'Adjetivo', ipa: '/oʊld/', def: 'Com certa quantidade de anos; idoso ou com certa maturidade.' },
  saw: { pt: 'vi / enxerguei', pos: 'Verbo (passado)', ipa: '/sɔː/', def: 'Passado do verbo to see (perceber com a visão).' },
  a: { pt: 'um / uma', pos: 'Artigo indefinido', ipa: '/ə/', def: 'Usado antes de substantivos contáveis no singular.' },
  magnificent: { pt: 'magnífica / esplêndida', pos: 'Adjetivo', ipa: '/mæɡˈnɪfɪsnt/', def: 'De beleza, grandeza ou qualidade excepcional.' },
  picture: { pt: 'imagem / figura / foto', pos: 'Substantivo', ipa: '/ˈpɪktʃər/', def: 'Representação visual de algo em papel ou tela.' },
  pictures: { pt: 'gravuras / imagens', pos: 'Substantivo (pl.)', ipa: '/ˈpɪktʃərz/', def: 'Plural de picture; ilustrações ou desenhos.' },
  in: { pt: 'em / dentro de', pos: 'Preposição', ipa: '/ɪn/', def: 'Indica posição, inclusão ou localização no interior de algo.' },
  book: { pt: 'livro', pos: 'Substantivo', ipa: '/bʊk/', def: 'Obra impressa ou digital composta por várias páginas.' },
  it: { pt: 'ele / ela / isso', pos: 'Pronome neutro', ipa: '/ɪt/', def: 'Refere-se a um animal, objeto ou situação neutra.' },
  of: { pt: 'de / do / da', pos: 'Preposição', ipa: '/ʌv/', def: 'Expressa relação de pertencimento, matéria ou autoria.' },
  boa: { pt: 'jiboia / serpente boa', pos: 'Substantivo', ipa: '/ˈboʊ.ə/', def: 'Grande serpente não peçonhenta que subjuga por constrição.' },
  constrictor: { pt: 'constritora', pos: 'Adjetivo / Subst.', ipa: '/kənˈstrɪktər/', def: 'Que aperta ou comprime para sufocar.' },
  constrictors: { pt: 'jiboias / constritoras', pos: 'Substantivo (pl.)', ipa: '/kənˈstrɪktərz/', def: 'Plural de constrictor.' },
  the: { pt: 'o / a / os / as', pos: 'Artigo definido', ipa: '/ðiː / ðə/', def: 'Refere-se a algo específico ou já mencionado.' },
  act: { pt: 'ato / ação', pos: 'Substantivo', ipa: '/ækt/', def: 'Ação ou processo de fazer algo.' },
  swallowing: { pt: 'engolindo', pos: 'Verbo (gerúndio)', ipa: '/ˈswɒl.oʊ.ɪŋ/', def: 'Fazer passar da boca para o estômago sem mastigar.' },
  an: { pt: 'um / uma', pos: 'Artigo indefinido', ipa: '/æn/', def: 'Forma usada antes de palavras iniciadas por som de vogal.' },
  animal: { pt: 'animal / bicho', pos: 'Substantivo', ipa: '/ˈæn.ɪ.məl/', def: 'Ser vivo dotado de sensibilidade e movimento.' },
  said: { pt: 'dizia / disse', pos: 'Verbo (passado)', ipa: '/sɛd/', def: 'Passado do verbo to say (dizer ou afirmar).' },
  say: { pt: 'dizer / falar', pos: 'Verbo', ipa: '/seɪ/', def: 'Expressar em palavras.' },
  prey: { pt: 'presa / caça', pos: 'Substantivo', ipa: '/preɪ/', def: 'Animal caçado e devorado por outro.' },
  whole: { pt: 'inteira / todo', pos: 'Adjetivo / Adv.', ipa: '/hoʊl/', def: 'Completa; sem partes faltando.' },
  without: { pt: 'sem', pos: 'Preposição', ipa: '/wɪˈðaʊt/', def: 'Na ausência de; privado de algo.' },
  chewing: { pt: 'mastigar / mastigando', pos: 'Verbo (gerúndio)', ipa: '/ˈtʃuː.ɪŋ/', def: 'Triturar os alimentos com os dentes.' },
  after: { pt: 'depois de / após', pos: 'Preposição', ipa: '/ˈæf.tər/', def: 'Em momento posterior no tempo.' },
  that: { pt: 'isso / aquilo / que', pos: 'Pronome', ipa: '/ðæt/', def: 'Refere-se a algo distante ou a um fato acabado de citar.' },
  they: { pt: 'elas / eles', pos: 'Pronome plural', ipa: '/ðeɪ/', def: 'Pronome da terceira pessoa do plural.' },
  are: { pt: 'são / estão', pos: 'Verbo', ipa: '/ɑːr/', def: 'Forma presente plural do verbo to be.' },
  not: { pt: 'não', pos: 'Advérbio de negação', ipa: '/nɒt/', def: 'Indica recusa ou negação.' },
  able: { pt: 'capazes / aptas', pos: 'Adjetivo', ipa: '/ˈeɪ.bəl/', def: 'Que tem poder, habilidade ou oportunidade de fazer algo.' },
  to: { pt: 'para / a', pos: 'Preposição / Partícula', ipa: '/tuː/', def: 'Partícula que forma o infinitivo ou indica direção.' },
  move: { pt: 'mover-se / mexer', pos: 'Verbo', ipa: '/muːv/', def: 'Mudar de lugar ou posição.' },
  and: { pt: 'e', pos: 'Conjunção', ipa: '/ænd/', def: 'Liga palavras ou orações semelhantes.' },
  sleep: { pt: 'dormem / sono', pos: 'Verbo', ipa: '/sliːp/', def: 'Entrar em estado de repouso natural periódico.' },
  through: { pt: 'durante / através de', pos: 'Preposição', ipa: '/θruː/', def: 'Do início ao fim de um intervalo de tempo.' },
  months: { pt: 'meses', pos: 'Substantivo (pl.)', ipa: '/mʌnθs/', def: 'Unidades de tempo de aproximadamente trinta dias.' },
  need: { pt: 'precisam / necessitam', pos: 'Verbo', ipa: '/niːd/', def: 'Ter necessidade imperiosa de algo.' },
  for: { pt: 'para / por', pos: 'Preposição', ipa: '/fɔːr/', def: 'Indica finalidade ou propósito.' },
  digestion: { pt: 'digestão', pos: 'Substantivo', ipa: '/daɪˈdʒɛs.tʃən/', def: 'Processo orgânico de transformação dos alimentos.' },
  pondered: { pt: 'refleti / ponderei', pos: 'Verbo (passado)', ipa: '/ˈpɒn.dərd/', def: 'Pensar profundamente sobre algo.' },
  deeply: { pt: 'profundamente', pos: 'Advérbio', ipa: '/ˈdiːp.li/', def: 'Com intensidade, seriedade ou detalhe íntimo.' },
  then: { pt: 'então / naquela época', pos: 'Advérbio', ipa: '/ðɛn/', def: 'Naquele momento em consequência do anterior.' },
  over: { pt: 'sobre / a respeito de', pos: 'Preposição', ipa: '/ˈoʊ.vər/', def: 'Acerca de um tema ou assunto.' },
  adventures: { pt: 'aventuras', pos: 'Substantivo (pl.)', ipa: '/ədˈvɛn.tʃərz/', def: 'Experiências emocionantes e arriscadas.' },
  jungle: { pt: 'selva / floresta tropical', pos: 'Substantivo', ipa: '/ˈdʒʌŋ.ɡəl/', def: 'Mata densa em regiões tropicais.' },
  work: { pt: 'trabalho / esforço', pos: 'Substantivo', ipa: '/wɜːrk/', def: 'Atividade física ou intelectual para produzir algo.' },
  with: { pt: 'com', pos: 'Preposição', ipa: '/wɪð/', def: 'Indica companhia, instrumento ou meio.' },
  colored: { pt: 'colorido / de cor', pos: 'Adjetivo', ipa: '/ˈkʌl.ərd/', def: 'Que possui cores distintas de preto e branco.' },
  pencil: { pt: 'lápis', pos: 'Substantivo', ipa: '/ˈpɛn.səl/', def: 'Instrumento para escrever ou desenhar.' },
  succeeded: { pt: 'consegui / tive êxito', pos: 'Verbo (passado)', ipa: '/səkˈsiː.dɪd/', def: 'Alcançar o resultado desejado após esforço.' },
  making: { pt: 'fazer / criando', pos: 'Verbo (gerúndio)', ipa: '/ˈmeɪ.kɪŋ/', def: 'Construir, produzir ou desenhar.' },
  first: { pt: 'primeiro', pos: 'Numeral ordinal', ipa: '/fɜːrst/', def: 'Que precede todos os outros em tempo ou ordem.' },
  number: { pt: 'número', pos: 'Substantivo', ipa: '/ˈnʌm.bər/', def: 'Símbolo matemático que expressa quantidade ou ordem.' },
  one: { pt: 'um / alguém', pos: 'Numeral / Pronome', ipa: '/wʌn/', def: 'A primeira unidade dos números ou uma pessoa.' },
  looked: { pt: 'parecia / olhou', pos: 'Verbo (passado)', ipa: '/lʊkt/', def: 'Apresentar determinado aspecto visual.' },
  something: { pt: 'algo / alguma coisa', pos: 'Pronome indefinido', ipa: '/ˈsʌm.θɪŋ/', def: 'Coisa não determinada ou específica.' },
  like: { pt: 'como / parecido com', pos: 'Preposição', ipa: '/laɪk/', def: 'Que tem semelhança ou afinidade.' },
  this: { pt: 'isto / isso', pos: 'Pronome demonstrativo', ipa: '/ðɪs/', def: 'Designa o que está próximo de quem fala.' },
  showed: { pt: 'mostrei / exibi', pos: 'Verbo (passado)', ipa: '/ʃoʊd/', def: 'Apresentar à vista de alguém.' },
  masterpiece: { pt: 'obra-prima', pos: 'Substantivo', ipa: '/ˈmæs.tər.piːs/', def: 'Trabalho de arte ou engenho considerado exemplar.' },
  grownups: { pt: 'adultos / gente grande', pos: 'Substantivo (pl.)', ipa: '/ˈɡroʊn.ʌps/', def: 'Pessoas maduras que deixaram a infância.' },
  asked: { pt: 'perguntei / pedi', pos: 'Verbo (passado)', ipa: '/æskt/', def: 'Fazer uma indagação a alguém.' },
  them: { pt: 'lhes / a eles', pos: 'Pronome oblíquo', ipa: '/ðɛm/', def: 'Forma oblíqua de eles ou elas.' },
  whether: { pt: 'se', pos: 'Conjunção', ipa: '/ˈwɛð.ər/', def: 'Introduz uma alternativa ou dúvida.' },
  frightened: { pt: 'assustava / assustado', pos: 'Verbo / Adjetivo', ipa: '/ˈfraɪ.tənd/', def: 'Causar susto, temor ou pavor.' },
  frighten: { pt: 'assustar / dar medo', pos: 'Verbo', ipa: '/ˈfraɪ.tən/', def: 'Causar medo ou susto.' },
  be: { pt: 'ser / estar / ficar', pos: 'Verbo', ipa: '/biː/', def: 'Existir ou encontrar-se em determinado estado.' },
  but: { pt: 'mas / porém', pos: 'Conjunção adversativa', ipa: '/bʌt/', def: 'Indica oposição ou contraste.' },
  answered: { pt: 'responderam', pos: 'Verbo (passado)', ipa: '/ˈæn.sərd/', def: 'Dar resposta a uma pergunta feita.' },
  why: { pt: 'por que', pos: 'Advérbio interrogativo', ipa: '/waɪ/', def: 'Qual a razão ou o motivo de algo.' },
  should: { pt: 'deveria', pos: 'Verbo modal', ipa: '/ʃʊd/', def: 'Expressa probabilidade, conselho ou conveniência.' },
  any: { pt: 'qualquer / algum', pos: 'Pronome', ipa: '/ˈɛn.i/', def: 'Refere-se a pessoa ou coisa indeterminada.' },
  hat: { pt: 'chapéu', pos: 'Substantivo', ipa: '/hæt/', def: 'Acessório de vestuário para cobrir a cabeça.' },
  elephant: { pt: 'elefante', pos: 'Substantivo', ipa: '/ˈɛl.ɪ.fənt/', def: 'Grande mamífero quadrúpede provido de tromba.' },
  digest: { pt: 'digerir', pos: 'Verbo', ipa: '/daɪˈdʒɛst/', def: 'Transformar alimentos no trato gastrointestinal.' },
  digesting: { pt: 'digerindo', pos: 'Verbo (gerúndio)', ipa: '/daɪˈdʒɛs.tɪŋ/', def: 'Em processo contínuo de digestão.' },
  alice: { pt: 'Alice', pos: 'Nome próprio', ipa: '/ˈæl.ɪs/', def: 'Nome próprio feminino da protagonista.' },
  beginning: { pt: 'começando', pos: 'Verbo (gerúndio)', ipa: '/bɪˈɡɪn.ɪŋ/', def: 'Iniciando uma ação.' },
  get: { pt: 'ficar / obter', pos: 'Verbo', ipa: '/ɡɛt/', def: 'Passar a ter ou tornar-se em determinado estado.' },
  very: { pt: 'muito / bastante', pos: 'Advérbio de intensidade', ipa: '/ˈvɛr.i/', def: 'Em grau elevado.' },
  tired: { pt: 'cansada', pos: 'Adjetivo', ipa: '/ˈtaɪ.ərd/', def: 'Com fadiga ou esgotamento de energia.' },
  sitting: { pt: 'sentada', pos: 'Verbo (gerúndio)', ipa: '/ˈsɪt.ɪŋ/', def: 'Apoiada sobre o assento.' },
  by: { pt: 'ao lado de / por', pos: 'Preposição', ipa: '/baɪ/', def: 'Perto de; nas imediações de.' },
  her: { pt: 'sua / dela', pos: 'Pronome possessivo', ipa: '/hɜːr/', def: 'Pertencente a ela.' },
  sister: { pt: 'irmã', pos: 'Substantivo', ipa: '/ˈsɪs.tər/', def: 'Filha dos mesmos pais.' },
  bank: { pt: 'barranco / margem', pos: 'Substantivo', ipa: '/bæŋk/', def: 'Terreno inclinado na beira de um rio ou canal.' },
  having: { pt: 'ter / tendo', pos: 'Verbo (gerúndio)', ipa: '/ˈhæv.ɪŋ/', def: 'Possuir ou experienciar algo.' },
  nothing: { pt: 'nada', pos: 'Pronome', ipa: '/ˈnʌθ.ɪŋ/', def: 'Nenhuma coisa existente.' },
  do: { pt: 'fazer', pos: 'Verbo', ipa: '/duː/', def: 'Realizar ou executar determinada atividade.' },
  did: { pt: 'fez (auxiliar passado)', pos: 'Verbo auxiliar', ipa: '/dɪd/', def: 'Passado do verbo auxiliar to do.' },
  or: { pt: 'ou / nem', pos: 'Conjunção', ipa: '/ɔːr/', def: 'Indica alternativa ou exclusão.' },
  no: { pt: 'nenhum / não', pos: 'Determinante / Adv.', ipa: '/noʊ/', def: 'Ausência completa ou negação.' },
  nor: { pt: 'nem', pos: 'Conjunção', ipa: '/nɔːr/', def: 'Conjunção negativa adicional.' },
  own: { pt: 'própria / próprio', pos: 'Adjetivo', ipa: '/oʊn/', def: 'Pertencente exclusivamente ao próprio sujeito.' },
  twice: { pt: 'duas vezes', pos: 'Advérbio', ipa: '/twaɪs/', def: 'Em duas ocasiões distintas.' },
  peeped: { pt: 'espiou / olhou de relance', pos: 'Verbo (passado)', ipa: '/piːpt/', def: 'Olhar disfarçadamente ou rapidamente.' },
  reading: { pt: 'lendo', pos: 'Verbo (gerúndio)', ipa: '/ˈriː.dɪŋ/', def: 'Decodificando palavras e textos escritos.' },
  conversations: { pt: 'conversas / diálogos', pos: 'Substantivo (pl.)', ipa: '/ˌkɒn.vəˈseɪ.ʃənz/', def: 'Troca verbal de palavras entre duas ou mais pessoas.' },
  thought: { pt: 'pensou / achou', pos: 'Verbo (passado)', ipa: '/θɔːt/', def: 'Passado do verbo to think.' },
  use: { pt: 'utilidade / uso', pos: 'Substantivo', ipa: '/juːs/', def: 'Função, proveito ou serventia de algo.' },
  considering: { pt: 'considerando / ponderando', pos: 'Verbo (gerúndio)', ipa: '/kənˈsɪd.ər.ɪŋ/', def: 'Pensando nas vantagens e desvantagens.' },
  mind: { pt: 'mente / pensamento', pos: 'Substantivo', ipa: '/maɪnd/', def: 'Capacidade intelectual e de pensamento humano.' },
  pleasure: { pt: 'prazer / deleite', pos: 'Substantivo', ipa: '/ˈplɛʒ.ər/', def: 'Sensação agradável e aprazível.' },
  daisychain: { pt: 'corrente de margaridas', pos: 'Substantivo composto', ipa: '/ˈdeɪ.zi.tʃeɪn/', def: 'Cordão feito entrelaçando flores de margarida.' },
  worth: { pt: 'valer a pena', pos: 'Adjetivo', ipa: '/wɜːrθ/', def: 'Que compensa o esforço ou valor despendido.' },
  trouble: { pt: 'trabalho / esforço', pos: 'Substantivo', ipa: '/ˈtrʌb.əl/', def: 'Dificuldade ou inconveniente.' },
  suddenly: { pt: 'de repente / subitamente', pos: 'Advérbio', ipa: '/ˈsʌd.ən.li/', def: 'De maneira inesperada e veloz.' },
  white: { pt: 'branco', pos: 'Adjetivo', ipa: '/waɪt/', def: 'Da cor da neve ou do leite.' },
  rabbit: { pt: 'coelho', pos: 'Substantivo', ipa: '/ˈræb.ɪt/', def: 'Pequeno mamífero orelhudo e saltador.' },
  pink: { pt: 'cor-de-rosa / rosa', pos: 'Adjetivo', ipa: '/pɪŋk/', def: 'Da cor entre o vermelho e o branco.' },
  eyes: { pt: 'olhos', pos: 'Substantivo (pl.)', ipa: '/aɪz/', def: 'Órgãos responsáveis pelo sentido da visão.' },
  ran: { pt: 'correu', pos: 'Verbo (passado)', ipa: '/ræn/', def: 'Passado do verbo to run.' },
  close: { pt: 'perto / rente', pos: 'Advérbio', ipa: '/kloʊs/', def: 'A curta distância.' },
  remarkable: { pt: 'extraordinário / notável', pos: 'Adjetivo', ipa: '/rɪˈmɑːr.kə.bəl/', def: 'Digno de nota ou atenção especial.' },
  hear: { pt: 'ouvir / escutar', pos: 'Verbo', ipa: '/hɪər/', def: 'Perceber sons pelo sentido da audição.' },
  heard: { pt: 'ouvi / escutou', pos: 'Verbo (passado)', ipa: '/hɜːrd/', def: 'Passado do verbo to hear.' },
  itself: { pt: 'si mesmo', pos: 'Pronome reflexivo', ipa: '/ɪtˈsɛlf/', def: 'Forma reflexiva do pronome neutro it.' },
  oh: { pt: 'oh / ai', pos: 'Interjeição', ipa: '/oʊ/', def: 'Exclamação de surpresa, espanto ou preocupação.' },
  dear: { pt: 'querido / meu Deus', pos: 'Interjeição / Adj.', ipa: '/dɪər/', def: 'Expressão de afeto ou exclamação de preocupação.' },
  late: { pt: 'atrasado / tarde', pos: 'Adjetivo / Adv.', ipa: '/leɪt/', def: 'Após o horário esperado ou devido.' },
  sherlock: { pt: 'Sherlock', pos: 'Nome próprio', ipa: '/ˈʃɜːr.lɒk/', def: 'Famoso detetive criado por Arthur Conan Doyle.' },
  holmes: { pt: 'Holmes', pos: 'Sobrenome', ipa: '/hoʊmz/', def: 'Sobrenome do detetive Sherlock Holmes.' },
  seldom: { pt: 'raramente / poucas vezes', pos: 'Advérbio', ipa: '/ˈsɛl.dəm/', def: 'Com pouca frequência.' },
  mention: { pt: 'mencionar / citar', pos: 'Verbo', ipa: '/ˈmɛn.ʃən/', def: 'Referir-se brevemente a alguém ou algo.' },
  under: { pt: 'sob / por', pos: 'Preposição', ipa: '/ˈʌn.dər/', def: 'Abaixo de ou sob determinada designação.' },
  name: { pt: 'nome', pos: 'Substantivo', ipa: '/neɪm/', def: 'Palavra com que se designa pessoa ou coisa.' },
  eclipses: { pt: 'eclipsa / ofusca', pos: 'Verbo', ipa: '/ɪˈklɪp.sɪz/', def: 'Supera em brilho ou importância.' },
  predominates: { pt: 'predomina / prevalece', pos: 'Verbo', ipa: '/prɪˈdɒm.ɪ.neɪts/', def: 'Exerce influência ou autoridade superior.' },
  sex: { pt: 'sexo / gênero', pos: 'Substantivo', ipa: '/sɛks/', def: 'Conjunto de pessoas do mesmo gênero.' },
  emotion: { pt: 'emoção / sentimento', pos: 'Substantivo', ipa: '/ɪˈmoʊ.ʃən/', def: 'Reação afetiva intensa.' },
  emotions: { pt: 'emoções', pos: 'Substantivo (pl.)', ipa: '/ɪˈmoʊ.ʃənz/', def: 'Plural de emotion.' },
  akin: { pt: 'semelhante / afim', pos: 'Adjetivo', ipa: '/əˈkɪn/', def: 'De natureza similar ou parecida.' },
  love: { pt: 'amor', pos: 'Substantivo', ipa: '/lʌv/', def: 'Sentimento de profunda afeição.' },
  irene: { pt: 'Irene', pos: 'Nome próprio', ipa: '/aɪˈriːn/', def: 'Nome próprio feminino.' },
  adler: { pt: 'Adler', pos: 'Sobrenome', ipa: '/ˈæd.lər/', def: 'Sobrenome de Irene Adler.' },
  particularly: { pt: 'particularmente / em especial', pos: 'Advérbio', ipa: '/pərˈtɪk.jə.lər.li/', def: 'De modo específico ou destacado.' },
  abhorrent: { pt: 'abomináveis / repugnantes', pos: 'Adjetivo', ipa: '/æbˈhɒr.ənt/', def: 'Que causa aversão ou repulsa à razão.' },
  cold: { pt: 'fria / frio', pos: 'Adjetivo', ipa: '/koʊld/', def: 'Desprovido de calor emocional; objetivo.' },
  precise: { pt: 'precisa / exata', pos: 'Adjetivo', ipa: '/prɪˈsaɪs/', def: 'Rigorosa, exata e sem margem de erro.' },
  admirably: { pt: 'admiravelmente', pos: 'Advérbio', ipa: '/ˈæd.mər.ə.bli/', def: 'De maneira digna de admiração.' },
  balanced: { pt: 'equilibrada', pos: 'Adjetivo', ipa: '/ˈbæl.ənst/', def: 'Estável, sensata e proporcional.' }
};

export const SAMPLE_BOOKS: Book[] = [
  // 0. OBRA-PRIMA AUTORAL DO PROJETO TEACHER READER (A1 → C1 Progressivo · Romance, Mistério & Drama nos EUA)
  {
    id: 'teacher-reader-masterpiece',
    title: 'The Secret of Beacon Hill (Obra-Prima A1→C1)',
    author: 'Teacher Reader Masterpiece · Romance, Mistério & Inglês dos EUA',
    cefrLevel: 'A1',
    difficultyLabel: 'Progressivo A1→C1',
    lengthCategory: 'Grande',
    contextTag: '⭐ Obra-Prima · Romance, Mistério & Inglês Progressivo (A1→C1)',
    isProgressiveMasterpiece: true,
    sentences: [
      // === ATO I · O ENCONTRO EM BEACON HILL (NÍVEL A1 · FRASES 1 A 10) ===
      {
        en: 'My name is Lucas, and I am from Brazil.',
        pt: 'Meu nome é Lucas, e eu sou do Brasil.',
        cefrLevel: 'A1',
        actTitle: 'Ato I · O Café em Boston (A1)',
        grammarRule: 'Verbo To Be (is / am) + preposição "from" para dizer sua origem nos EUA.'
      },
      {
        en: 'Now I live and work here in Boston.',
        pt: 'Agora eu moro e trabalho aqui em Boston.',
        cefrLevel: 'A1',
        actTitle: 'Ato I · O Café em Boston (A1)',
        grammarRule: 'Simple Present (I live / I work) para fatos atuais + preposição "in" antes de cidades.'
      },
      {
        en: 'Every morning I go to a small coffee shop.',
        pt: 'Toda manhã eu vou até uma pequena cafeteria.',
        cefrLevel: 'A1',
        actTitle: 'Ato I · O Café em Boston (A1)',
        grammarRule: 'Hábito diário com "Every morning" + adjetivo sempre antes do substantivo (small coffee shop).'
      },
      {
        en: 'A young woman with green eyes works there.',
        pt: 'Uma jovem mulher de olhos verdes trabalha lá.',
        cefrLevel: 'A1',
        actTitle: 'Ato I · O Café em Boston (A1)',
        grammarRule: 'Regra da 3ª pessoa no presente: adiciona-se "-s" ao verbo (she works) + "with" para características.'
      },
      {
        en: 'Her name is Clara, and she loves old books.',
        pt: 'O nome dela é Clara, e ela ama livros antigos.',
        cefrLevel: 'A1',
        actTitle: 'Ato I · O Café em Boston (A1)',
        grammarRule: 'Diferença essencial: "Her" (dela / possessivo) vs. "She" (ela / sujeito).'
      },
      {
        en: 'Today it is cold and raining outside the window.',
        pt: 'Hoje está frio e chovendo fora da janela.',
        cefrLevel: 'A1',
        actTitle: 'Ato I · O Café em Boston (A1)',
        grammarRule: 'Em inglês, toda frase precisa de sujeito: usa-se "It is" para falar do clima e do tempo.'
      },
      {
        en: 'I ask for a hot cup of black coffee.',
        pt: 'Eu peço uma xícara quente de café preto.',
        cefrLevel: 'A1',
        actTitle: 'Ato I · O Café em Boston (A1)',
        grammarRule: 'Expressão mais usada em cafés nos EUA: "ask for" (pedir um objeto ou bebida).'
      },
      {
        en: 'Clara smiles at me and sits at my table.',
        pt: 'Clara sorri para mim e senta na minha mesa.',
        cefrLevel: 'A1',
        actTitle: 'Ato I · O Café em Boston (A1)',
        grammarRule: 'Preposição "at" para direção do olhar/sorriso ("smile at me") e ponto específico ("at my table").'
      },
      {
        en: 'She has a red book in her cold hands.',
        pt: 'Ela tem um livro vermelho em suas mãos frias.',
        cefrLevel: 'A1',
        actTitle: 'Ato I · O Café em Boston (A1)',
        grammarRule: 'Verbo "to have" (ter) muda para "has" com he, she e it ("She has").'
      },
      {
        en: 'Look at this page, because your name is here.',
        pt: 'Olhe para esta página, porque seu nome está aqui.',
        cefrLevel: 'A1',
        actTitle: 'Ato I · O Café em Boston (A1)',
        grammarRule: 'Imperativo direto ("Look at") + demonstrativo "this" (este/esta) + conjunção "because" (porque).'
      },

      // === ATO II · A CHAVE DE PRATA E A CARTA PERDIDA (NÍVEL A2 · FRASES 11 A 20) ===
      {
        en: 'I opened the red book and saw a small silver key inside.',
        pt: 'Eu abri o livro vermelho e vi uma pequena chave de prata lá dentro.',
        cefrLevel: 'A2',
        actTitle: 'Ato II · A Chave de Prata (A2)',
        grammarRule: 'Simple Past: verbos regulares terminam em "-ed" (opened) e irregulares mudam de forma (saw).'
      },
      {
        en: 'Under the silver key, there was a short letter from her father.',
        pt: 'Debaixo da chave de prata, havia uma carta curta do pai dela.',
        cefrLevel: 'A2',
        actTitle: 'Ato II · A Chave de Prata (A2)',
        grammarRule: 'Existência no passado: usa-se "there was" para "havia / tinha" (nunca use "had" sem sujeito!).'
      },
      {
        en: 'Clara told me that her father left Boston five years ago.',
        pt: 'Clara me contou que o pai dela deixou Boston cinco anos atrás.',
        cefrLevel: 'A2',
        actTitle: 'Ato II · A Chave de Prata (A2)',
        grammarRule: 'Verbo "told" exige a pessoa logo depois ("told me") + "ago" no final para tempo passado.'
      },
      {
        en: 'He was looking for the truth about a big fire near the harbor.',
        pt: 'Ele estava procurando a verdade sobre um grande incêndio perto do porto.',
        cefrLevel: 'A2',
        actTitle: 'Ato II · A Chave de Prata (A2)',
        grammarRule: 'Past Continuous (was + verbo com -ing) + phrasal verb "look for" (procurar).'
      },
      {
        en: 'That night, he called Clara, but he never came back home.',
        pt: 'Naquela noite, ele ligou para Clara, mas nunca voltou para casa.',
        cefrLevel: 'A2',
        actTitle: 'Ato II · A Chave de Prata (A2)',
        grammarRule: 'Regra americana: "call someone" (sem preposição) e "come back home" (sem "to" antes de home).'
      },
      {
        en: 'Why did he write my family name at the bottom of the letter?',
        pt: 'Por que ele escreveu o nome da minha família no final da carta?',
        cefrLevel: 'A2',
        actTitle: 'Ato II · A Chave de Prata (A2)',
        grammarRule: 'Perguntas no passado usam o auxiliar "did" e o verbo principal volta ao normal ("did he write").'
      },
      {
        en: 'Suddenly, we saw a tall man in a dark coat across the street.',
        pt: 'De repente, nós vimos um homem alto de casaco escuro do outro lado da rua.',
        cefrLevel: 'A2',
        actTitle: 'Ato II · A Chave de Prata (A2)',
        grammarRule: 'Preposição "in" para roupas que alguém veste ("in a dark coat") + "across the street".'
      },
      {
        en: 'He was watching our table and taking photos with his phone.',
        pt: 'Ele estava observando nossa mesa e tirando fotos com o telefone dele.',
        cefrLevel: 'A2',
        actTitle: 'Ato II · A Chave de Prata (A2)',
        grammarRule: 'Collocation americana: diz-se "take photos" (tirar fotos) com o verbo "take".'
      },
      {
        en: 'Clara looked scared, so I held her hand and spoke softly.',
        pt: 'Clara pareceu assustada, então eu segurei a mão dela e falei baixinho.',
        cefrLevel: 'A2',
        actTitle: 'Ato II · A Chave de Prata (A2)',
        grammarRule: 'Verbo de percepção "look + adjetivo" (parecer visualmente) + advérbio com "-ly" (softly).'
      },
      {
        en: 'Do not worry, because I will help you find your father.',
        pt: 'Não se preocupe, porque eu vou ajudar você a encontrar seu pai.',
        cefrLevel: 'A2',
        actTitle: 'Ato II · A Chave de Prata (A2)',
        grammarRule: 'Futuro com "will" para promessas no momento da fala + "help someone find" (verbo direto).'
      },

      // === ATO III · SOMBRAS NO RIO CHARLES (NÍVEL B1 · FRASES 21 A 30) ===
      {
        en: 'We walked fast through the back door and took the subway toward the river.',
        pt: 'Nós caminhamos rápido pela porta dos fundos e pegamos o metrô em direção ao rio.',
        cefrLevel: 'B1',
        actTitle: 'Ato III · Sombras no Rio Charles (B1)',
        grammarRule: 'Vocabulário dos EUA: "subway" (metrô) + movimento através ("through") vs. direção ("toward").'
      },
      {
        en: 'Clara has kept her notebook in her bag since the night he disappeared.',
        pt: 'Clara tem guardado seu caderno na bolsa desde a noite em que ele desapareceu.',
        cefrLevel: 'B1',
        actTitle: 'Ato III · Sombras no Rio Charles (B1)',
        grammarRule: 'Present Perfect (has kept) + "since": conecta uma ação iniciada no passado ao presente.'
      },
      {
        en: 'While the train was crossing the bridge, we tried to figure out the secret address.',
        pt: 'Enquanto o trem estava cruzando a ponte, nós tentamos desvendar o endereço secreto.',
        cefrLevel: 'B1',
        actTitle: 'Ato III · Sombras no Rio Charles (B1)',
        grammarRule: 'Phrasal verb favorito nos EUA: "figure out" (entender, decifrar ou descobrir raciocinando).'
      },
      {
        en: 'I have never met anyone who makes me feel as brave as you do.',
        pt: 'Eu nunca conheci ninguém que me faça sentir tão corajoso quanto você faz.',
        cefrLevel: 'B1',
        actTitle: 'Ato III · Sombras no Rio Charles (B1)',
        grammarRule: 'Experiência de vida ("I have never met") + comparativo de igualdade ("as brave as").'
      },
      {
        en: 'If we follow the numbers on this map, we will find the old stone lighthouse.',
        pt: 'Se nós seguirmos os números neste mapa, encontraremos o antigo farol de pedra.',
        cefrLevel: 'B1',
        actTitle: 'Ato III · Sombras no Rio Charles (B1)',
        grammarRule: 'First Conditional (If + Present Simple, will + verbo): em inglês não se usa subjuntivo após "If"!'
      },
      {
        en: 'She told me that her father used to bring her to this harbor every Sunday.',
        pt: 'Ela me contou que o pai dela costumava trazê-la a este porto todo domingo.',
        cefrLevel: 'B1',
        actTitle: 'Ato III · Sombras no Rio Charles (B1)',
        grammarRule: 'Estrutura "used to + verbo": indica um hábito antigo que acontecia no passado.'
      },
      {
        en: 'If I knew why my uncle was mentioned in that letter, I would tell you immediately.',
        pt: 'Se eu soubesse por que meu tio foi mencionado naquela carta, eu lhe diria imediatamente.',
        cefrLevel: 'B1',
        actTitle: 'Ato III · Sombras no Rio Charles (B1)',
        grammarRule: 'Second Conditional (If + Simple Past, would + verbo): situação hipotética no presente.'
      },
      {
        en: 'Even though the wind was blowing hard, we decided not to give up our search.',
        pt: 'Mesmo que o vento estivesse soprando forte, nós decidimos não desistir da nossa busca.',
        cefrLevel: 'B1',
        actTitle: 'Ato III · Sombras no Rio Charles (B1)',
        grammarRule: 'Conector "Even though" (embora / mesmo que) + phrasal verb "give up" (desistir).'
      },
      {
        en: 'At the end of the wooden pier stood a locked door that nobody had opened for years.',
        pt: 'No final do píer de madeira ficava uma porta trancada que ninguém havia aberto por anos.',
        cefrLevel: 'B1',
        actTitle: 'Ato III · Sombras no Rio Charles (B1)',
        grammarRule: 'Past Perfect ("had opened"): o "passado do passado", ocorrido antes de eles chegarem lá.'
      },
      {
        en: 'Clara put the silver key into the lock, turned it slowly, and pushed the heavy door.',
        pt: 'Clara colocou a chave de prata na fechadura, girou-a lentamente e empurrou a porta pesada.',
        cefrLevel: 'B1',
        actTitle: 'Ato III · Sombras no Rio Charles (B1)',
        grammarRule: 'Verbo irregular invariável "put" (presente e passado iguais) + posição do pronome ("turned it slowly").'
      },

      // === ATO IV · O SEGREDO DO FAROL (NÍVEL B2 · FRASES 31 A 40) ===
      {
        en: 'Inside the hidden room, we discovered dozens of photographs that had been taken before the fire.',
        pt: 'Dentro da sala escondida, nós descobrimos dezenas de fotografias que haviam sido tiradas antes do incêndio.',
        cefrLevel: 'B2',
        actTitle: 'Ato IV · O Segredo do Farol (B2)',
        grammarRule: 'Voz Passiva no Past Perfect ("had been taken" = haviam sido tiradas).'
      },
      {
        en: 'The documents proved that the warehouse fire had been started intentionally to destroy financial records.',
        pt: 'Os documentos provavam que o incêndio no armazém havia sido iniciado intencionalmente para destruir registros financeiros.',
        cefrLevel: 'B2',
        actTitle: 'Ato IV · O Segredo do Farol (B2)',
        grammarRule: 'Voz Passiva ("had been started") + advérbio de modo ("intentionally") + infinitivo de finalidade.'
      },
      {
        en: 'My uncle from Brazil had been working with her father to expose a corrupt senator.',
        pt: 'Meu tio do Brasil vinha trabalhando com o pai dela para expor um senador corrupto.',
        cefrLevel: 'B2',
        actTitle: 'Ato IV · O Segredo do Farol (B2)',
        grammarRule: 'Past Perfect Continuous ("had been working"): ação contínua em andamento antes de outro evento passado.'
      },
      {
        en: 'Her father must have realized that his family was in danger, so he hid the evidence here.',
        pt: 'O pai dela deve ter percebido que sua família estava em perigo, então escondeu as provas aqui.',
        cefrLevel: 'B2',
        actTitle: 'Ato IV · O Segredo do Farol (B2)',
        grammarRule: 'Modal de dedução no passado ("must have + particípio"): expressa conclusão lógica sobre o passado.'
      },
      {
        en: 'If Clara had not noticed my last name in that book, we would never have found this room.',
        pt: 'Se Clara não tivesse notado meu sobrenome naquele livro, nós nunca teríamos encontrado esta sala.',
        cefrLevel: 'B2',
        actTitle: 'Ato IV · O Segredo do Farol (B2)',
        grammarRule: 'Third Conditional (If + had + particípio, would have + particípio): hipótese sobre o passado.'
      },
      {
        en: 'Footsteps echoed on the iron stairs below us, and the man in the dark coat entered the room.',
        pt: 'Passos ecoaram na escada de ferro abaixo de nós, e o homem do casaco escuro entrou na sala.',
        cefrLevel: 'B2',
        actTitle: 'Ato IV · O Segredo do Farol (B2)',
        grammarRule: 'Atenção: o verbo "enter" (entrar em um local físico) nunca usa a preposição "in" ("entered the room").'
      },
      {
        en: 'Instead of attacking us, the stranger removed his hat and revealed that he was a federal agent.',
        pt: 'Em vez de nos atacar, o estranho tirou o chapéu e revelou que era um agente federal.',
        cefrLevel: 'B2',
        actTitle: 'Ato IV · O Segredo do Farol (B2)',
        grammarRule: 'Regra de ouro: após preposições como "Instead of" (em vez de), o verbo recebe "-ing" ("attacking").'
      },
      {
        en: 'He explained that he had been protecting Clara from afar while waiting for the final key.',
        pt: 'Ele explicou que vinha protegendo Clara de longe enquanto aguardava a chave final.',
        cefrLevel: 'B2',
        actTitle: 'Ato IV · O Segredo do Farol (B2)',
        grammarRule: 'Oração reduzida com "while + verbo-ing" ("while waiting" = enquanto aguardava).'
      },
      {
        en: 'Her voice trembled with emotion when the agent told her that her father was still alive.',
        pt: 'A voz dela tremeu de emoção quando o agente lhe contou que o pai dela ainda estava vivo.',
        cefrLevel: 'B2',
        actTitle: 'Ato IV · O Segredo do Farol (B2)',
        grammarRule: 'Reported Speech (Discurso Indireto): o presente recua para o passado ("told her that... was still alive").'
      },
      {
        en: 'Looking into my eyes, Clara whispered that my courage had brought light back into her life.',
        pt: 'Olhando nos meus olhos, Clara sussurrou que minha coragem havia trazido a luz de volta para a vida dela.',
        cefrLevel: 'B2',
        actTitle: 'Ato IV · O Segredo do Farol (B2)',
        grammarRule: 'Participle Clause no início ("Looking into my eyes") para unir duas ações simultâneas com elegância.'
      },

      // === ATO V · JUSTIÇA, REENCONTRO E RECOMEÇO (NÍVEL C1 · FRASES 41 A 50) ===
      {
        en: 'Never had Clara imagined that a quiet morning at a neighborhood coffee shop would transform her entire destiny.',
        pt: 'Jamais Clara havia imaginado que uma manhã tranquila em uma cafeteria de bairro transformaria todo o seu destino.',
        cefrLevel: 'C1',
        actTitle: 'Ato V · Verdade e Recomeço (C1)',
        grammarRule: 'Inversão enfática C1: ao iniciar a frase com "Never", inverte-se o auxiliar antes do sujeito ("Never had Clara imagined").'
      },
      {
        en: 'Not only did the recovered recordings expose the crimes, but they also cleared her father completely.',
        pt: 'As gravações recuperadas não apenas expuseram os crimes, mas também inocentaram completamente o pai dela.',
        cefrLevel: 'C1',
        actTitle: 'Ato V · Verdade e Recomeço (C1)',
        grammarRule: 'Estrutura avançada "Not only did [sujeito] [verbo]..., but they also...": inversão obrigatória na primeira oração.'
      },
      {
        en: 'The federal prosecutor insisted that every piece of evidence be presented before the grand jury without delay.',
        pt: 'O promotor federal insistiu que cada prova fosse apresentada perante o grande júri sem demora.',
        cefrLevel: 'C1',
        actTitle: 'Ato V · Verdade e Recomeço (C1)',
        grammarRule: 'Subjuntivo formal nos EUA: após verbos como "insist / demand / suggest that", usa-se o verbo na forma base ("be presented").'
      },
      {
        en: 'Hardly had the trial concluded when her father stepped out of witness protection to embrace his daughter.',
        pt: 'Mal havia o julgamento terminado quando o pai dela saiu da proteção a testemunhas para abraçar sua filha.',
        cefrLevel: 'C1',
        actTitle: 'Ato V · Verdade e Recomeço (C1)',
        grammarRule: 'Inversão temporal C1: "Hardly had [algo acontecido] when..." equivale a "Mal havia acontecido quando...".'
      },
      {
        en: 'Standing on the harbor pier at sunset, Thomas thanked me for having stood by Clara through the darkest storm.',
        pt: 'Em pé no píer do porto ao pôr do sol, Thomas me agradeceu por ter permanecido ao lado de Clara durante a tempestade mais escura.',
        cefrLevel: 'C1',
        actTitle: 'Ato V · Verdade e Recomeço (C1)',
        grammarRule: 'Perfect Participle ("for having stood by") + phrasal verb "stand by someone" (apoiar lealmente alguém).'
      },
      {
        en: 'Had it not been for our shared determination, the truth behind that conspiracy might have remained buried forever.',
        pt: 'Não fosse pela nossa determinação compartilhada, a verdade por trás daquela conspiração poderia ter permanecido enterrada para sempre.',
        cefrLevel: 'C1',
        actTitle: 'Ato V · Verdade e Recomeço (C1)',
        grammarRule: '3ª Condicional invertida C1 sem "If": "Had it not been for..." (Não fosse por...) + "might have remained".'
      },
      {
        en: 'What mattered most to both of us was not the danger we had faced, but the unbreakable trust we had built.',
        pt: 'O que mais importava para nós dois não era o perigo que havíamos enfrentado, mas a confiança inquebrável que havíamos construído.',
        cefrLevel: 'C1',
        actTitle: 'Ato V · Verdade e Recomeço (C1)',
        grammarRule: 'Cleft Sentence (Frase Clivada): "What mattered most was..." destaca o foco emocional da frase.'
      },
      {
        en: 'As autumn leaves fell across Beacon Hill, Clara and I reopened the old bookstore together.',
        pt: 'Enquanto as folhas de outono caíam sobre Beacon Hill, Clara e eu reabrimos juntos a antiga livraria.',
        cefrLevel: 'C1',
        actTitle: 'Ato V · Verdade e Recomeço (C1)',
        grammarRule: 'Conjunção literária "As" para ações simultâneas ("Enquanto") + etiqueta gramatical ("Clara and I" no sujeito).'
      },
      {
        en: 'Whenever a new traveler from Brazil walks through our door, we welcome them with warm coffee and a story of hope.',
        pt: 'Sempre que um novo viajante do Brasil passa pela nossa porta, nós o recebemos com café quente e uma história de esperança.',
        cefrLevel: 'C1',
        actTitle: 'Ato V · Verdade e Recomeço (C1)',
        grammarRule: 'Conector "Whenever" (Sempre que) + uso moderno de "them" singular neutro em inglês americano.'
      },
      {
        en: 'By mastering every word from the simplest greeting to the deepest confession, you have found your own voice in English.',
        pt: 'Ao dominar cada palavra, da saudação mais simples à confissão mais profunda, você encontrou sua própria voz em inglês.',
        cefrLevel: 'C1',
        actTitle: 'Ato V · Verdade e Recomeço (C1)',
        grammarRule: 'Estrutura "By + verbo-ing" (Ao fazer / Por meio de) + Present Perfect celebrando sua fluência conquistada!'
      }
    ]
  },

  // 1. B1 · Médio · Fábula Clássica
  {
    id: 'little-prince',
    title: 'The Little Prince',
    author: 'Antoine de Saint-Exupéry',
    cefrLevel: 'B1',
    difficultyLabel: 'Intermediário',
    lengthCategory: 'Médio',
    contextTag: 'Fábula Clássica',
    sentences: [
      {
        en: 'Once when I was six years old I saw a magnificent picture in a book.',
        pt: 'Certa vez, quando eu tinha seis anos, vi uma imagem magnífica em um livro.'
      },
      {
        en: 'It was a picture of a boa constrictor in the act of swallowing an animal.',
        pt: 'Era a figura de uma jiboia no ato de engolir um animal.'
      },
      {
        en: "In the book it said: 'Boa constrictors swallow their prey whole, without chewing it.'",
        pt: "No livro dizia: 'As jiboias engolem sua presa inteira, sem mastigá-la.'"
      },
      {
        en: 'After that they are not able to move, and they sleep through the six months that they need for digestion.',
        pt: 'Depois disso elas não conseguem se mover, e dormem durante os seis meses necessários para a digestão.'
      },
      {
        en: 'I pondered deeply, then, over the adventures of the jungle.',
        pt: 'Refleti profundamente, então, sobre as aventuras da selva.'
      },
      {
        en: 'And after some work with a colored pencil I succeeded in making my first drawing.',
        pt: 'E depois de algum trabalho com um lápis de cor, consegui fazer meu primeiro desenho.'
      },
      {
        en: 'My Drawing Number One. It looked something like this.',
        pt: 'Meu Desenho Número Um. Parecia mais ou menos com isso.'
      },
      {
        en: 'I showed my masterpiece to the grown-ups, and asked them whether the drawing frightened them.',
        pt: 'Mostrei minha obra-prima aos adultos e perguntei se o desenho lhes dava medo.'
      },
      {
        en: "But they answered: 'Frighten? Why should any one be frightened by a hat?'",
        pt: "Mas eles responderam: 'Medo? Por que alguém teria medo de um chapéu?'"
      },
      {
        en: 'My drawing was not a picture of a hat. It was a picture of a boa constrictor digesting an elephant.',
        pt: 'Meu desenho não era a figura de um chapéu. Era a imagem de uma jiboia digerindo um elefante.'
      }
    ]
  },

  // 2. A1 · Pequeno · Cotidiano & Café
  {
    id: 'coffee-shop-morning',
    title: 'Morning at the Coffee Shop',
    author: 'Teacher Reader Originals',
    cefrLevel: 'A1',
    difficultyLabel: 'Iniciante',
    lengthCategory: 'Pequeno',
    contextTag: 'Cotidiano & Café',
    sentences: [
      {
        en: 'Every morning I walk to a small coffee shop near my house.',
        pt: 'Toda manhã eu caminho até uma pequena cafeteria perto da minha casa.'
      },
      {
        en: 'The warm smell of fresh bread and roasted coffee fills the street.',
        pt: 'O cheiro quente de pão fresco e café torrado enche a rua.'
      },
      {
        en: 'I smile at the barista and ask for a hot cup of black coffee.',
        pt: 'Eu sorrio para o barista e peço uma xícara quente de café preto.'
      },
      {
        en: 'She gives me a warm croissant on a small white plate.',
        pt: 'Ela me entrega um croissant quentinho em um pequeno prato branco.'
      },
      {
        en: 'I sit by the window and watch people going to work.',
        pt: 'Eu me sento perto da janela e observo as pessoas indo para o trabalho.'
      },
      {
        en: 'It is my favorite quiet moment before the busy day begins.',
        pt: 'É o meu momento tranquilo favorito antes de o dia agitado começar.'
      }
    ]
  },

  // 3. A1 · Médio · Viagem & Turismo
  {
    id: 'weekend-in-new-york',
    title: 'A Weekend in New York',
    author: 'Teacher Reader Originals',
    cefrLevel: 'A1',
    difficultyLabel: 'Iniciante',
    lengthCategory: 'Médio',
    contextTag: 'Viagem & Turismo',
    sentences: [
      {
        en: 'Lucas arrived at the airport in New York on Friday morning.',
        pt: 'Lucas chegou ao aeroporto em Nova York na manhã de sexta-feira.'
      },
      {
        en: 'He took a yellow taxi from the terminal to his hotel in Manhattan.',
        pt: 'Ele pegou um táxi amarelo do terminal até o seu hotel em Manhattan.'
      },
      {
        en: 'Through the window he saw tall glass buildings and bright street signs.',
        pt: 'Pela janela ele viu prédios altos de vidro e placas luminosas nas ruas.'
      },
      {
        en: 'At the hotel reception, he showed his passport and got his room key.',
        pt: 'Na recepção do hotel, ele mostrou o passaporte e pegou a chave do quarto.'
      },
      {
        en: 'After a short rest, he walked to Central Park with his camera.',
        pt: 'Depois de um breve descanso, ele caminhou até o Central Park com sua câmera.'
      },
      {
        en: 'Families were having picnics on the green grass under the trees.',
        pt: 'Famílias estavam fazendo piqueniques na grama verde sob as árvores.'
      },
      {
        en: 'He bought a hot pretzel from a street cart and drank cold water.',
        pt: 'Ele comprou um pretzel quente em uma barraquinha de rua e bebeu água gelada.'
      },
      {
        en: 'In the evening, he visited Times Square to see the colorful lights.',
        pt: 'À noite, ele visitou a Times Square para ver as luzes coloridas.'
      },
      {
        en: 'He ate a slice of cheese pizza at a busy corner restaurant.',
        pt: 'Ele comeu uma fatia de pizza de queijo em um restaurante movimentado na esquina.'
      },
      {
        en: 'Before going to sleep, he sent three photos to his family in Brazil.',
        pt: 'Antes de dormir, ele enviou três fotos para sua família no Brasil.'
      }
    ]
  },

  // 4. A1 · Grande · História Cotidiana
  {
    id: 'lost-dog-in-the-park',
    title: 'The Lost Dog in the Park',
    author: 'Teacher Reader Originals',
    cefrLevel: 'A1',
    difficultyLabel: 'Iniciante',
    lengthCategory: 'Grande',
    contextTag: 'História Cotidiana',
    sentences: [
      {
        en: 'It was a sunny Saturday afternoon in the neighborhood park.',
        pt: 'Era uma tarde ensolarada de sábado no parque do bairro.'
      },
      {
        en: 'Clara was sitting on a wooden bench reading her English book.',
        pt: 'Clara estava sentada em um banco de madeira lendo seu livro de inglês.'
      },
      {
        en: 'Suddenly, a small brown dog ran toward her and stopped at her feet.',
        pt: 'De repente, um cachorrinho marrom correu na direção dela e parou aos seus pés.'
      },
      {
        en: 'The dog looked hungry and scared, and he had no owner around.',
        pt: 'O cachorro parecia faminto e assustado, e não tinha nenhum dono por perto.'
      },
      {
        en: 'Clara looked around the park, but nobody was calling the dog.',
        pt: 'Clara olhou ao redor do parque, mas ninguém estava chamando o cachorro.'
      },
      {
        en: 'She knelt down and spoke to him in a calm and gentle voice.',
        pt: 'Ela se ajoelhou e falou com ele em uma voz calma e gentil.'
      },
      {
        en: 'On his blue collar, she found a small silver tag with a name.',
        pt: 'Na coleira azul dele, ela encontrou uma pequena plaquinha prateada com um nome.'
      },
      {
        en: 'His name was Toby, and there was a phone number on the back.',
        pt: 'O nome dele era Toby, e havia um número de telefone na parte de trás.'
      },
      {
        en: 'Clara took her phone from her bag and called the number immediately.',
        pt: 'Clara tirou o telefone da bolsa e ligou para o número imediatamente.'
      },
      {
        en: 'An older man answered the phone with a worried voice.',
        pt: 'Um senhor mais velho atendeu o telefone com a voz preocupada.'
      },
      {
        en: 'He said that Toby had run through the front gate twenty minutes ago.',
        pt: 'Ele disse que Toby tinha corrido pelo portão da frente vinte minutos atrás.'
      },
      {
        en: 'Clara told the man to meet her near the fountain in the center of the park.',
        pt: 'Clara disse ao senhor para encontrá-la perto da fonte no centro do parque.'
      },
      {
        en: 'While they waited, she gave Toby some clean water in her bottle cap.',
        pt: 'Enquanto esperavam, ela deu a Toby um pouco de água limpa na tampa da garrafa.'
      },
      {
        en: 'Ten minutes later, the man arrived walking fast along the path.',
        pt: 'Dez minutos depois, o senhor chegou caminhando rápido pelo caminho.'
      },
      {
        en: 'When Toby saw his owner, he barked happily and wagged his tail.',
        pt: 'Quando Toby viu seu dono, ele latiu feliz e abanou o rabo.'
      },
      {
        en: 'The man thanked Clara with a big smile and shook her hand.',
        pt: 'O senhor agradeceu a Clara com um grande sorriso e apertou a mão dela.'
      }
    ]
  },

  // 5. A2 · Pequeno · Trabalho & Carreira
  {
    id: 'remote-tech-job',
    title: 'First Day at a Remote Tech Job',
    author: 'Teacher Reader Originals',
    cefrLevel: 'A2',
    difficultyLabel: 'Básico',
    lengthCategory: 'Pequeno',
    contextTag: 'Trabalho & Tech',
    sentences: [
      {
        en: 'Today is my first day working as a software designer for an international team.',
        pt: 'Hoje é o meu primeiro dia trabalhando como designer de software para uma equipe internacional.'
      },
      {
        en: 'At nine oclock, I opened my laptop and joined the morning video call.',
        pt: 'Às nove horas, abri meu notebook e entrei na videochamada matinal.'
      },
      {
        en: 'My manager welcomed me and introduced me to colleagues from London and Toronto.',
        pt: 'Minha gerente me deu as boas-vindas e me apresentou aos colegas de Londres e Toronto.'
      },
      {
        en: 'Everyone was friendly and spoke clearly so I could follow the conversation.',
        pt: 'Todos foram simpáticos e falaram com clareza para que eu pudesse acompanhar a conversa.'
      },
      {
        en: 'In the afternoon, we reviewed the new mobile application interface together.',
        pt: 'À tarde, revisamos juntos a nova interface do aplicativo móvel.'
      },
      {
        en: 'I shared two ideas to make the navigation buttons simpler for users.',
        pt: 'Compartilhei duas ideias para tornar os botões de navegação mais simples para os usuários.'
      },
      {
        en: 'By the end of the day, I felt proud and excited about my new career.',
        pt: 'No final do dia, me senti orgulhoso e animado com a minha nova carreira.'
      }
    ]
  },

  // 6. A2 · Médio · Aventura & Mistério
  {
    id: 'old-lighthouse-secret',
    title: 'The Secret of the Old Lighthouse',
    author: 'Teacher Reader Originals',
    cefrLevel: 'A2',
    difficultyLabel: 'Básico',
    lengthCategory: 'Médio',
    contextTag: 'Aventura & Mistério',
    sentences: [
      {
        en: 'At the edge of the rocky cliff stood an abandoned stone lighthouse.',
        pt: 'Na beira do penhasco rochoso erguia-se um farol de pedra abandonado.'
      },
      {
        en: 'For thirty years, no sailor had seen a light shining from its tower.',
        pt: 'Durante trinta anos, nenhum marinheiro tinha visto uma luz brilhando de sua torre.'
      },
      {
        en: 'One windy afternoon, Daniel and his sister decided to explore the old building.',
        pt: 'Em uma tarde de vento, Daniel e sua irmã decidiram explorar a antiga construção.'
      },
      {
        en: 'They pushed the heavy wooden door, which opened with a loud creak.',
        pt: 'Eles empurraram a pesada porta de madeira, que se abriu com um rangido alto.'
      },
      {
        en: 'Inside, a spiral iron staircase led all the way up to the glass lantern room.',
        pt: 'Lá dentro, uma escada de ferro em espiral subia até a sala da lanterna de vidro.'
      },
      {
        en: 'With a small flashlight, they climbed carefully step by step.',
        pt: 'Com uma pequena lanterna, eles subiram com cuidado degrau por degrau.'
      },
      {
        en: 'At the top, they discovered an old brass compass resting on a wooden desk.',
        pt: 'No topo, eles descobriram uma antiga bússola de latão apoiada sobre uma escrivaninha de madeira.'
      },
      {
        en: 'Underneath the compass lay a leather notebook filled with maps of the coast.',
        pt: 'Debaixo da bússola havia um caderno de couro cheio de mapas da costa.'
      },
      {
        en: 'The last page contained a message written by the lighthouse keeper in 1984.',
        pt: 'A última página continha uma mensagem escrita pelo guardião do farol em 1984.'
      },
      {
        en: 'It explained where he had hidden a chest of historical coins near the harbor.',
        pt: 'Ela explicava onde ele havia escondido um baú de moedas históricas perto do porto.'
      },
      {
        en: 'Daniel looked out at the ocean and knew their real adventure was just beginning.',
        pt: 'Daniel olhou para o oceano e soube que a verdadeira aventura deles estava apenas começando.'
      }
    ]
  },

  // 7. A2 · Grande · Viagem & Natureza
  {
    id: 'journey-across-the-alps',
    title: 'A Journey Across the Alps',
    author: 'Teacher Reader Originals',
    cefrLevel: 'A2',
    difficultyLabel: 'Básico',
    lengthCategory: 'Grande',
    contextTag: 'Viagem & Natureza',
    sentences: [
      {
        en: 'Early in the morning, the red mountain train departed from the valley station.',
        pt: 'Bem cedo pela manhã, o trem vermelho da montanha partiu da estação do vale.'
      },
      {
        en: 'Elena sat next to the wide panoramic window with a cup of hot tea.',
        pt: 'Elena sentou-se ao lado da ampla janela panorâmica com uma xícara de chá quente.'
      },
      {
        en: 'As the train climbed higher, the green forests slowly turned into white snowfields.',
        pt: 'À medida que o trem subia mais alto, as florestas verdes lentamente se transformavam em campos de neve branca.'
      },
      {
        en: 'Deep rivers flowed beneath stone bridges built more than a century ago.',
        pt: 'Rios profundos corriam sob pontes de pedra construídas há mais de um século.'
      },
      {
        en: 'Across the aisle, an elderly mountaineer was cleaning his camera lenses.',
        pt: 'Do outro lado do corredor, um montanhista idoso estava limpando as lentes de sua câmera.'
      },
      {
        en: 'He pointed toward the highest peak and told Elena its ancient name.',
        pt: 'Ele apontou para o pico mais alto e contou a Elena o seu nome antigo.'
      },
      {
        en: 'He explained that he had climbed that mountain when he was twenty years old.',
        pt: 'Ele explicou que havia escalado aquela montanha quando tinha vinte anos de idade.'
      },
      {
        en: 'Every summer since then, he returned to photograph the changing glaciers.',
        pt: 'Todo verão desde então, ele voltava para fotografar as geleiras em transformação.'
      },
      {
        en: 'At noon, the train stopped at a small village surrounded by pine trees.',
        pt: 'Ao meio-dia, o trem parou em um pequeno vilarejo cercado por pinheiros.'
      },
      {
        en: 'Elena stepped onto the platform and breathed the crisp, cold mountain air.',
        pt: 'Elena pisou na plataforma e respirou o ar puro e gelado da montanha.'
      },
      {
        en: 'She walked along a quiet cobblestone street to a traditional bakery.',
        pt: 'Ela caminhou por uma rua tranquila de paralelepípedos até uma padaria tradicional.'
      },
      {
        en: 'There she tasted warm apple strudel with cinnamon and fresh cream.',
        pt: 'Lá ela provou strudel de maçã quentinho com canela e creme fresco.'
      },
      {
        en: 'After lunch, she followed a marked hiking trail toward a frozen alpine lake.',
        pt: 'Depois do almoço, ela seguiu uma trilha demarcada em direção a um lago alpino congelado.'
      },
      {
        en: 'The surface of the lake reflected the blue sky like a giant mirror.',
        pt: 'A superfície do lago refletia o céu azul como um espelho gigante.'
      },
      {
        en: 'For a long time, the only sound was the wind moving through the branches.',
        pt: 'Por muito tempo, o único som era o vento passando entre os galhos.'
      },
      {
        en: 'When the afternoon sun began to set, the snow glowed with golden light.',
        pt: 'Quando o sol da tarde começou a se pôr, a neve brilhou com uma luz dourada.'
      },
      {
        en: 'Elena boarded the evening train feeling peaceful and deeply inspired.',
        pt: 'Elena embarcou no trem noturno sentindo-se em paz e profundamente inspirada.'
      }
    ]
  },

  // 8. B1 · Pequeno · Literatura Fantástica
  {
    id: 'alice',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    cefrLevel: 'B1',
    difficultyLabel: 'Intermediário',
    lengthCategory: 'Pequeno',
    contextTag: 'Literatura Fantástica',
    sentences: [
      {
        en: 'Alice was beginning to get very tired of sitting by her sister on the bank.',
        pt: 'Alice estava começando a ficar muito cansada de ficar sentada ao lado de sua irmã no barranco.'
      },
      {
        en: 'And of having nothing to do: once or twice she had peeped into the book her sister was reading.',
        pt: 'E de não ter nada para fazer: uma ou duas vezes ela havia espiado o livro que sua irmã estava lendo.'
      },
      {
        en: "But it had no pictures or conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?'",
        pt: "Mas não tinha gravuras nem diálogos, 'e de que serve um livro', pensou Alice, 'sem gravuras nem diálogos?'"
      },
      {
        en: 'So she was considering in her own mind whether the pleasure of making a daisy-chain would be worth the trouble.',
        pt: 'Então ela estava considerando em sua mente se o prazer de fazer uma corrente de margaridas valeria o esforço.'
      },
      {
        en: 'Suddenly a White Rabbit with pink eyes ran close by her.',
        pt: 'De repente, um Coelho Branco de olhos cor-de-rosa passou correndo perto dela.'
      },
      {
        en: "There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!'",
        pt: "Não havia nada de tão extraordinário nisso; nem Alice achou tão estranho ouvir o Coelho dizer para si mesmo: 'Ai, meu Deus! Vou me atrasar!'"
      }
    ]
  },

  // 9. B1 · Grande · Conto Contemporâneo
  {
    id: 'midnight-train-to-kyoto',
    title: 'The Midnight Train to Kyoto',
    author: 'Teacher Reader Originals',
    cefrLevel: 'B1',
    difficultyLabel: 'Intermediário',
    lengthCategory: 'Grande',
    contextTag: 'Conto Contemporâneo',
    sentences: [
      {
        en: 'Rain was falling softly against the glass roof of Tokyo Central Station.',
        pt: 'A chuva caía suavemente contra o teto de vidro da Estação Central de Tóquio.'
      },
      {
        en: 'Marcus checked his wristwatch and hurried toward platform fourteen.',
        pt: 'Marcus conferiu o relógio de pulso e apressou-se em direção à plataforma quatorze.'
      },
      {
        en: 'He had spent the last five years designing modern skyscrapers in busy metropolises.',
        pt: 'Ele havia passado os últimos cinco anos projetando arranha-céus modernos em metrópoles movimentadas.'
      },
      {
        en: 'Yet lately, he felt that his drawings lacked warmth and human memory.',
        pt: 'Contudo, ultimamente, ele sentia que faltavam calor e memória humana em seus desenhos.'
      },
      {
        en: 'His mentor had advised him to visit the ancient wooden temples of Kyoto.',
        pt: 'Seu mentor o havia aconselhado a visitar os antigos templos de madeira de Kyoto.'
      },
      {
        en: 'As the doors closed, the express train glided smoothly out of the city.',
        pt: 'Assim que as portas se fecharam, o trem expresso deslizou suavemente para fora da cidade.'
      },
      {
        en: 'Neon billboards gradually gave way to dark rice fields and quiet hills.',
        pt: 'Os painéis de neon gradualmente deram lugar a campos de arroz escuros e colinas silenciosas.'
      },
      {
        en: 'Marcus opened his sketchbook and began drawing the reflections on the window.',
        pt: 'Marcus abriu seu caderno de esboços e começou a desenhar os reflexos na janela.'
      },
      {
        en: 'An artisan sitting across from him noticed the delicate lines of his pencil.',
        pt: 'Um artesão sentado à sua frente notou os traços delicados do seu lápis.'
      },
      {
        en: 'The man explained that he restored traditional wooden houses without using a single nail.',
        pt: 'O homem explicou que restaurava casas tradicionais de madeira sem usar um único prego.'
      },
      {
        en: 'Instead, every beam was carved to fit naturally into the next piece of wood.',
        pt: 'Em vez disso, cada viga era esculpida para se encaixar naturalmente na peça seguinte de madeira.'
      },
      {
        en: 'He told Marcus that a building should breathe with the seasons rather than fight against them.',
        pt: 'Ele disse a Marcus que um edifício deve respirar com as estações, em vez de lutar contra elas.'
      },
      {
        en: 'They talked for two hours about balance, patience, and craftsmanship.',
        pt: 'Eles conversaram durante duas horas sobre equilíbrio, paciência e maestria artesanal.'
      },
      {
        en: 'Before getting off, the artisan invited Marcus to visit his workshop the next morning.',
        pt: 'Antes de desembarcar, o artesão convidou Marcus para visitar sua oficina na manhã seguinte.'
      },
      {
        en: 'When the train finally arrived in Kyoto, the rain had stopped completely.',
        pt: 'Quando o trem finalmente chegou a Kyoto, a chuva havia parado completamente.'
      },
      {
        en: 'Stepping onto the quiet platform, Marcus felt a renewed sense of purpose.',
        pt: 'Ao pisar na plataforma silenciosa, Marcus sentiu um senso de propósito renovado.'
      }
    ]
  },

  // 10. B2 · Médio · Negócios & Inovação
  {
    id: 'silicon-valley-pitch',
    title: 'Silicon Valley Pitch Night',
    author: 'Teacher Reader Originals',
    cefrLevel: 'B2',
    difficultyLabel: 'Avançado',
    lengthCategory: 'Médio',
    contextTag: 'Negócios & Inovação',
    sentences: [
      {
        en: 'Behind the stage curtain, Sofia reviewed her presentation slides one last time.',
        pt: 'Atrás da cortina do palco, Sofia revisou os slides de sua apresentação uma última vez.'
      },
      {
        en: 'In the auditorium, over two hundred venture capitalists were waiting for the next startup pitch.',
        pt: 'No auditório, mais de duzentos investidores de risco aguardavam a apresentação da próxima startup.'
      },
      {
        en: 'For eighteen months, her engineering team had been developing a clean-energy battery system.',
        pt: 'Durante dezoito meses, sua equipe de engenharia vinha desenvolvendo um sistema de baterias de energia limpa.'
      },
      {
        en: 'Unlike conventional lithium batteries, their prototype charged in under six minutes.',
        pt: 'Ao contrário das baterias de lítio convencionais, o protótipo deles carregava em menos de seis minutos.'
      },
      {
        en: 'When her name was announced, Sofia walked confidently toward the center microphone.',
        pt: 'Quando seu nome foi anunciado, Sofia caminhou com confiança até o microfone central.'
      },
      {
        en: 'Instead of starting with complex financial charts, she told a compelling personal story.',
        pt: 'Em vez de começar com gráficos financeiros complexos, ela contou uma história pessoal envolvente.'
      },
      {
        en: 'She demonstrated how affordable energy storage could transform remote hospitals and schools.',
        pt: 'Ela demonstrou como o armazenamento acessível de energia poderia transformar hospitais e escolas remotas.'
      },
      {
        en: 'During the question session, a senior partner challenged their manufacturing scalability.',
        pt: 'Durante a sessão de perguntas, um sócio sênior questionou a escalabilidade de fabricação deles.'
      },
      {
        en: 'Sofia answered with precise supply-chain metrics from their pilot factory.',
        pt: 'Sofia respondeu com métricas precisas da cadeia de suprimentos de sua fábrica-piloto.'
      },
      {
        en: 'The audience responded with enthusiastic applause, and three investors requested a morning meeting.',
        pt: 'A plateia respondeu com aplausos entusiasmados, e três investidores solicitaram uma reunião pela manhã.'
      }
    ]
  },

  // 11. B2 · Grande · Ficção Científica
  {
    id: 'echoes-from-station-europa',
    title: 'Echoes from Station Europa',
    author: 'Teacher Reader Originals',
    cefrLevel: 'B2',
    difficultyLabel: 'Avançado',
    lengthCategory: 'Grande',
    contextTag: 'Ficção Científica',
    sentences: [
      {
        en: 'Twelve kilometers beneath the frozen crust of Europa, Research Station Prometheus hummed quietly.',
        pt: 'Doze quilômetros abaixo da crosta congelada de Europa, a Estação de Pesquisa Prometheus vibrava silenciosamente.'
      },
      {
        en: 'Outside the reinforced titanium hull lay an pitch-black subsurface ocean older than humanity.',
        pt: 'Fora do casco de titânio reforçado estendia-se um oceano subterrâneo escuro como breu, mais antigo que a humanidade.'
      },
      {
        en: 'Dr. Helena Vance monitored the acoustic sonar arrays from the central observation deck.',
        pt: 'A Dra. Helena Vance monitorava os sensores acústicos de sonar a partir do convés central de observação.'
      },
      {
        en: 'For six months, the sensors had recorded nothing but the shifting of glacial plates above.',
        pt: 'Durante seis meses, os sensores não haviam registrado nada além do movimento das placas glaciais acima.'
      },
      {
        en: 'Then, at precisely three in the morning, a rhythmic frequency appeared on the spectrogram.',
        pt: 'Então, exatamente às três da manhã, uma frequência rítmica apareceu no espectrograma.'
      },
      {
        en: 'The pulses repeated in prime-number intervals that could not be explained by volcanic vents.',
        pt: 'Os pulsos se repetiam em intervalos de números primos que não podiam ser explicados por fendas vulcânicas.'
      },
      {
        en: 'Helena immediately woke Commander Jonas and the chief marine biologist.',
        pt: 'Helena acordou imediatamente o Comandante Jonas e o biólogo marinho-chefe.'
      },
      {
        en: 'They deployed an autonomous submersible equipped with low-light optical cameras.',
        pt: 'Eles lançaram um submersível autônomo equipado com câmeras ópticas para baixa luminosidade.'
      },
      {
        en: 'As the probe descended into the thermal trench, the water temperature rose steadily.',
        pt: 'À medida que a sonda descia pela fossa térmica, a temperatura da água subia continuamente.'
      },
      {
        en: 'Suddenly, the camera feed illuminated a vast forest of bioluminescent structures.',
        pt: 'De repente, a transmissão da câmera iluminou uma vasta floresta de estruturas bioluminescentes.'
      },
      {
        en: 'Thousands of translucent organisms pulsed with blue light in synchronized waves.',
        pt: 'Milhares de organismos translúcidos pulsavam com luz azul em ondas sincronizadas.'
      },
      {
        en: 'Each wave of light corresponded exactly to the acoustic signals detected by the station.',
        pt: 'Cada onda de luz correspondia exatamente aos sinais acústicos detectados pela estação.'
      },
      {
        en: 'The organisms were communicating across the ocean floor through harmonic vibrations.',
        pt: 'Os organismos estavam se comunicando pelo fundo do oceano por meio de vibrações harmônicas.'
      },
      {
        en: 'Jonas ordered the crew to turn off the external thrusters so they would not disturb the ecosystem.',
        pt: 'Jonas ordenou que a tripulação desligasse os propulsores externos para não perturbar o ecossistema.'
      },
      {
        en: 'In complete silence, the scientists watched the first confirmed extraterrestrial ecosystem in history.',
        pt: 'Em completo silêncio, os cientistas observaram o primeiro ecossistema extraterrestre confirmado da história.'
      },
      {
        en: 'Helena began transmitting the encrypted data packet back toward receivers on Earth.',
        pt: 'Helena começou a transmitir o pacote de dados criptografados de volta para os receptores na Terra.'
      }
    ]
  },

  // 12. C1 · Pequeno · Clássico Investigativo
  {
    id: 'sherlock',
    title: 'A Scandal in Bohemia',
    author: 'Arthur Conan Doyle',
    cefrLevel: 'C1',
    difficultyLabel: 'Fluente',
    lengthCategory: 'Pequeno',
    contextTag: 'Clássico Investigativo',
    sentences: [
      {
        en: 'To Sherlock Holmes she is always THE woman.',
        pt: 'Para Sherlock Holmes, ela é sempre A mulher.'
      },
      {
        en: 'I have seldom heard him mention her under any other name.',
        pt: 'Raramente o ouvi mencioná-la por qualquer outro nome.'
      },
      {
        en: 'In his eyes she eclipses and predominates the whole of her sex.',
        pt: 'Aos olhos dele, ela eclipsa e predomina sobre todo o seu sexo.'
      },
      {
        en: 'It was not that he felt any emotion akin to love for Irene Adler.',
        pt: 'Não que ele sentisse qualquer emoção semelhante ao amor por Irene Adler.'
      },
      {
        en: 'All emotions, and that one particularly, were abhorrent to his cold, precise but admirably balanced mind.',
        pt: 'Todas as emoções, e essa em particular, eram abomináveis para sua mente fria, precisa, mas admiravelmente equilibrada.'
      },
      {
        en: 'He was, I take it, the most perfect reasoning and observing machine that the world has seen.',
        pt: 'Ele era, a meu ver, a máquina de raciocínio e observação mais perfeita que o mundo já viu.'
      }
    ]
  },

  // 13. C1 · Grande · Filosofia & Estoicismo
  {
    id: 'art-of-stoic-stillness',
    title: 'The Art of Stoic Stillness',
    author: 'Teacher Reader Essays',
    cefrLevel: 'C1',
    difficultyLabel: 'Fluente',
    lengthCategory: 'Grande',
    contextTag: 'Filosofia & Estoicismo',
    sentences: [
      {
        en: 'In an era defined by relentless notifications, genuine silence has become a rare luxury.',
        pt: 'Em uma era definida por notificações incessantes, o silêncio genuíno tornou-se um luxo raro.'
      },
      {
        en: 'Ancient Stoic philosophers understood that external turbulence cannot disturb a disciplined mind.',
        pt: 'Os antigos filósofos estoicos compreendiam que a turbulência externa não pode perturbar uma mente disciplinada.'
      },
      {
        en: 'We often mistake constant motion for meaningful progress, exhausting our attention on trivial urgencies.',
        pt: 'Muitas vezes confundimos movimento constante com progresso significativo, esgotando nossa atenção em urgências triviais.'
      },
      {
        en: 'Marcus Aurelius reminded himself each morning that he controlled his judgment, not the events around him.',
        pt: 'Marco Aurélio lembrava a si mesmo todas as manhãs de que controlava o seu julgamento, e não os eventos ao seu redor.'
      },
      {
        en: 'When we pause before reacting to provocation, we reclaim sovereignty over our emotional state.',
        pt: 'Quando fazemos uma pausa antes de reagir a uma provocação, recuperamos a soberania sobre o nosso estado emocional.'
      },
      {
        en: 'Stillness is not the absence of action, but the clarity from which wise action emerges.',
        pt: 'A serenidade não é a ausência de ação, mas a clareza da qual emerge a ação sábia.'
      },
      {
        en: 'Consider how a deep lake remains calm beneath the surface even while storm winds sweep across the water.',
        pt: 'Considere como um lago profundo permanece calmo sob a superfície mesmo enquanto ventos de tempestade varrem a água.'
      },
      {
        en: 'By cultivating daily reflection, we train our perception to distinguish between essence and noise.',
        pt: 'Ao cultivar a reflexão diária, treinamos nossa percepção para distinguir entre a essência e o ruído.'
      },
      {
        en: 'True resilience is forged when we embrace uncertainty without surrendering our inner equilibrium.',
        pt: 'A verdadeira resiliência é forjada quando abraçamos a incerteza sem abrir mão do nosso equilíbrio interior.'
      },
      {
        en: 'Over time, this deliberate presence transforms how we read, how we listen, and how we speak.',
        pt: 'Com o tempo, essa presença deliberada transforma a maneira como lemos, como ouvimos e como falamos.'
      },
      {
        en: 'Rather than speaking merely to fill the silence, we choose words that carry weight and sincerity.',
        pt: 'Em vez de falar apenas para preencher o silêncio, escolhemos palavras que carregam peso e sinceridade.'
      },
      {
        en: 'Ultimately, mastering ones own attention is the highest form of intellectual freedom.',
        pt: 'Em última análise, dominar a própria atenção é a forma mais elevada de liberdade intelectual.'
      }
    ]
  }
];

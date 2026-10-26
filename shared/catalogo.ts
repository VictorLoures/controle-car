import type { ItemPlano } from './tipos';

/**
 * Itens essenciais de manutenção do HB20S 1.6 Flex, com intervalos de prática de mercado.
 * `fonte: 'manual'` marca os que batem com o manual Hyundai; nos outros, `obs` diz o que o manual pede.
 *
 * Serve de semente para a aba `itens` da planilha; depois disso a planilha é a fonte da verdade.
 */

type Linha = Omit<ItemPlano, 'id' | 'ativo' | 'fonte'> & Partial<Pick<ItemPlano, 'fonte'>>;

const linhas: Linha[] = [
  // Motor
  {
    componente: 'oleo-motor', nome: 'Óleo e filtro de óleo do motor', categoria: 'Motor', acao: 'troca',
    km: 10_000, meses: 12, severoKm: 5_000, severoMeses: 6, fonte: 'manual',
    obs: 'SAE 5W30, API SN ou superior. Cerca de 3,6 L com filtro. Confira o nível a cada 15 dias ou antes de viagem.',
  },
  {
    componente: 'filtro-ar-motor', nome: 'Filtro de ar do motor', categoria: 'Motor', acao: 'troca', km: 10_000, meses: 12,
    obs: 'Peça barata, troque junto com o óleo. O manual só pede troca a cada 40.000 km.',
  },
  {
    componente: 'filtro-combustivel', nome: 'Filtro de combustível', categoria: 'Motor', acao: 'troca', km: 10_000, meses: 12,
    fonte: 'manual', obs: 'Importante em carro flex por causa da qualidade do combustível.',
  },
  {
    componente: 'velas', nome: 'Velas de ignição', categoria: 'Motor', acao: 'inspecao', km: 40_000,
    obs: 'Peça para o mecânico avaliar e trocar se estiverem gastas. O manual só pede troca com 160.000 km.',
  },
  {
    componente: 'correia-acessorios', nome: 'Correia do alternador (acessórios)', categoria: 'Motor', acao: 'troca',
    km: 30_000, meses: 36, fonte: 'manual',
    obs: 'Nesse motor ela também gira a bomba d\'água: se arrebentar, o carro esquenta. Troque o tensor junto se tiver folga.',
  },
  {
    componente: 'liquido-arrefecimento', nome: 'Líquido de arrefecimento', categoria: 'Motor', acao: 'troca', km: 40_000, meses: 24,
    obs: 'Use o aditivo indicado pela Hyundai, misturado com água desmineralizada. Confira o nível do reservatório todo mês.',
  },

  // Freios
  {
    componente: 'fluido-freio', nome: 'Fluido de freio', categoria: 'Freios', acao: 'troca', meses: 24,
    obs: 'DOT 3 ou DOT 4. Ele absorve umidade com o tempo e perde eficiência. O manual só pede inspeção.',
  },
  {
    componente: 'discos-pastilhas', nome: 'Pastilhas, discos e lonas de freio', categoria: 'Freios', acao: 'inspecao',
    km: 10_000, meses: 12, fonte: 'manual', obs: 'As pastilhas costumam durar de 20.000 a 40.000 km, depende do uso.',
  },

  // Suspensão e pneus
  {
    componente: 'suspensao', nome: 'Suspensão e amortecedores', categoria: 'Suspensão e pneus', acao: 'inspecao',
    km: 10_000, meses: 12, obs: 'Barulho em buraco ou carro "boiando" são sinais de amortecedor gasto.',
  },
  {
    componente: 'alinhamento', nome: 'Alinhamento e balanceamento', categoria: 'Suspensão e pneus', acao: 'servico',
    km: 10_000, meses: 12, obs: 'Faça antes se o carro puxar para um lado ou o volante vibrar.',
  },
  { componente: 'rodizio-pneus', nome: 'Rodízio de pneus', categoria: 'Suspensão e pneus', acao: 'servico', km: 10_000 },
  {
    componente: 'pneus', nome: 'Pneus', categoria: 'Suspensão e pneus', acao: 'troca', meses: 60,
    obs: 'Ou antes, quando chegar no indicador de desgaste (TWI, 1,6 mm). Calibre a cada 15 dias.',
  },

  // Transmissão
  {
    componente: 'oleo-cambio', nome: 'Óleo do câmbio manual', categoria: 'Transmissão', acao: 'troca', km: 60_000, meses: 48,
    obs: 'O manual só pede inspeção, mas a troca entre 60.000 e 100.000 km é o comum. Troque também se o carro passar por alagamento.',
  },

  // Elétrica
  {
    componente: 'bateria', nome: 'Bateria', categoria: 'Elétrica', acao: 'troca', meses: 60,
    obs: 'Moura com 5 anos de validade. Se a partida ficar fraca antes disso, peça um teste de carga.',
  },

  // Conforto
  {
    componente: 'filtro-cabine', nome: 'Filtro do ar-condicionado (cabine)', categoria: 'Conforto', acao: 'troca', km: 10_000, meses: 12,
    obs: 'Troque antes se o ar tiver cheiro ruim. O manual pede a cada 20.000 km.',
  },
  { componente: 'palhetas', nome: 'Palhetas do limpador', categoria: 'Conforto', acao: 'troca', meses: 12 },
];

export const CATALOGO: ItemPlano[] = linhas.map((l) => ({
  ...l,
  id: `${l.componente}:${l.acao}${l.perfil ? `:${l.perfil}` : ''}`,
  fonte: l.fonte ?? 'boa_pratica',
  ativo: true,
}));

export const ESPECIFICACOES: { item: string; valor: string }[] = [
  { item: 'Óleo do motor', valor: 'SAE 5W30, API SN ou superior / ACEA A5. Cerca de 3,6 L com filtro.' },
  { item: 'Fluido de freio', valor: 'DOT 3 (manual). DOT 4 é compatível.' },
  { item: 'Distribuição', valor: 'Corrente (motor 1.6 Gamma). Não tem correia dentada para trocar.' },
  { item: 'Revisão', valor: 'Uma ida à oficina a cada 10.000 km ou 12 meses cobre quase tudo da lista.' },
];

export const CONDICOES_SEVERAS = [
  'Trajetos curtos e repetitivos ou pouco uso do veículo',
  'Muito tempo em marcha lenta',
  'Estradas de terra, poeira, lama ou cascalho',
  'Trânsito intenso / anda-e-para (mais de 50% do uso em cidade acima de 32 °C)',
  'Regiões montanhosas, com muitas subidas e descidas',
  'Reboque',
  'Uso comercial ou táxi/aplicativo',
];

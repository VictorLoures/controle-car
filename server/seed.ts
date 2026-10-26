import { CATALOGO } from '../shared/catalogo';
import type { Dados, ServicoFeito } from '../shared/tipos';

const GRUPO_COMPRA = 'compra-2025-11';
const GRUPO_PRESUMIDO = 'presumido-compra-2025-11';

const FEITO_NA_COMPRA: Omit<ServicoFeito, 'grupoId'>[] = [
  { componente: 'oleo-motor', acao: 'troca' },
  { componente: 'fluido-freio', acao: 'troca' },
  { componente: 'discos-pastilhas', acao: 'troca' },
];

/** Sem histórico real: o resto do plano conta como feito na compra, para todos os itens terem de onde contar. */
function presumidosNaCompra(): ServicoFeito[] {
  const feitos = new Set(FEITO_NA_COMPRA.map((s) => s.componente));
  const vistos = new Set<string>();
  return CATALOGO.filter((i) => !feitos.has(i.componente) && !vistos.has(i.componente) && vistos.add(i.componente))
    .map((i) => ({ grupoId: GRUPO_PRESUMIDO, componente: i.componente, acao: i.acao }));
}

/** Estado inicial da planilha: o plano e o histórico conhecido do carro. */
export function dadosIniciais(): Dados {
  return {
    veiculo: {
      modelo: 'Hyundai HB20S 1.6 Flex',
      ano: 2018,
      dataInicio: '2018-01-01',
      cambio: 'manual',
      perfilUso: 'normal',
      kmAlerta: 1_000,
      diasAlerta: 30,
    },
    leituras: [
      { data: '2025-11-01', km: 68_000 },
      { data: '2026-10-26', km: 73_000 },
    ],
    itens: CATALOGO.map((i) => ({ ...i })),
    revisoes: [
      {
        grupoId: GRUPO_COMPRA,
        data: '2025-11-01',
        km: 68_000,
        obs: 'Feita na compra do carro (dia aproximado). Sistema de freio todo revisado.',
      },
      {
        grupoId: GRUPO_PRESUMIDO,
        data: '2025-11-01',
        km: 68_000,
        obs: 'PRESUMIDO: sem histórico do dono anterior, considerado como feito na compra só para começar a contar.',
      },
    ],
    servicos: [...FEITO_NA_COMPRA.map((s) => ({ grupoId: GRUPO_COMPRA, ...s })), ...presumidosNaCompra()],
  };
}

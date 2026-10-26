import { describe, expect, it } from 'vitest';
import { dadosIniciais } from '../server/seed';
import { calcularLinha, calcularPainel, faixaKm, kmPorDia, ultimaBase } from './calculo';
import { somarMeses } from './datas';
import type { Acao, Dados, ItemPlano } from './tipos';

const HOJE = '2026-10-26';

function linha(dados: Dados, id: string, hoje = HOJE) {
  const item = dados.itens.find((i) => i.id === id);
  if (!item) throw new Error(`item ${id} não existe`);
  return calcularLinha(item, dados, hoje);
}

function comRevisao(dados: Dados, data: string, km: number, acoes: Acao[], componente: string): Dados {
  const grupoId = `g-${data}-${componente}`;
  return {
    ...dados,
    leituras: [...dados.leituras, { data, km }],
    revisoes: [...dados.revisoes, { grupoId, data, km }],
    servicos: [...dados.servicos, ...acoes.map((acao) => ({ grupoId, componente, acao }))],
  };
}

/** Dados iniciais com itens extras, para testar regras que o catálogo atual não usa. */
function comItens(...extras: Partial<ItemPlano>[]): Dados {
  const base = dadosIniciais();
  const itens = extras.map((e) => ({
    componente: 'teste',
    nome: 'Item de teste',
    categoria: 'Teste',
    acao: 'troca' as Acao,
    fonte: 'manual' as const,
    ativo: true,
    ...e,
    id: e.id ?? `${e.componente ?? 'teste'}:${e.acao ?? 'troca'}${e.perfil ? `:${e.perfil}` : ''}`,
  }));
  return { ...base, itens: [...base.itens, ...itens] };
}

describe('somarMeses', () => {
  it('limita ao último dia do mês', () => {
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2025-11-01', 12)).toBe('2026-11-01');
  });
});

describe('kmPorDia', () => {
  it('usa a primeira e a última leitura', () => {
    expect(kmPorDia([{ data: '2026-01-01', km: 1000 }, { data: '2026-01-11', km: 1500 }])).toBe(50);
  });
  it('não estima com uma leitura só', () => {
    expect(kmPorDia([{ data: '2026-01-01', km: 1000 }])).toBeUndefined();
  });
});

describe('faixaKm', () => {
  const leituras = [
    { data: '2025-11-01', km: 68_000 },
    { data: '2026-08-06', km: 72_000 },
    { data: '2026-10-26', km: 73_000 },
  ];
  it('fica entre a leitura anterior e a seguinte', () => {
    expect(faixaKm(leituras, '2026-05-30')).toEqual({ minimo: 68_000, maximo: 72_000 });
  });
  it('não tem máximo depois da última leitura', () => {
    expect(faixaKm(leituras, '2026-10-27')).toEqual({ minimo: 73_000, maximo: undefined });
  });
});

describe('estado inicial do HB20S', () => {
  const dados = dadosIniciais();

  it('óleo vence por tempo antes do km e aparece como próximo', () => {
    const l = linha(dados, 'oleo-motor:troca');
    expect(l.kmLimite).toBe(78_000);
    expect(l.dataLimite).toBe('2026-11-01');
    expect(l.dataPrevista).toBe('2026-11-01');
    expect(l.status).toBe('proximo');
  });

  it('óleo fica vencido quando passa a data', () => {
    expect(linha(dados, 'oleo-motor:troca', '2026-11-01').status).toBe('vencido');
  });

  it('fluido de freio trocado na compra vence em 2 anos', () => {
    const l = linha(dados, 'fluido-freio:troca');
    expect(l.dataLimite).toBe('2027-11-01');
    expect(l.status).toBe('em_dia');
  });

  it('itens sem histórico contam como feitos na compra', () => {
    expect(calcularPainel(dados, HOJE).filter((l) => l.status === 'sem_registro')).toEqual([]);
    const l = linha(dados, 'liquido-arrefecimento:troca');
    expect(l.base).toEqual({ data: '2025-11-01', km: 68_000, origem: 'registro' });
    expect(l.dataLimite).toBe('2027-11-01');
  });

  it('item nunca registrado fica sem registro', () => {
    expect(linha(comItens({ componente: 'novo' }), 'novo:troca').status).toBe('sem_registro');
  });

  it('troca de pastilhas conta como base da inspeção', () => {
    const l = linha(dados, 'discos-pastilhas:inspecao');
    expect(l.base).toEqual({ data: '2025-11-01', km: 68_000, origem: 'registro' });
  });

  it('painel começa pelos vencidos', () => {
    const painel = calcularPainel(dados, HOJE);
    const ordem = { vencido: 0, proximo: 1, sem_registro: 2, em_dia: 3 };
    for (let i = 1; i < painel.length; i++) {
      expect(ordem[painel[i].status]).toBeGreaterThanOrEqual(ordem[painel[i - 1].status]);
    }
  });

  it('troca de óleo hoje leva o próximo vencimento para 83.000 km / 10-2027', () => {
    const l = linha(comRevisao(dados, '2026-10-26', 73_000, ['troca'], 'oleo-motor'), 'oleo-motor:troca');
    expect(l.kmLimite).toBe(83_000);
    expect(l.dataLimite).toBe('2027-10-26');
    expect(l.status).toBe('em_dia');
  });
});

describe('regras de base', () => {
  const doisTipos = comItens(
    { componente: 'filtro', acao: 'inspecao', km: 10_000, meses: 12 },
    { componente: 'filtro', acao: 'troca', km: 40_000, meses: 48 },
  );

  it('inspeção não zera a linha de troca', () => {
    const dados = comRevisao(doisTipos, '2026-10-26', 73_000, ['inspecao'], 'filtro');
    expect(linha(dados, 'filtro:inspecao').kmLimite).toBe(83_000);
    expect(linha(dados, 'filtro:troca').status).toBe('sem_registro');
  });

  it('troca zera troca e inspeção do componente', () => {
    const dados = comRevisao(doisTipos, '2026-10-26', 73_000, ['troca'], 'filtro');
    expect(linha(dados, 'filtro:inspecao').kmLimite).toBe(83_000);
    expect(linha(dados, 'filtro:troca').kmLimite).toBe(113_000);
  });

  it('usa o registro mais recente quando há vários', () => {
    const base = dadosIniciais();
    const item = base.itens.find((i) => i.id === 'oleo-motor:troca') as ItemPlano;
    const dados = comRevisao(base, '2026-05-10', 71_000, ['troca'], 'oleo-motor');
    expect(ultimaBase(item, dados.revisoes, dados.servicos)).toEqual({ data: '2026-05-10', km: 71_000 });
  });

  it('primeiro intervalo conta a partir do carro novo até haver troca registrada', () => {
    const dados = comItens({ componente: 'arrefecimento', primeiroKm: 100_000, primeiroMeses: 60, km: 40_000, meses: 24 });
    const antes = linha(dados, 'arrefecimento:troca');
    expect(antes.base?.origem).toBe('inicio');
    expect(antes.dataLimite).toBe('2023-01-01');
    expect(antes.status).toBe('vencido');

    const depois = linha(comRevisao(dados, '2026-10-26', 73_000, ['troca'], 'arrefecimento'), 'arrefecimento:troca');
    expect(depois.kmLimite).toBe(113_000);
    expect(depois.dataLimite).toBe('2028-10-26');
  });
});

describe('perfil severo', () => {
  it('reduz o intervalo do óleo para 5.000 km / 6 meses', () => {
    const base = dadosIniciais();
    const dados: Dados = { ...base, veiculo: { ...base.veiculo, perfilUso: 'severo' } };
    const l = linha(dados, 'oleo-motor:troca');
    expect(l.kmLimite).toBe(73_000);
    expect(l.dataLimite).toBe('2026-05-01');
    expect(l.status).toBe('vencido');
  });

  it('linha exclusiva do perfil severo não entra no painel normal', () => {
    const dados = comItens({ componente: 'so-severo', perfil: 'severo', km: 1_000 });
    expect(calcularPainel(dados, HOJE).map((l) => l.item.id)).not.toContain('so-severo:troca:severo');
    const severo: Dados = { ...dados, veiculo: { ...dados.veiculo, perfilUso: 'severo' } };
    expect(calcularPainel(severo, HOJE).map((l) => l.item.id)).toContain('so-severo:troca:severo');
  });
});

describe('alerta e previsão', () => {
  it('entra em próximo pelo km restante', () => {
    const base = dadosIniciais();
    const dados: Dados = { ...base, leituras: [...base.leituras, { data: '2026-10-27', km: 77_200 }] };
    const l = linha(dados, 'oleo-motor:troca', '2026-10-27');
    expect(l.kmRestante).toBe(800);
    expect(l.status).toBe('proximo');
  });

  it('prevê a data pelo ritmo de km quando o km vence antes do tempo', () => {
    const base = dadosIniciais();
    // 1.000 km a cada 10 dias a partir da troca de óleo
    const dados = comRevisao(
      { ...base, leituras: [{ data: '2026-10-01', km: 70_000 }] },
      '2026-10-11', 71_000, ['troca'], 'oleo-motor',
    );
    const l = linha(dados, 'oleo-motor:troca', '2026-10-11');
    expect(l.kmLimite).toBe(81_000);
    expect(l.dataPrevista).toBe('2027-01-19');
    expect(l.dataPrevista! < l.dataLimite!).toBe(true);
  });
});

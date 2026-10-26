import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RepositorioXlsx } from './repositorioXlsx';
import { dadosIniciais } from './seed';

describe('RepositorioXlsx', () => {
  let pasta: string;
  let repo: RepositorioXlsx;

  beforeEach(async () => {
    pasta = await mkdtemp(join(tmpdir(), 'controle-car-'));
    repo = new RepositorioXlsx(join(pasta, 'teste.xlsx'));
    await repo.iniciar();
  });

  afterEach(() => rm(pasta, { recursive: true, force: true }));

  it('cria a planilha com os dados iniciais e lê de volta igual', async () => {
    expect(await repo.carregar()).toEqual(JSON.parse(JSON.stringify(dadosIniciais())));
  });

  it('não sobrescreve uma planilha existente', async () => {
    expect(await repo.iniciar()).toBe(false);
  });

  it('registra uma revisão com serviços e leitura de km', async () => {
    const r = await repo.registrarRevisao({
      data: '2026-10-26',
      km: 73_100,
      oficina: 'Oficina do Zé',
      custo: 350.5,
      servicos: [
        { componente: 'oleo-motor', acao: 'troca' },
        { componente: 'filtro-ar-motor', acao: 'inspecao' },
      ],
    });
    const dados = await repo.carregar();
    expect(dados.revisoes).toContainEqual(r);
    expect(dados.servicos.filter((s) => s.grupoId === r.grupoId)).toHaveLength(2);
    expect(dados.leituras).toContainEqual({ data: '2026-10-26', km: 73_100 });
  });

  it('remove a revisão e os serviços dela', async () => {
    const r = await repo.registrarRevisao({ data: '2026-10-26', km: 73_000, servicos: [{ componente: 'velas', acao: 'troca' }] });
    expect(await repo.removerRevisao(r.grupoId)).toBe(true);
    const dados = await repo.carregar();
    expect(dados.revisoes.some((x) => x.grupoId === r.grupoId)).toBe(false);
    expect(dados.servicos.some((x) => x.grupoId === r.grupoId)).toBe(false);
  });

  it('gravações simultâneas não se perdem', async () => {
    await Promise.all([
      repo.adicionarLeitura({ data: '2026-10-27', km: 73_050 }),
      repo.adicionarLeitura({ data: '2026-10-28', km: 73_120 }),
      repo.atualizarVeiculo({ perfilUso: 'severo' }),
    ]);
    const dados = await repo.carregar();
    expect(dados.leituras.map((l) => l.km)).toEqual(expect.arrayContaining([73_050, 73_120]));
    expect(dados.veiculo.perfilUso).toBe('severo');
  });
});

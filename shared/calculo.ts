import { diasEntre, somarDias, somarMeses } from './datas';
import type { Dados, ItemPlano, LeituraKm, LinhaStatus, PerfilUso, Revisao, ServicoFeito, Status } from './tipos';

const ORDEM_STATUS: Record<Status, number> = { vencido: 0, proximo: 1, sem_registro: 2, em_dia: 3 };

function ordenarLeituras(leituras: LeituraKm[]): LeituraKm[] {
  return [...leituras].sort((a, b) => a.data.localeCompare(b.data) || a.km - b.km);
}

export function kmAtual(leituras: LeituraKm[]): number {
  return leituras.reduce((max, l) => Math.max(max, l.km), 0);
}

/** Média de km rodados por dia entre a primeira e a última leitura. */
export function kmPorDia(leituras: LeituraKm[]): number | undefined {
  const ordenadas = ordenarLeituras(leituras);
  if (ordenadas.length < 2) return undefined;
  const primeira = ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];
  const dias = diasEntre(primeira.data, ultima.data);
  const km = ultima.km - primeira.km;
  if (dias <= 0 || km <= 0) return undefined;
  return km / dias;
}

/**
 * Km aceitável numa data, para o hodômetro nunca andar para trás:
 * pelo menos o maior km lido até essa data e no máximo o menor km lido depois dela.
 */
export function faixaKm(leituras: LeituraKm[], data: string): { minimo: number; maximo?: number } {
  let minimo = 0;
  let maximo: number | undefined;
  for (const l of leituras) {
    if (l.data <= data) minimo = Math.max(minimo, l.km);
    else maximo = Math.min(maximo ?? Infinity, l.km);
  }
  return { minimo, maximo };
}

export function itensAplicaveis(itens: ItemPlano[], perfil: PerfilUso): ItemPlano[] {
  return itens.filter((i) => i.ativo && (!i.perfil || i.perfil === perfil));
}

export function intervalo(item: ItemPlano, perfil: PerfilUso): { km?: number; meses?: number } {
  if (perfil === 'severo' && (item.severoKm != null || item.severoMeses != null)) {
    return { km: item.severoKm, meses: item.severoMeses };
  }
  return { km: item.km, meses: item.meses };
}

/**
 * Último serviço que serve de base para a linha do plano.
 * Uma inspeção só conta para linhas de inspeção; troca/serviço contam para todas as linhas do componente.
 */
export function ultimaBase(
  item: ItemPlano,
  revisoes: Revisao[],
  servicos: ServicoFeito[],
): { data: string; km: number } | undefined {
  const porGrupo = new Map(revisoes.map((r) => [r.grupoId, r]));
  let base: Revisao | undefined;
  for (const s of servicos) {
    if (s.componente !== item.componente) continue;
    if (s.acao === 'inspecao' && item.acao !== 'inspecao') continue;
    const r = porGrupo.get(s.grupoId);
    if (!r) continue;
    if (!base || r.data > base.data || (r.data === base.data && r.km > base.km)) base = r;
  }
  return base && { data: base.data, km: base.km };
}

export function calcularLinha(item: ItemPlano, dados: Dados, hoje: string): LinhaStatus {
  const { veiculo } = dados;
  const atual = kmAtual(dados.leituras);
  const ritmo = kmPorDia(dados.leituras);

  let { km, meses } = intervalo(item, veiculo.perfilUso);
  const registro = ultimaBase(item, dados.revisoes, dados.servicos);
  let base: LinhaStatus['base'];
  if (registro) {
    base = { ...registro, origem: 'registro' };
  } else if (item.primeiroKm != null || item.primeiroMeses != null) {
    base = { data: veiculo.dataInicio, km: 0, origem: 'inicio' };
    km = item.primeiroKm;
    meses = item.primeiroMeses;
  } else {
    return { item, status: 'sem_registro' };
  }

  const kmLimite = km != null ? base.km + km : undefined;
  const dataLimite = meses != null ? somarMeses(base.data, meses) : undefined;

  let dataPrevista = dataLimite;
  if (kmLimite != null && ritmo) {
    const estimada = somarDias(hoje, Math.max(0, Math.ceil((kmLimite - atual) / ritmo)));
    if (!dataPrevista || estimada < dataPrevista) dataPrevista = estimada;
  }

  const kmRestante = kmLimite != null ? kmLimite - atual : undefined;
  const diasRestantes = dataPrevista ? diasEntre(hoje, dataPrevista) : undefined;

  let status: Status = 'em_dia';
  if ((kmRestante != null && kmRestante <= 0) || (dataLimite != null && dataLimite <= hoje)) {
    status = 'vencido';
  } else if (
    (kmRestante != null && kmRestante <= veiculo.kmAlerta) ||
    (diasRestantes != null && diasRestantes <= veiculo.diasAlerta)
  ) {
    status = 'proximo';
  }

  return { item, status, base, kmLimite, dataLimite, dataPrevista, kmRestante, diasRestantes };
}

/** Status de todas as linhas aplicáveis, da mais urgente para a menos urgente. */
export function calcularPainel(dados: Dados, hoje: string): LinhaStatus[] {
  return itensAplicaveis(dados.itens, dados.veiculo.perfilUso)
    .map((item) => calcularLinha(item, dados, hoje))
    .sort(
      (a, b) =>
        ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status] ||
        (a.diasRestantes ?? Infinity) - (b.diasRestantes ?? Infinity) ||
        a.item.nome.localeCompare(b.item.nome, 'pt-BR'),
    );
}

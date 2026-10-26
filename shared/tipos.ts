/** troca = substituir peça/fluido; inspecao = verificar; servico = procedimento (rodízio, alinhamento). */
export type Acao = 'troca' | 'inspecao' | 'servico';
export type Fonte = 'manual' | 'boa_pratica';
export type PerfilUso = 'normal' | 'severo';
export type Status = 'vencido' | 'proximo' | 'sem_registro' | 'em_dia';

/**
 * Uma linha do plano de manutenção. Um mesmo componente pode ter mais de uma linha
 * (ex.: filtro de ar — inspeciona a cada 10.000 km, troca a cada 40.000 km).
 */
export interface ItemPlano {
  id: string;
  componente: string;
  nome: string;
  categoria: string;
  acao: Acao;
  km?: number;
  meses?: number;
  /** Primeiro intervalo contado a partir do carro novo (ex.: líquido de arrefecimento). */
  primeiroKm?: number;
  primeiroMeses?: number;
  /** Intervalos para uso severo, quando o manual define. */
  severoKm?: number;
  severoMeses?: number;
  /** Quando definido, a linha só vale para esse perfil de uso. */
  perfil?: PerfilUso;
  fonte: Fonte;
  obs?: string;
  ativo: boolean;
}

export interface Veiculo {
  modelo: string;
  ano: number;
  /** Data de início de uso do carro (base dos itens com primeiro intervalo). */
  dataInicio: string;
  cambio: 'manual' | 'automatico';
  perfilUso: PerfilUso;
  kmAlerta: number;
  diasAlerta: number;
}

/** Datas sempre em ISO `AAAA-MM-DD`. */
export interface LeituraKm {
  data: string;
  km: number;
}

/** Uma ida à oficina (ou serviço feito em casa), que agrupa vários serviços. */
export interface Revisao {
  grupoId: string;
  data: string;
  km: number;
  oficina?: string;
  custo?: number;
  obs?: string;
}

export interface ServicoFeito {
  grupoId: string;
  componente: string;
  acao: Acao;
}

export interface Dados {
  veiculo: Veiculo;
  leituras: LeituraKm[];
  itens: ItemPlano[];
  revisoes: Revisao[];
  servicos: ServicoFeito[];
}

export interface LinhaStatus {
  item: ItemPlano;
  status: Status;
  /** De onde a contagem parte: último serviço registrado ou o carro novo. */
  base?: { data: string; km: number; origem: 'registro' | 'inicio' };
  kmLimite?: number;
  dataLimite?: string;
  /** Data mais cedo entre o limite por tempo e a estimativa de quando o km limite será atingido. */
  dataPrevista?: string;
  kmRestante?: number;
  diasRestantes?: number;
}

export interface Estado {
  dados: Dados;
  painel: LinhaStatus[];
  kmAtual: number;
  kmPorMes?: number;
  hoje: string;
}

export interface NovaRevisao {
  data: string;
  km: number;
  oficina?: string;
  custo?: number;
  obs?: string;
  servicos: { componente: string; acao: Acao }[];
}

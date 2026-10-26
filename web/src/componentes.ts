import type { Acao, ItemPlano } from '../../shared/tipos';

export interface Componente {
  id: string;
  nome: string;
  categoria: string;
  /** Ação "de fazer" do componente (troca ou serviço). Componentes só de inspeção usam troca. */
  acaoFazer: Exclude<Acao, 'inspecao'>;
  temInspecao: boolean;
}

/** Agrupa as linhas do plano por componente, na ordem do catálogo. */
export function listarComponentes(itens: ItemPlano[]): Componente[] {
  const mapa = new Map<string, Componente>();
  for (const item of itens) {
    if (!item.ativo) continue;
    let c = mapa.get(item.componente);
    if (!c) {
      c = { id: item.componente, nome: item.nome, categoria: item.categoria, acaoFazer: 'troca', temInspecao: false };
      mapa.set(item.componente, c);
    }
    if (item.acao === 'inspecao') c.temInspecao = true;
    else c.acaoFazer = item.acao;
  }
  return [...mapa.values()];
}

export function porCategoria<T extends { categoria: string }>(lista: T[]): [string, T[]][] {
  const grupos = new Map<string, T[]>();
  for (const x of lista) {
    const g = grupos.get(x.categoria) ?? [];
    g.push(x);
    grupos.set(x.categoria, g);
  }
  return [...grupos.entries()];
}

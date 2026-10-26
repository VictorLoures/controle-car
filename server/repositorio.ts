import type { Dados, LeituraKm, NovaRevisao, Revisao, Veiculo } from '../shared/tipos';

/**
 * Acesso aos dados. Hoje a implementação é a planilha local (`RepositorioXlsx`);
 * para hospedar, basta outra implementação (SQLite, Postgres...) com a mesma interface.
 */
export interface Repositorio {
  carregar(): Promise<Dados>;
  adicionarLeitura(leitura: LeituraKm): Promise<void>;
  registrarRevisao(nova: NovaRevisao): Promise<Revisao>;
  removerRevisao(grupoId: string): Promise<boolean>;
  atualizarVeiculo(mudancas: Partial<Veiculo>): Promise<Veiculo>;
}

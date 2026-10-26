import type { Estado, NovaRevisao, Revisao, Veiculo } from '../../shared/tipos';

async function requisitar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const resp = await fetch(`/api${caminho}`, {
    ...opcoes,
    cache: 'no-store',
    headers: opcoes.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!resp.ok) {
    const corpo = await resp.json().catch(() => null);
    throw new Error(corpo?.erro ?? `Erro ${resp.status} ao falar com o servidor.`);
  }
  const texto = await resp.text();
  return (texto ? JSON.parse(texto) : undefined) as T;
}

export const api = {
  estado: () => requisitar<Estado>('/estado'),
  adicionarLeitura: (data: string, km: number) =>
    requisitar<void>('/leituras', { method: 'POST', body: JSON.stringify({ data, km }) }),
  registrarRevisao: (nova: NovaRevisao) =>
    requisitar<Revisao>('/revisoes', { method: 'POST', body: JSON.stringify(nova) }),
  removerRevisao: (grupoId: string) =>
    requisitar<void>(`/revisoes/${encodeURIComponent(grupoId)}`, { method: 'DELETE' }),
  atualizarVeiculo: (mudancas: Partial<Veiculo>) =>
    requisitar<Veiculo>('/veiculo', { method: 'PATCH', body: JSON.stringify(mudancas) }),
};

import type { Acao, ItemPlano, PerfilUso, Status } from '../../shared/tipos';
import { intervalo } from '../../shared/calculo';

export const ROTULO_STATUS: Record<Status, string> = {
  vencido: 'Vencido',
  proximo: 'Próximo',
  sem_registro: 'Sem registro',
  em_dia: 'Em dia',
};

export const ROTULO_ACAO: Record<Acao, string> = { troca: 'Trocar', inspecao: 'Inspecionar', servico: 'Fazer' };
export const ROTULO_ACAO_FEITA: Record<Acao, string> = { troca: 'Troca', inspecao: 'Inspeção', servico: 'Serviço' };

export function km(valor: number | undefined): string {
  return valor == null ? '—' : `${valor.toLocaleString('pt-BR')} km`;
}

export function data(iso: string | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function mesAno(iso: string | undefined): string {
  if (!iso) return '—';
  const [a, m] = iso.split('-');
  return `${m}/${a}`;
}

export function moeda(valor: number | undefined): string {
  return valor == null ? '—' : valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function prazo(dias: number | undefined): string {
  if (dias == null) return '';
  if (dias < 0) return `há ${-dias} dia${dias === -1 ? '' : 's'}`;
  if (dias === 0) return 'hoje';
  if (dias < 60) return `em ${dias} dia${dias === 1 ? '' : 's'}`;
  return `em ~${Math.round(dias / 30.44)} meses`;
}

function meses(n: number): string {
  if (n % 12 === 0) return `${n / 12} ano${n === 12 ? '' : 's'}`;
  return `${n} meses`;
}

/** "10.000 km ou 1 ano" */
export function textoIntervalo(i: { km?: number; meses?: number }): string {
  const partes = [i.km != null ? km(i.km) : null, i.meses != null ? meses(i.meses) : null].filter(Boolean);
  return partes.length ? partes.join(' ou ') : '—';
}

export function intervaloDoItem(item: ItemPlano, perfil: PerfilUso): string {
  const atual = textoIntervalo(intervalo(item, perfil));
  if (item.primeiroKm != null || item.primeiroMeses != null) {
    return `1ª: ${textoIntervalo({ km: item.primeiroKm, meses: item.primeiroMeses })}; depois ${atual}`;
  }
  return atual;
}

/** Minúsculas e sem acento, para busca. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

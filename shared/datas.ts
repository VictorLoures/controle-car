// Datas tratadas como dia de calendário (sem fuso): ISO `AAAA-MM-DD` <-> Date em UTC.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;

export function dataValida(iso: string): boolean {
  if (!ISO.test(iso)) return false;
  return formatarIso(paraDate(iso)) === iso;
}

export function paraDate(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export function formatarIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Soma meses mantendo o dia, limitado ao último dia do mês (31/01 + 1 mês = 28/02). */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return formatarIso(alvo);
}

export function somarDias(iso: string, dias: number): string {
  return formatarIso(new Date(paraDate(iso).getTime() + dias * DIA_MS));
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((paraDate(ate).getTime() - paraDate(de).getTime()) / DIA_MS);
}

/** Hoje no fuso local da máquina. */
export function hojeIso(agora = new Date()): string {
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${m}-${d}`;
}

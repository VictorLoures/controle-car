import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import ExcelJS from 'exceljs';
import { formatarIso, paraDate } from '../shared/datas';
import type { Acao, Dados, Fonte, ItemPlano, LeituraKm, NovaRevisao, PerfilUso, Revisao, Veiculo } from '../shared/tipos';
import type { Repositorio } from './repositorio';
import { dadosIniciais } from './seed';

/*
 * Layout da planilha — uma aba por "tabela", com cabeçalho na linha 1.
 * As colunas são lidas pelo nome do cabeçalho, então dá para reordenar no LibreOffice.
 */
const ABAS = {
  veiculo: ['chave', 'valor'],
  leituras_km: ['data', 'km'],
  itens: [
    'id', 'componente', 'nome', 'categoria', 'acao', 'km', 'meses', 'primeiro_km', 'primeiro_meses',
    'severo_km', 'severo_meses', 'perfil', 'fonte', 'obs', 'ativo',
  ],
  revisoes: ['grupo_id', 'data', 'km', 'oficina', 'custo', 'obs'],
  servicos: ['grupo_id', 'componente', 'acao'],
} as const;

const CAMPOS_VEICULO: Record<keyof Veiculo, string> = {
  modelo: 'modelo',
  ano: 'ano',
  dataInicio: 'data_inicio',
  cambio: 'cambio',
  perfilUso: 'perfil_uso',
  kmAlerta: 'km_alerta',
  diasAlerta: 'dias_alerta',
};

const COLUNAS_DATA = new Set(['data']);
const FORMATO_DATA = 'dd/mm/yyyy';
const FORMATO_KM = '#,##0';
const FORMATO_MOEDA = '"R$" #,##0.00';

type Registro = Record<string, unknown>;

// ---------- leitura de células ----------

function texto(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v === 'object' && v !== null && 'richText' in v) {
    return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join('');
  }
  if (typeof v === 'object' && v !== null && 'result' in v) return texto((v as { result: unknown }).result);
  return String(v).trim() || undefined;
}

function numero(v: unknown): number | undefined {
  if (typeof v === 'object' && v !== null && 'result' in v) return numero((v as { result: unknown }).result);
  if (v == null || v === '') return undefined;
  if (typeof v === 'number') return v;
  // Texto digitado no formato brasileiro: "73.000" ou "1.234,56".
  let t = String(v).trim().replace(/^R\$\s*/, '');
  if (t.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? n : undefined;
}

/** Aceita data de célula (Date), ISO (`2025-11-01`) ou digitada (`01/11/2025`). */
function data(v: unknown): string | undefined {
  if (v instanceof Date) return formatarIso(v);
  const t = texto(v);
  if (!t) return undefined;
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : undefined;
}

function booleano(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const t = texto(v)?.toLowerCase();
  return t == null || !['nao', 'não', 'n', 'false', '0'].includes(t);
}

function lerAba(wb: ExcelJS.Workbook, nome: string): Registro[] {
  const ws = wb.getWorksheet(nome);
  if (!ws) throw new Error(`A planilha não tem a aba "${nome}".`);
  const cabecalho: string[] = [];
  ws.getRow(1).eachCell((c, col) => {
    cabecalho[col] = texto(c.value) ?? '';
  });
  const registros: Registro[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const reg: Registro = {};
    let vazio = true;
    row.eachCell((c, col) => {
      const chave = cabecalho[col];
      if (!chave) return;
      reg[chave] = c.value;
      if (c.value != null && c.value !== '') vazio = false;
    });
    if (!vazio) registros.push(reg);
  });
  return registros;
}

// ---------- conversão planilha <-> Dados ----------

function paraDados(wb: ExcelJS.Workbook): Dados {
  const padrao = dadosIniciais().veiculo;
  const kv = new Map(lerAba(wb, 'veiculo').map((r) => [texto(r.chave), r.valor]));
  const veiculo: Veiculo = {
    modelo: texto(kv.get(CAMPOS_VEICULO.modelo)) ?? padrao.modelo,
    ano: numero(kv.get(CAMPOS_VEICULO.ano)) ?? padrao.ano,
    dataInicio: data(kv.get(CAMPOS_VEICULO.dataInicio)) ?? padrao.dataInicio,
    cambio: texto(kv.get(CAMPOS_VEICULO.cambio)) === 'automatico' ? 'automatico' : 'manual',
    perfilUso: texto(kv.get(CAMPOS_VEICULO.perfilUso)) === 'severo' ? 'severo' : 'normal',
    kmAlerta: numero(kv.get(CAMPOS_VEICULO.kmAlerta)) ?? padrao.kmAlerta,
    diasAlerta: numero(kv.get(CAMPOS_VEICULO.diasAlerta)) ?? padrao.diasAlerta,
  };

  const leituras: LeituraKm[] = lerAba(wb, 'leituras_km').flatMap((r) => {
    const d = data(r.data);
    const km = numero(r.km);
    return d && km != null ? [{ data: d, km }] : [];
  });

  const itens: ItemPlano[] = lerAba(wb, 'itens').flatMap((r) => {
    const componente = texto(r.componente);
    const acao = texto(r.acao) as Acao | undefined;
    if (!componente || !acao) return [];
    const perfil = texto(r.perfil) as PerfilUso | undefined;
    return [{
      id: texto(r.id) ?? `${componente}:${acao}${perfil ? `:${perfil}` : ''}`,
      componente,
      nome: texto(r.nome) ?? componente,
      categoria: texto(r.categoria) ?? 'Outros',
      acao,
      km: numero(r.km),
      meses: numero(r.meses),
      primeiroKm: numero(r.primeiro_km),
      primeiroMeses: numero(r.primeiro_meses),
      severoKm: numero(r.severo_km),
      severoMeses: numero(r.severo_meses),
      perfil,
      fonte: (texto(r.fonte) as Fonte | undefined) ?? 'manual',
      obs: texto(r.obs),
      ativo: booleano(r.ativo),
    }];
  });

  const revisoes: Revisao[] = lerAba(wb, 'revisoes').flatMap((r) => {
    const grupoId = texto(r.grupo_id);
    const d = data(r.data);
    const km = numero(r.km);
    if (!grupoId || !d || km == null) return [];
    return [{ grupoId, data: d, km, oficina: texto(r.oficina), custo: numero(r.custo), obs: texto(r.obs) }];
  });

  const servicos = lerAba(wb, 'servicos').flatMap((r) => {
    const grupoId = texto(r.grupo_id);
    const componente = texto(r.componente);
    const acao = texto(r.acao) as Acao | undefined;
    return grupoId && componente && acao ? [{ grupoId, componente, acao }] : [];
  });

  return { veiculo, leituras, itens, revisoes, servicos };
}

function escreverAba(wb: ExcelJS.Workbook, nome: keyof typeof ABAS, linhas: Registro[], formatos: Record<string, string> = {}) {
  const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = ABAS[nome].map((key) => ({
    header: key,
    key,
    width: key === 'nome' || key === 'obs' ? 48 : Math.max(12, key.length + 2),
    style: formatos[key] ? { numFmt: formatos[key] } : undefined,
  }));
  ws.getRow(1).font = { bold: true };
  for (const linha of linhas) {
    const valores: Registro = {};
    for (const [k, v] of Object.entries(linha)) {
      valores[k] = COLUNAS_DATA.has(k) && typeof v === 'string' ? paraDate(v) : v;
    }
    ws.addRow(valores);
  }
}

function paraWorkbook(dados: Dados): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'controle-car';

  const { veiculo } = dados;
  escreverAba(
    wb,
    'veiculo',
    (Object.keys(CAMPOS_VEICULO) as (keyof Veiculo)[]).map((k) => ({
      chave: CAMPOS_VEICULO[k],
      valor: k === 'dataInicio' ? paraDate(veiculo[k]) : veiculo[k],
    })),
  );
  // Data de início vem como Date: aplica o formato só nessa célula.
  wb.getWorksheet('veiculo')!.eachRow((row) => {
    if (row.getCell(1).value === CAMPOS_VEICULO.dataInicio) row.getCell(2).numFmt = FORMATO_DATA;
  });

  const leituras = [...dados.leituras].sort((a, b) => a.data.localeCompare(b.data) || a.km - b.km);
  escreverAba(wb, 'leituras_km', leituras.map((l) => ({ data: l.data, km: l.km })), {
    data: FORMATO_DATA,
    km: FORMATO_KM,
  });

  escreverAba(
    wb,
    'itens',
    dados.itens.map((i) => ({
      id: i.id,
      componente: i.componente,
      nome: i.nome,
      categoria: i.categoria,
      acao: i.acao,
      km: i.km,
      meses: i.meses,
      primeiro_km: i.primeiroKm,
      primeiro_meses: i.primeiroMeses,
      severo_km: i.severoKm,
      severo_meses: i.severoMeses,
      perfil: i.perfil,
      fonte: i.fonte,
      obs: i.obs,
      ativo: i.ativo ? 'sim' : 'nao',
    })),
    { km: FORMATO_KM, primeiro_km: FORMATO_KM, severo_km: FORMATO_KM },
  );

  escreverAba(
    wb,
    'revisoes',
    [...dados.revisoes]
      .sort((a, b) => a.data.localeCompare(b.data) || a.km - b.km)
      .map((r) => ({ grupo_id: r.grupoId, data: r.data, km: r.km, oficina: r.oficina, custo: r.custo, obs: r.obs })),
    { data: FORMATO_DATA, km: FORMATO_KM, custo: FORMATO_MOEDA },
  );

  escreverAba(
    wb,
    'servicos',
    dados.servicos.map((s) => ({ grupo_id: s.grupoId, componente: s.componente, acao: s.acao })),
  );

  return wb;
}

// ---------- repositório ----------

export class RepositorioXlsx implements Repositorio {
  /** Fila para que gravações nunca se sobreponham. */
  private fila: Promise<unknown> = Promise.resolve();

  constructor(private readonly caminho: string) {}

  /** Cria a planilha com o plano do manual e o histórico conhecido, se ela ainda não existir. */
  async iniciar(): Promise<boolean> {
    if (existsSync(this.caminho)) return false;
    await mkdir(dirname(this.caminho), { recursive: true });
    await this.salvar(dadosIniciais());
    return true;
  }

  async carregar(): Promise<Dados> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(this.caminho);
    return paraDados(wb);
  }

  adicionarLeitura(leitura: LeituraKm): Promise<void> {
    return this.alterar((dados) => {
      dados.leituras.push(leitura);
    });
  }

  registrarRevisao(nova: NovaRevisao): Promise<Revisao> {
    return this.alterar((dados) => {
      const revisao: Revisao = {
        grupoId: `${nova.data}-${randomUUID().slice(0, 8)}`,
        data: nova.data,
        km: nova.km,
        oficina: nova.oficina,
        custo: nova.custo,
        obs: nova.obs,
      };
      dados.revisoes.push(revisao);
      for (const s of nova.servicos) dados.servicos.push({ grupoId: revisao.grupoId, ...s });
      // O km da revisão também é uma leitura do hodômetro.
      if (!dados.leituras.some((l) => l.data === nova.data && l.km === nova.km)) {
        dados.leituras.push({ data: nova.data, km: nova.km });
      }
      return revisao;
    });
  }

  removerRevisao(grupoId: string): Promise<boolean> {
    return this.alterar((dados) => {
      const antes = dados.revisoes.length;
      dados.revisoes = dados.revisoes.filter((r) => r.grupoId !== grupoId);
      dados.servicos = dados.servicos.filter((s) => s.grupoId !== grupoId);
      return dados.revisoes.length < antes;
    });
  }

  atualizarVeiculo(mudancas: Partial<Veiculo>): Promise<Veiculo> {
    return this.alterar((dados) => {
      dados.veiculo = { ...dados.veiculo, ...mudancas };
      return dados.veiculo;
    });
  }

  private alterar<T>(fn: (dados: Dados) => T): Promise<T> {
    const tarefa = this.fila.then(async () => {
      const dados = await this.carregar();
      const resultado = fn(dados);
      await this.salvar(dados);
      return resultado;
    });
    this.fila = tarefa.catch(() => undefined);
    return tarefa;
  }

  /** Grava num arquivo temporário e renomeia, para não corromper a planilha se algo falhar no meio. */
  private async salvar(dados: Dados): Promise<void> {
    const tmp = `${this.caminho}.tmp`;
    await paraWorkbook(dados).xlsx.writeFile(tmp);
    await rename(tmp, this.caminho);
  }
}

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { calcularPainel, faixaKm, kmAtual, kmPorDia } from '../shared/calculo';
import { dataValida, hojeIso } from '../shared/datas';
import type { Acao, Estado, LeituraKm, NovaRevisao, Veiculo } from '../shared/tipos';
import { RepositorioXlsx } from './repositorioXlsx';

const RAIZ = resolve(import.meta.dirname, '..');
const PLANILHA = process.env.PLANILHA ?? join(RAIZ, 'data', 'controle-car.xlsx');
const PORTA = Number(process.env.PORT ?? 3001);
const ACOES: Acao[] = ['troca', 'inspecao', 'servico'];

class ErroValidacao extends Error {}

function exigir(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new ErroValidacao(mensagem);
}

function kmValido(km: unknown): km is number {
  return typeof km === 'number' && Number.isInteger(km) && km >= 0 && km < 2_000_000;
}

function exigirKmNaOrdem(leituras: LeituraKm[], data: string, km: number) {
  const { minimo, maximo } = faixaKm(leituras, data);
  const fmt = (n: number) => `${n.toLocaleString('pt-BR')} km`;
  exigir(
    km >= minimo && (maximo == null || km <= maximo),
    maximo == null
      ? `Nessa data o km tem que ser pelo menos ${fmt(minimo)} (já há uma leitura anterior com esse valor).`
      : `Nessa data o km tem que ficar entre ${fmt(minimo)} e ${fmt(maximo)}, pelas leituras antes e depois dela.`,
  );
}

function textoOpcional(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

const repo = new RepositorioXlsx(PLANILHA);
if (await repo.iniciar()) console.log(`Planilha criada em ${PLANILHA}`);

const app = express();
app.use(express.json());

app.get('/api/estado', async (_req, res) => {
  const dados = await repo.carregar();
  const hoje = hojeIso();
  const porDia = kmPorDia(dados.leituras);
  const estado: Estado = {
    dados,
    painel: calcularPainel(dados, hoje),
    kmAtual: kmAtual(dados.leituras),
    kmPorMes: porDia != null ? Math.round(porDia * 30.44) : undefined,
    hoje,
  };
  res.json(estado);
});

app.post('/api/leituras', async (req, res) => {
  const { data, km } = req.body ?? {};
  exigir(typeof data === 'string' && dataValida(data), 'Data inválida.');
  exigir(data <= hojeIso(), 'A data não pode ser no futuro.');
  exigir(kmValido(km), 'Km inválido.');
  const { leituras } = await repo.carregar();
  exigirKmNaOrdem(leituras, data, km);
  await repo.adicionarLeitura({ data, km });
  res.status(201).end();
});

app.post('/api/revisoes', async (req, res) => {
  const body = req.body ?? {};
  exigir(typeof body.data === 'string' && dataValida(body.data), 'Data inválida.');
  exigir(body.data <= hojeIso(), 'A data não pode ser no futuro.');
  exigir(kmValido(body.km), 'Km inválido.');
  exigir(body.custo == null || (typeof body.custo === 'number' && body.custo >= 0), 'Custo inválido.');
  exigir(Array.isArray(body.servicos) && body.servicos.length > 0, 'Selecione pelo menos um item.');

  const { itens, leituras } = await repo.carregar();
  exigirKmNaOrdem(leituras, body.data, body.km);
  const componentes = new Set(itens.map((i) => i.componente));
  for (const s of body.servicos) {
    exigir(componentes.has(s?.componente), `Item desconhecido: ${s?.componente}`);
    exigir(ACOES.includes(s?.acao), `Ação inválida: ${s?.acao}`);
  }

  const nova: NovaRevisao = {
    data: body.data,
    km: body.km,
    oficina: textoOpcional(body.oficina),
    custo: body.custo ?? undefined,
    obs: textoOpcional(body.obs),
    servicos: body.servicos.map((s: { componente: string; acao: Acao }) => ({ componente: s.componente, acao: s.acao })),
  };
  res.status(201).json(await repo.registrarRevisao(nova));
});

app.delete('/api/revisoes/:grupoId', async (req, res) => {
  const removida = await repo.removerRevisao(req.params.grupoId);
  res.status(removida ? 204 : 404).end();
});

app.patch('/api/veiculo', async (req, res) => {
  const body = req.body ?? {};
  const mudancas: Partial<Veiculo> = {};
  if (body.perfilUso !== undefined) {
    exigir(body.perfilUso === 'normal' || body.perfilUso === 'severo', 'Perfil de uso inválido.');
    mudancas.perfilUso = body.perfilUso;
  }
  if (body.kmAlerta !== undefined) {
    exigir(kmValido(body.kmAlerta), 'Alerta de km inválido.');
    mudancas.kmAlerta = body.kmAlerta;
  }
  if (body.diasAlerta !== undefined) {
    exigir(Number.isInteger(body.diasAlerta) && body.diasAlerta >= 0, 'Alerta de dias inválido.');
    mudancas.diasAlerta = body.diasAlerta;
  }
  res.json(await repo.atualizarVeiculo(mudancas));
});

// Em produção (`npm start`) o próprio servidor entrega o front já compilado.
const DIST = join(RAIZ, 'dist', 'web');
if (process.env.NODE_ENV === 'production' && existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(DIST, 'index.html')));
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ErroValidacao) {
    res.status(400).json({ erro: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro ao acessar a planilha. Ela está aberta e bloqueada em outro programa?' });
});

app.listen(PORTA, () => {
  console.log(`API em http://localhost:${PORTA} — planilha: ${PLANILHA}`);
});

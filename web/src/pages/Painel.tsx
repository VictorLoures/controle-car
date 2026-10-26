import { useMemo, useState } from 'react';
import type { Acao, Estado, LinhaStatus, PerfilUso, Status } from '../../../shared/tipos';
import { api } from '../api';
import type { Preselecao } from '../App';
import * as fmt from '../formato';

interface Props {
  estado: Estado;
  aoMudar: () => Promise<void>;
  aoRegistrar: (selecao: Preselecao) => void;
}

const STATUS: Status[] = ['vencido', 'proximo', 'sem_registro', 'em_dia'];
const PENDENTES: Status[] = ['vencido', 'proximo', 'sem_registro'];

export function Painel({ estado, aoMudar, aoRegistrar }: Props) {
  const [filtro, setFiltro] = useState<Status | 'todos'>('todos');
  const [busca, setBusca] = useState('');

  const contagem = useMemo(() => {
    const c = { vencido: 0, proximo: 0, sem_registro: 0, em_dia: 0 };
    for (const l of estado.painel) c[l.status]++;
    return c;
  }, [estado.painel]);

  const perfil = estado.dados.veiculo.perfilUso;
  const pendentes = estado.painel.filter((l) => PENDENTES.includes(l.status));
  const termo = fmt.normalizar(busca.trim());
  const linhas = estado.painel.filter(
    (l) =>
      (filtro === 'todos' || l.status === filtro) &&
      (!termo || fmt.normalizar(`${l.item.nome} ${l.item.categoria}`).includes(termo)),
  );
  const filtrando = filtro !== 'todos' || termo !== '';

  return (
    <div className="pilha">
      <AtualizarKm estado={estado} aoMudar={aoMudar} />

      <section className="contadores" aria-label="Filtrar por situação">
        <button
          className={`contador contador-todos ${filtro === 'todos' ? 'selecionado' : ''}`}
          onClick={() => setFiltro('todos')}
          aria-pressed={filtro === 'todos'}
        >
          <span className="contador-numero">{estado.painel.length}</span>
          <span className="contador-rotulo">Todos</span>
        </button>
        {STATUS.map((s) => (
          <button
            key={s}
            className={`contador status-${s} ${filtro === s ? 'selecionado' : ''}`}
            onClick={() => setFiltro(filtro === s ? 'todos' : s)}
            aria-pressed={filtro === s}
          >
            <span className="contador-numero">{contagem[s]}</span>
            <span className="contador-rotulo">{fmt.ROTULO_STATUS[s]}</span>
          </button>
        ))}
      </section>

      {pendentes.length > 0 && <ProximaRevisao pendentes={pendentes} hoje={estado.hoje} perfil={perfil} aoRegistrar={aoRegistrar} />}

      <section className="cartao">
        <div className="cartao-titulo">
          <div>
            <h2>{filtro === 'todos' ? 'Todos os itens' : fmt.ROTULO_STATUS[filtro]}</h2>
            {filtrando && (
              <button
                className="link"
                onClick={() => {
                  setFiltro('todos');
                  setBusca('');
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
          <input
            type="search"
            className="busca"
            placeholder="Buscar item… (ex.: óleo, freio)"
            aria-label="Buscar item"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="tabela-rolagem">
          <table className="tabela tabela-painel">
            <thead>
              <tr>
                <th>Item</th>
                <th>Status</th>
                <th>Última vez</th>
                <th>Próximo km</th>
                <th>Próxima data</th>
                <th>Previsão</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <LinhaItem key={l.item.id} linha={l} perfil={perfil} aoRegistrar={aoRegistrar} />
              ))}
            </tbody>
          </table>
          {linhas.length === 0 && <p className="vazio">Nenhum item encontrado.</p>}
        </div>
      </section>
    </div>
  );
}

function AtualizarKm({ estado, aoMudar }: { estado: Estado; aoMudar: () => Promise<void> }) {
  const [km, setKm] = useState('');
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);
  const ultima = [...estado.dados.leituras].sort((a, b) => a.data.localeCompare(b.data)).at(-1);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = Number(km.replace(/\D/g, ''));
    if (!valor) return;
    setSalvando(true);
    try {
      await api.adicionarLeitura(estado.hoje, valor);
      setKm('');
      setErro(undefined);
      await aoMudar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="cartao destaque-km">
      <div>
        <span className="rotulo">Hodômetro</span>
        <div className="km-atual">{fmt.km(estado.kmAtual)}</div>
        <small className="sutil">
          Lido em {fmt.data(ultima?.data)}
          {estado.kmPorMes ? ` · média de ${estado.kmPorMes.toLocaleString('pt-BR')} km/mês` : ''}
        </small>
      </div>
      <form className="form-km" onSubmit={salvar}>
        <label htmlFor="km-novo">Atualizar km</label>
        <div className="linha-form">
          <input
            id="km-novo"
            inputMode="numeric"
            placeholder={estado.kmAtual.toLocaleString('pt-BR')}
            value={km}
            onChange={(e) => setKm(e.target.value)}
          />
          <button className="botao" disabled={salvando || !km}>Salvar</button>
        </div>
        {erro && <small className="texto-erro">{erro}</small>}
      </form>
    </section>
  );
}

function ProximaRevisao({ pendentes, hoje, perfil, aoRegistrar }: {
  pendentes: LinhaStatus[];
  hoje: string;
  perfil: PerfilUso;
  aoRegistrar: (s: Preselecao) => void;
}) {
  // Se a troca do componente já está pendente, a inspeção dele fica redundante na lista.
  const comTroca = new Set(pendentes.filter((l) => l.item.acao !== 'inspecao').map((l) => l.item.componente));
  const lista = pendentes.filter((l) => l.item.acao !== 'inspecao' || !comTroca.has(l.item.componente));
  const grupos: [Acao, LinhaStatus[]][] = (['troca', 'servico', 'inspecao'] as Acao[])
    .map((a): [Acao, LinhaStatus[]] => [a, lista.filter((l) => l.item.acao === a)])
    .filter(([, ls]) => ls.length > 0);

  const registrarTodos = () => {
    const selecao: Preselecao = {};
    for (const l of pendentes) {
      // Se o componente tem troca e inspeção pendentes, a troca cobre as duas.
      if (selecao[l.item.componente] && l.item.acao === 'inspecao') continue;
      selecao[l.item.componente] = l.item.acao;
    }
    aoRegistrar(selecao);
  };

  return (
    <section className="cartao">
      <div className="cartao-titulo">
        <div>
          <h2>Para a próxima revisão</h2>
          <p className="sutil">
            Itens vencidos, perto de vencer ou sem nenhum registro. Leve essa lista para a oficina. Os sem registro
            começam a ser contados assim que você registrar a primeira vez.
          </p>
        </div>
        <button className="botao" onClick={registrarTodos}>Registrar como feito…</button>
      </div>
      <div className="checklist">
        {grupos.map(([acao, ls]) => (
          <div key={acao}>
            <h3>{fmt.ROTULO_ACAO[acao]}</h3>
            <ul>
              {ls.map((l) => (
                <li key={l.item.id}>
                  <span className={`ponto status-${l.status}`} aria-hidden />
                  <span>{l.item.nome}</span>
                  <small className="sutil">
                    {l.status === 'sem_registro'
                      ? `sem registro · a cada ${fmt.intervaloDoItem(l.item, perfil)}`
                      : resumoVencimento(l, hoje)}
                  </small>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function resumoVencimento(l: LinhaStatus, hoje: string): string {
  const partes: string[] = [];
  if (l.kmRestante != null) partes.push(l.kmRestante <= 0 ? `${fmt.km(-l.kmRestante)} atrasado` : `faltam ${fmt.km(l.kmRestante)}`);
  if (l.dataLimite) partes.push(`${l.dataLimite <= hoje ? 'venceu em' : 'até'} ${fmt.data(l.dataLimite)}`);
  return partes.join(' · ');
}

function LinhaItem({ linha: l, perfil, aoRegistrar }: {
  linha: LinhaStatus;
  perfil: PerfilUso;
  aoRegistrar: (s: Preselecao) => void;
}) {
  const intervalo = fmt.intervaloDoItem(l.item, perfil);
  return (
    <tr>
      <td data-rotulo="Item">
        <div className="item-nome">
          <span>{l.item.nome}</span>
          <small className="sutil">a cada {intervalo}</small>
          <span className="etiquetas">
            <span className={`etiqueta acao-${l.item.acao}`}>{fmt.ROTULO_ACAO[l.item.acao]}</span>
            <span className="etiqueta">{l.item.categoria}</span>
          </span>
        </div>
      </td>
      <td data-rotulo="Status">
        <span className={`selo status-${l.status}`}>{fmt.ROTULO_STATUS[l.status]}</span>
      </td>
      <td data-rotulo="Última vez">
        {l.base?.origem === 'registro' ? (
          <>
            {fmt.data(l.base.data)}
            <br />
            <small className="sutil">{fmt.km(l.base.km)}</small>
          </>
        ) : l.base?.origem === 'inicio' ? (
          <small className="sutil">nunca (conta do carro novo)</small>
        ) : (
          <small className="sutil">nunca registrado</small>
        )}
      </td>
      {l.status === 'sem_registro' ? (
        <td data-rotulo="Próximo" colSpan={3} className="dica-sem-registro">
          <small className="sutil">
            Registre a última vez que fez (data e km aproximados servem) ou faça na próxima revisão para começar a contar.
          </small>
        </td>
      ) : (
        <>
          <td data-rotulo="Próximo km">
            {fmt.km(l.kmLimite)}
            {l.kmRestante != null && (
              <>
                <br />
                <small className={l.kmRestante <= 0 ? 'texto-erro' : 'sutil'}>
                  {l.kmRestante <= 0 ? `passou ${fmt.km(-l.kmRestante)}` : `faltam ${fmt.km(l.kmRestante)}`}
                </small>
              </>
            )}
          </td>
          <td data-rotulo="Próxima data">{fmt.data(l.dataLimite)}</td>
          <td data-rotulo="Previsão">
            {l.dataPrevista ? (
              <>
                {fmt.mesAno(l.dataPrevista)}
                <br />
                <small className="sutil">{fmt.prazo(l.diasRestantes)}</small>
              </>
            ) : (
              '—'
            )}
          </td>
        </>
      )}
      <td className="coluna-acao">
        <button className="botao secundario pequeno" onClick={() => aoRegistrar({ [l.item.componente]: l.item.acao })}>
          Registrar
        </button>
      </td>
    </tr>
  );
}

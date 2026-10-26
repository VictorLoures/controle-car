import { useMemo, useState } from 'react';
import type { Estado } from '../../../shared/tipos';
import { api } from '../api';
import { listarComponentes } from '../componentes';
import * as fmt from '../formato';

interface Props {
  estado: Estado;
  aoMudar: () => Promise<void>;
}

export function Historico({ estado, aoMudar }: Props) {
  const { revisoes, servicos, itens } = estado.dados;
  const componentes = useMemo(() => listarComponentes(itens), [itens]);
  const nomes = useMemo(() => new Map(componentes.map((c) => [c.id, c.nome])), [componentes]);
  const [filtro, setFiltro] = useState('');
  const [erro, setErro] = useState<string>();

  const lista = useMemo(() => {
    return [...revisoes]
      .sort((a, b) => b.data.localeCompare(a.data) || b.km - a.km)
      .map((r) => ({ revisao: r, servicos: servicos.filter((s) => s.grupoId === r.grupoId) }))
      .filter((x) => !filtro || x.servicos.some((s) => s.componente === filtro));
  }, [revisoes, servicos, filtro]);

  const total = lista.reduce((soma, x) => soma + (x.revisao.custo ?? 0), 0);

  const remover = async (grupoId: string, data: string) => {
    if (!confirm(`Remover o registro de ${fmt.data(data)}? Isso não pode ser desfeito pelo app.`)) return;
    try {
      await api.removerRevisao(grupoId);
      await aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <div className="pilha">
      <section className="cartao">
        <div className="cartao-titulo">
          <div>
            <h2>Histórico</h2>
            <p className="sutil">
              {lista.length} registro{lista.length === 1 ? '' : 's'} · total gasto {fmt.moeda(total)}
            </p>
          </div>
          <label className="filtro">
            <span className="sr-only">Filtrar por item</span>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="">Todos os itens</option>
              {componentes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
        </div>
        {erro && <p className="texto-erro">{erro}</p>}
      </section>

      {lista.length === 0 && <p className="vazio">Nenhum registro{filtro ? ' para esse item' : ''} ainda.</p>}

      {lista.map(({ revisao: r, servicos: ss }) => (
        <article key={r.grupoId} className="cartao revisao">
          <header className="revisao-topo">
            <div>
              <strong>{fmt.data(r.data)}</strong>
              <span className="sutil"> · {fmt.km(r.km)}</span>
              {r.oficina && <span className="sutil"> · {r.oficina}</span>}
            </div>
            <div className="revisao-direita">
              {r.custo != null && <strong>{fmt.moeda(r.custo)}</strong>}
              <button className="link perigo" onClick={() => remover(r.grupoId, r.data)}>Remover</button>
            </div>
          </header>
          <ul className="chips">
            {ss.map((s) => (
              <li key={`${s.componente}-${s.acao}`} className={`chip acao-${s.acao}`}>
                {nomes.get(s.componente) ?? s.componente}
                <small> · {fmt.ROTULO_ACAO_FEITA[s.acao]}</small>
              </li>
            ))}
          </ul>
          {r.obs && <p className="sutil revisao-obs">{r.obs}</p>}
        </article>
      ))}
    </div>
  );
}

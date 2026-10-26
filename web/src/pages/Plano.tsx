import { useState } from 'react';
import { CONDICOES_SEVERAS, ESPECIFICACOES } from '../../../shared/catalogo';
import { itensAplicaveis } from '../../../shared/calculo';
import type { Estado, PerfilUso } from '../../../shared/tipos';
import { api } from '../api';
import { porCategoria } from '../componentes';
import * as fmt from '../formato';

interface Props {
  estado: Estado;
  aoMudar: () => Promise<void>;
}

export function Plano({ estado, aoMudar }: Props) {
  const { veiculo, itens } = estado.dados;
  const [erro, setErro] = useState<string>();
  const aplicaveis = itensAplicaveis(itens, veiculo.perfilUso);

  const mudarPerfil = async (perfilUso: PerfilUso) => {
    try {
      await api.atualizarVeiculo({ perfilUso });
      await aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <div className="pilha">
      <section className="cartao">
        <h2>Perfil de uso</h2>
        <div className="segmentado grande" role="radiogroup" aria-label="Perfil de uso">
          {(['normal', 'severo'] as PerfilUso[]).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={veiculo.perfilUso === p}
              className={veiculo.perfilUso === p ? 'ativo' : undefined}
              onClick={() => mudarPerfil(p)}
            >
              {p === 'normal' ? 'Normal' : 'Severo'}
            </button>
          ))}
        </div>
        {erro && <p className="texto-erro">{erro}</p>}
        <details className="detalhes">
          <summary>Quando o uso é severo, segundo o manual</summary>
          <ul>
            {CONDICOES_SEVERAS.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <p className="sutil">
            Em uso severo, o óleo passa para 5.000 km ou 6 meses. Filtro de ar, velas, freios, suspensão e filtro
            de cabine devem ser vistos com mais frequência.
          </p>
        </details>
      </section>

      <section className="cartao">
        <h2>Especificações</h2>
        <dl className="specs">
          {ESPECIFICACOES.map((e) => (
            <div key={e.item}>
              <dt>{e.item}</dt>
              <dd>{e.valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="cartao">
        <div className="cartao-titulo">
          <div>
            <h2>Plano de manutenção</h2>
            <p className="sutil">
              Intervalos de prática de mercado. Os marcados com "manual" batem com o manual Hyundai; nos outros, a
              observação diz o que o manual pede. Dá para ajustar tudo na aba <code>itens</code> da planilha.
            </p>
          </div>
        </div>
        {porCategoria(aplicaveis).map(([categoria, lista]) => (
          <div key={categoria} className="plano-categoria">
            <h3>{categoria}</h3>
            <table className="tabela tabela-plano">
              <tbody>
                {lista.map((i) => (
                  <tr key={i.id}>
                    <td data-rotulo="Item">
                      {i.nome}
                      {i.fonte === 'manual' && <span className="etiqueta manual">manual</span>}
                      {i.obs && <small className="sutil bloco">{i.obs}</small>}
                    </td>
                    <td data-rotulo="Ação">
                      <span className={`etiqueta acao-${i.acao}`}>{fmt.ROTULO_ACAO[i.acao]}</span>
                    </td>
                    <td data-rotulo="Intervalo" className="intervalo">{fmt.intervaloDoItem(i, veiculo.perfilUso)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  );
}

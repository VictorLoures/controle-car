import { useMemo, useState } from 'react';
import { faixaKm } from '../../../shared/calculo';
import type { Acao, Estado } from '../../../shared/tipos';
import { api } from '../api';
import type { Preselecao } from '../App';
import { listarComponentes, porCategoria } from '../componentes';
import * as fmt from '../formato';

interface Props {
  estado: Estado;
  preselecao: Preselecao;
  aoSalvar: () => Promise<void>;
}

export function RegistrarServico({ estado, preselecao, aoSalvar }: Props) {
  const componentes = useMemo(() => listarComponentes(estado.dados.itens), [estado.dados.itens]);
  const [data, setData] = useState(estado.hoje);
  const [km, setKm] = useState(String(estado.kmAtual));
  const [oficina, setOficina] = useState('');
  const [custo, setCusto] = useState('');
  const [obs, setObs] = useState('');
  const [selecao, setSelecao] = useState<Preselecao>(preselecao);
  const [busca, setBusca] = useState('');
  const termo = fmt.normalizar(busca.trim());
  // Os já marcados continuam visíveis mesmo fora da busca, para não sumirem da tela.
  const visiveis = componentes.filter(
    (c) => !termo || selecao[c.id] || fmt.normalizar(`${c.nome} ${c.categoria}`).includes(termo),
  );
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  const alternar = (id: string, acaoPadrao: Acao) =>
    setSelecao((s) => {
      const nova = { ...s };
      if (nova[id]) delete nova[id];
      else nova[id] = acaoPadrao;
      return nova;
    });

  const definirAcao = (id: string, acao: Acao) => setSelecao((s) => ({ ...s, [id]: acao }));

  const quantidade = Object.keys(selecao).length;
  const faixa = faixaKm(estado.dados.leituras, data);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const kmNum = Number(km.replace(/\D/g, ''));
    const custoNum = custo.trim() ? Number(custo.replace(/\./g, '').replace(',', '.')) : undefined;
    if (custoNum != null && !Number.isFinite(custoNum)) {
      setErro('Custo inválido. Use, por exemplo, 350,00.');
      return;
    }
    setSalvando(true);
    try {
      await api.registrarRevisao({
        data,
        km: kmNum,
        oficina,
        obs,
        custo: custoNum,
        servicos: Object.entries(selecao).map(([componente, acao]) => ({ componente, acao })),
      });
      await aoSalvar();
    } catch (err) {
      setErro((err as Error).message);
      setSalvando(false);
    }
  };

  return (
    <form className="pilha" onSubmit={salvar}>
      <section className="cartao">
        <h2>Registrar serviço</h2>
        <p className="sutil">
          Uma ida à oficina com tudo o que foi feito. O km informado também atualiza o hodômetro.
        </p>
        <div className="grade-form">
          <label>
            Data
            <input type="date" value={data} max={estado.hoje} onChange={(e) => setData(e.target.value)} required />
          </label>
          <label>
            Km no hodômetro
            <input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} required />
            <small className="dica-campo">
              {faixa.maximo != null
                ? `Nessa data: entre ${fmt.km(faixa.minimo)} e ${fmt.km(faixa.maximo)}`
                : `Nessa data: a partir de ${fmt.km(faixa.minimo)}`}
            </small>
          </label>
          <label>
            Oficina / onde
            <input value={oficina} onChange={(e) => setOficina(e.target.value)} placeholder="opcional" />
          </label>
          <label>
            Custo total (R$)
            <input inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="opcional" />
          </label>
          <label className="largura-total">
            Observações
            <textarea
              rows={2}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Marca do óleo, peças usadas, o que o mecânico disse…"
            />
          </label>
        </div>
      </section>

      <section className="cartao">
        <div className="cartao-titulo">
          <div>
            <h2>O que foi feito</h2>
            <span className="sutil">{quantidade} selecionado{quantidade === 1 ? '' : 's'}</span>
          </div>
          <input
            type="search"
            className="busca"
            placeholder="Buscar item…"
            aria-label="Buscar item"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {visiveis.length === 0 && <p className="vazio">Nenhum item encontrado.</p>}
        {porCategoria(visiveis).map(([categoria, lista]) => (
          <fieldset key={categoria} className="grupo-itens">
            <legend>{categoria}</legend>
            {lista.map((c) => {
              const marcado = selecao[c.id];
              return (
                <div key={c.id} className={`opcao-item ${marcado ? 'marcado' : ''}`}>
                  <label className="opcao-check">
                    <input type="checkbox" checked={!!marcado} onChange={() => alternar(c.id, c.acaoFazer)} />
                    <span>{c.nome}</span>
                  </label>
                  {marcado && (
                    <div className="segmentado" role="radiogroup" aria-label={`O que foi feito em ${c.nome}`}>
                      {([c.acaoFazer, 'inspecao'] as Acao[]).map((a) => (
                        <button
                          type="button"
                          key={a}
                          role="radio"
                          aria-checked={marcado === a}
                          className={marcado === a ? 'ativo' : undefined}
                          onClick={() => definirAcao(c.id, a)}
                        >
                          {fmt.ROTULO_ACAO_FEITA[a]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>
        ))}
      </section>

      <div className="barra-salvar">
        {erro && <span className="texto-erro">{erro}</span>}
        <button className="botao" disabled={salvando || quantidade === 0}>
          {salvando ? 'Salvando…' : `Salvar (${quantidade})`}
        </button>
      </div>
    </form>
  );
}

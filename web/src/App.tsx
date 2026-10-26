import { useCallback, useEffect, useState } from 'react';
import type { Acao, Estado } from '../../shared/tipos';
import { api } from './api';
import { Historico } from './pages/Historico';
import { Painel } from './pages/Painel';
import { Plano } from './pages/Plano';
import { RegistrarServico } from './pages/RegistrarServico';

const ABAS = [
  { id: 'painel', rotulo: 'Painel' },
  { id: 'registrar', rotulo: 'Registrar serviço' },
  { id: 'historico', rotulo: 'Histórico' },
  { id: 'plano', rotulo: 'Plano' },
] as const;

type Aba = (typeof ABAS)[number]['id'];

export type Preselecao = Record<string, Acao>;

function abaDoHash(): Aba {
  const h = location.hash.slice(1);
  return ABAS.some((a) => a.id === h) ? (h as Aba) : 'painel';
}

export function App() {
  const [aba, setAba] = useState<Aba>(abaDoHash);
  const [estado, setEstado] = useState<Estado>();
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [preselecao, setPreselecao] = useState<Preselecao>({});

  const recarregar = useCallback(async () => {
    try {
      setEstado(await api.estado());
      setErro(undefined);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    recarregar();
    const aoMudarHash = () => setAba(abaDoHash());
    // Ao voltar para a aba, relê os dados (a planilha pode ter sido editada no LibreOffice).
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') recarregar();
    };
    window.addEventListener('hashchange', aoMudarHash);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.removeEventListener('hashchange', aoMudarHash);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [recarregar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(undefined), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const irPara = (destino: Aba) => {
    location.hash = destino;
    window.scrollTo({ top: 0 });
  };

  const registrar = (selecao: Preselecao) => {
    setPreselecao(selecao);
    irPara('registrar');
  };

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <span className="marca-icone" aria-hidden>🔧</span>
          <div>
            <strong>Controle do Carro</strong>
            {estado && <small>{estado.dados.veiculo.modelo} · {estado.dados.veiculo.ano}</small>}
          </div>
        </div>
        <nav className="abas">
          {ABAS.map((a) => (
            <a key={a.id} href={`#${a.id}`} className={a.id === aba ? 'ativa' : undefined}>
              {a.rotulo}
            </a>
          ))}
        </nav>
      </header>

      <main>
        {erro && (
          <div className="alerta erro">
            <span>{erro}</span>
            <button className="botao secundario" onClick={recarregar}>Tentar de novo</button>
          </div>
        )}
        {!estado && !erro && <p className="carregando">Carregando…</p>}
        {estado && aba === 'painel' && <Painel estado={estado} aoMudar={recarregar} aoRegistrar={registrar} />}
        {estado && aba === 'registrar' && (
          <RegistrarServico
            key={JSON.stringify(preselecao)}
            estado={estado}
            preselecao={preselecao}
            aoSalvar={async () => {
              setPreselecao({});
              await recarregar();
              setAviso('Serviço registrado.');
              irPara('painel');
            }}
          />
        )}
        {estado && aba === 'historico' && <Historico estado={estado} aoMudar={recarregar} />}
        {estado && aba === 'plano' && <Plano estado={estado} aoMudar={recarregar} />}
      </main>

      {aviso && <div className="toast" role="status">{aviso}</div>}
    </div>
  );
}

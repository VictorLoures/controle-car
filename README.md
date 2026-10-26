# Controle do Carro

Controle de manutenção preventiva do HB20S 1.6 2018 (câmbio manual). Lista enxuta dos itens que importam, com intervalos
de prática de mercado (o manual Hyundai serve de referência; onde ele é otimista demais, como velas a 160.000 km, vale o mercado).

## Rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173 (API em :3001)
npm test         # testes do cálculo e da planilha
npm run build && npm start   # versão compilada, tudo em http://localhost:3001
```

Na primeira execução é criada a planilha `data/controle-car.xlsx` com o plano (`shared/catalogo.ts`) e o histórico conhecido.
Para usar outro arquivo: `PLANILHA=/caminho/arquivo.xlsx npm run dev`.

## A planilha

É o banco de dados por enquanto. Pode abrir e editar no LibreOffice, **com o app parado** ou sem salvar por cima enquanto ele grava.

| Aba | Conteúdo |
|---|---|
| `veiculo` | modelo, data de início de uso, perfil de uso (`normal`/`severo`), alertas (km e dias de antecedência) |
| `leituras_km` | data e km do hodômetro; o maior km é o atual, e a média km/mês sai daqui |
| `itens` | plano de manutenção: intervalos em km/meses, primeiro intervalo, intervalos de uso severo, `fonte` (`manual` se bate com o manual, `boa_pratica` se não), `ativo` (sim/nao) |
| `revisoes` | cada ida à oficina: data, km, oficina, custo, observações |
| `servicos` | o que foi feito em cada revisão (`grupo_id`, componente, `troca`/`inspecao`/`servico`) |

## Como o vencimento é calculado

- Cada linha do plano vence em **km ou meses, o que vier primeiro**, contando do último serviço registrado.
- Uma **troca** zera a troca e a inspeção do componente; uma **inspeção** só zera a inspeção.
- Item sem nenhum registro aparece como **sem registro**. Itens com `primeiro_km`/`primeiro_meses` contam o 1º intervalo do carro novo.
- **Próximo** = faltam menos de `km_alerta` km ou `dias_alerta` dias (pela data limite ou pela previsão feita com a média de km/mês).

## Estrutura

- `shared/`: tipos, catálogo de itens e cálculo (puro, testado)
- `server/`: API Express; o acesso a dados fica atrás da interface `Repositorio` (`repositorioXlsx.ts` hoje). Para hospedar, troque por SQLite/Postgres.
- `web/`: React + Vite

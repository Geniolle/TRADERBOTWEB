# Estrutura técnica do frontend

## Visão geral

Este documento descreve os ficheiros principais do frontend `TraderBotWeb`, separado do backend `Trader-Bot`.

A responsabilidade deste projeto é exclusivamente de interface, visualização, interação do utilizador e consumo da API/WebSocket do backend.

---

## Estrutura principal

```text
web/
  src/
    components/
    constants/
    hooks/
    pages/
    services/
    types/
    utils/
    App.tsx
    main.tsx
```

---

## Ficheiros principais

## web/src/main.tsx

**Função:**
Ponto de entrada da aplicação.

**Responsabilidade:**
Inicializa o React e monta a aplicação no browser.

**Usado por:**
Execução inicial do frontend.

**Entrada:**
Elemento root do HTML e componente principal da aplicação.

**Saída:**
Renderização da aplicação no DOM.

**Atenção:**
Mudanças aqui podem impedir a aplicação de arrancar.

---

## web/src/App.tsx

**Função:**
Componente principal do dashboard.

**Responsabilidade:**
Orquestra os cartões principais, filtros, gráfico, diagnóstico, runs, métricas e estratégias.

**Usado por:**
`web/src/main.tsx`

**Entrada:**
Estado global do dashboard, hooks e componentes visuais.

**Saída:**
Estrutura principal da interface renderizada.

**Atenção:**
Mudanças aqui afetam diretamente toda a composição visual do sistema.

---

## web/src/hooks/useCandles.ts

**Função:**
Gerir carregamento e atualização de candles.

**Responsabilidade:**
Buscar candles por HTTP, normalizar dados e suportar atualização incremental.

**Usado por:**
Fluxo do gráfico e dashboard.

**Entrada:**
Símbolo, timeframe, parâmetros do gráfico e estado do feed.

**Saída:**
Coleção de candles pronta para renderização.

**Atenção:**
É um ficheiro sensível. Deve preservar o último snapshot válido em caso de erro transitório.

---

## web/src/hooks/useRealtimeFeed.ts

**Função:**
Controlar o feed em tempo real.

**Responsabilidade:**
Abrir WebSocket, gerir refreshes e atualizar o estado do gráfico em tempo real.

**Usado por:**
Fluxo do dashboard e do gráfico.

**Entrada:**
Símbolo, timeframe e eventos do backend.

**Saída:**
Atualizações de feed, candles e estados visuais.

**Atenção:**
Não deve provocar limpeza do gráfico quando o feed parar temporariamente.

---

## web/src/hooks/useCandlestickChart.ts

**Função:**
Gerir a integração com a biblioteca de gráfico.

**Responsabilidade:**
Configurar e atualizar o gráfico de candles.

**Usado por:**
`CandlesChartCard.tsx`

**Entrada:**
Candles, configurações visuais e eventos de atualização.

**Saída:**
Estado e renderização do gráfico.

**Atenção:**
Mudanças aqui afetam diretamente o comportamento visual do gráfico.

---

## web/src/components/chart/CandlesChartCard.tsx

**Função:**
Renderizar o cartão principal do gráfico.

**Responsabilidade:**
Mostrar candles, preço atual, estado do feed e indicadores visuais.

**Usado por:**
`App.tsx`

**Entrada:**
Candles, preço, estado do provider, timeframe e símbolo.

**Saída:**
Bloco visual do gráfico no dashboard.

**Atenção:**
Deve manter o último snapshot válido sempre que a atualização seguinte for inválida.

---

## web/src/components/diagnostics/ChartDiagnosticsCard.tsx

**Função:**
Mostrar diagnóstico técnico do gráfico/feed.

**Responsabilidade:**
Exibir estados como cobertura insuficiente, erro do provider, ausência de atualização e outros avisos técnicos.

**Usado por:**
`App.tsx`

**Entrada:**
Estado do feed, cobertura, candles e metadados técnicos.

**Saída:**
Cartão de diagnóstico técnico.

**Atenção:**
O texto deste componente deve permanecer alinhado com a regra de manter o gráfico visível usando o último snapshot válido.

---

## web/src/components/runs/RunSummaryCard.tsx

**Função:**
Mostrar resumo de runs.

**Responsabilidade:**
Apresentar informação agregada sobre execução de runs.

**Usado por:**
Dashboard principal.

**Entrada:**
Dados de runs e métricas.

**Saída:**
Resumo visual das execuções.

**Atenção:**
É um componente sensível por concentrar muita informação operacional.

---

## web/src/services/buildStrategies.ts

**Função:**
Montar/apresentar estratégias no frontend.

**Responsabilidade:**
Transformar dados de estratégias para formato amigável na interface.

**Usado por:**
Listagem de estratégias e cartões relacionados.

**Entrada:**
Dados vindos da API.

**Saída:**
Estruturas adaptadas para UI.

**Atenção:**
Alterações podem quebrar a leitura correta de estratégias no frontend.

---

## web/src/pages/StageTestsPage.tsx

**Função:**
Página dedicada a Stage Tests.

**Responsabilidade:**
Permitir execução e visualização de testes por estágio na interface.

**Usado por:**
Navegação/página principal do frontend.

**Entrada:**
Filtros, parâmetros e respostas da API de stage tests.

**Saída:**
Página funcional de execução e análise.

**Atenção:**
Deve continuar separada da lógica de execução real, que pertence ao backend.

---

## Regras de arquitetura

### Separação de responsabilidades
- frontend: interface, interação e visualização
- backend: provider, sync, estratégia, persistência e execução

### Regra do gráfico
Quando houver:
- erro do provider
- cobertura insuficiente
- feed parado
- ausência momentânea de candles novos

o gráfico deve:
- manter o último snapshot válido
- não ser substituído por vazio
- mostrar aviso visual apropriado

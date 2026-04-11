# TraderBotWeb — Frontend

## Objetivo

Interface web do sistema Trader Bot.

Este projeto é responsável por:
- dashboard principal
- gráfico de candles
- filtros de mercado
- diagnóstico do feed
- listagem de estratégias
- runs, métricas, casos e histórico
- execução manual de Stage Tests
- atualização visual em tempo real

## Stack identificada

- React
- TypeScript
- Vite
- lightweight-charts

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

## Integração com backend

Configuração encontrada em `web/src/constants/config.ts`:

- HTTP base: `http://127.0.0.1:8000/api/v1`
- WebSocket base: `ws://127.0.0.1:8000/api/v1/ws`

## Regra importante do gráfico

O gráfico não deve desaparecer por erro transitório.

Quando:
- o provider falhar
- a cobertura for insuficiente
- o feed parar temporariamente

o frontend deve:
- manter o último snapshot válido
- manter o último candle válido visível
- mostrar o aviso visual correspondente
- evitar substituir o gráfico por vazio

## Como executar

A partir da pasta `web`:

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
npm run preview
```

## Documentação complementar

- `docs/ESTRUTURA_TECNICA_FRONTEND_TraderBotWeb.md`

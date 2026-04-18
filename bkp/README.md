# Backup Temporário

Esta pasta guarda ficheiros movidos durante a reorganização de `2026-04-17`.

Objetivo:
- preservar duplicados, legado e código fora do runtime atual;
- permitir revisão antes da remoção definitiva;
- manter o monorepo principal mais limpo.

Conteúdo:
- `root/`: manifestos antigos da raiz;
- `web/`: páginas/componentes/assets órfãos ou duplicados;
- `backend/`: rotas, serviços e schemas desligados do router atual;
- `generated/`: `__pycache__` e artefactos Python gerados localmente.

Regra prática:
- se algo aqui voltar a ser necessário, deve regressar ao projeto principal de forma explícita;
- se não houver necessidade após revisão, esta pasta pode ser apagada.

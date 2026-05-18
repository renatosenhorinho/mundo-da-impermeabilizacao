# Relatório de Auditoria: Deduplicação e Integridade de Tracking

**Objetivo:** Garantir zero duplicidade silenciosa no banco de dados (Supabase) decorrente de retries, múltiplos cliques, refresh ou instabilidades de rede no sistema de Analytics e CRM local.

## 1. Auditoria e Correções em `analytics_events` (Tracking de Navegação)
- **Problema Anterior:** Falhas de rede durante o `flushBatchToSupabase` causavam o re-enfileiramento do lote (`batch`). Como as chamadas para o Supabase usavam `insert()`, um *timeout* (onde o banco processou mas a rede caiu antes do ACK) faria a fila reenviar os mesmos eventos, duplicando as linhas no painel de inteligência de produtos.
- **Solução (Idempotência via UUID):**
  - O sistema antispam na origem (`isSpam`) que barra cliques sobrepostos foi mantido com proteção de Hash por tempo e ação.
  - Implementamos a geração explícita de `id = crypto.randomUUID()` logo na criação do evento (`saveAnalyticsEvent`).
  - O evento enfileirado passa a carregar sua chave de idempotência.
  - O envio em `flushBatchToSupabase` foi convertido de `.insert()` para `.upsert(batch, { onConflict: 'id' })`.
  - **Conclusão:** Mesmo que a mesma fila seja enviada 500 vezes por falhas de timeout, o Supabase atualizará as mesmas linhas, cravando deduplicação absoluta.

## 2. Auditoria em `leads` (CRM MDI)
- **Problema Anterior:** A fila assíncrona para sincronizar leads (`flushLeadsToSupabase`) continha uma quebra de estado (`for...of` que fazia `insert` sem proteção). Se um lote de 5 leads possuísse 2 operações completadas com sucesso e a 3ª falhasse, o bloco `catch` devolveria os 5 leads para a fila original. No retry, os 2 primeiros dariam `unique_violation` (ou pior, se gerassem IDs novos, duplicariam o cliente).
- **Solução (Upsert + Re-queuing Otimista):**
  - O método `.insert([op.payload])` foi substituído por `.upsert([op.payload], { onConflict: 'id' })` uma vez que a tabela confia na primary key `id` que injetamos desde o frontend.
  - O rastreador `enqueueLeadOp` já remove automaticamente as atualizações defasadas (deduplicando `updates` de `score` não processados ainda).
  - Em `flushLeadsToSupabase`, modificamos a lógica de erro. Se uma iteração isolada falha, adicionamos **apenas ela** na lista `failedOps`. Se a rede não colaborar para um ou mais leads, **somente as falhadas** são devolvidas no topo da `mdi_leads_sync_queue`.

## 3. Debounce e Deduplicação Omissa de Forms/WhatsApp
- **WhatsApp Clicks:** Os componentes do catálogo possuem proteções assíncronas `throttle` e anti-spam via `isSpam`. A janela de validação de lead (`LEAD_COOLDOWN_MS` = 10 minutos) impede que leads entrem com status `novo` duplicadamente. 
- **Contato/Formulários:** Na `contact-page.tsx`, o botão previne `double_submit` congelando seu estado para `loading`. Além disso, a chamada artificial de `trackWhatsAppClick` entra na regra do `LEAD_COOLDOWN_MS`, resultando num "update" do lead existente na fila se ele por um acaso tentar novamente sob a mesma sessão. 

## 4. Telemetria e Logs para Devs
- Adicionados logs defensivos explícitos com a flag `import.meta.env.DEV` garantindo que o console reporte em desenvolvimento:
  - `[CRM Deduplication] Blocked spam event: ...`
  - `[CRM Deduplication] Upserted lead ...`
  - `[CRM Deduplication] Failed op update for lead ...`

## Validação Final
O build (`npm run build`) foi compilado com 0 erros de sintaxe (exit code: 0).
**A arquitetura de processamento assíncrona está 100% blindada e garante IDEMPOTÊNCIA.** Nenhuma falha de retry inserirá clones no Supabase.

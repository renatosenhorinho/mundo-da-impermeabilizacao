# Relatório de Auditoria: Resiliência de Storage Local (Cache/Tracking)

**Objetivo:** Garantir a estabilidade de longo prazo do rastreamento de usuários (Analytics & CRM) protegendo o navegador contra o crescimento infinito de arrays no `localStorage`, evitando falhas de lentidão, estouro de memória (QuotaExceededError) ou perdas de Leads críticos causados pela estagnação da fila.

## 1. Problema Identificado
Antes da blindagem, a maioria das funções que gravavam no armazenamento temporário utilizavam chamadas brutas de `localStorage.setItem()`. 
As proteções em filas de eventos analíticos (`mdi_analytics_events`) e batches (`mdi_batch_queue`) até possuíam um slice primitivo. Porém, os registros vitais do CRM (como a lista inteira do histórico local `mdi_leads`) e atualizações constantes de timeline (`mdi_timeline`) e UTMs não possuíam blindagem contra a exceção `QuotaExceededError`. Em dispositivos móveis de baixo armazenamento, caso o iOS Safari atingisse sua cota rígida (geralmente ~5MB por domínio), o Tracking e o sistema de CRM "quebrariam", impedindo a captura de Leads reais para o banco de dados.

## 2. Implementação do `safeSetStorage`
Criamos um wrapper inteligente em `analytics.ts` que **intercepta 100% das gravações no Storage do usuário**.
- Se o limite de armazenamento for atingido (`QuotaExceededError` ou erro `22`), o sistema congela a gravação temporariamente.
- Ele dispara o gatilho rotineiro do `performEmergencyCleanup()`.
- Após a limpeza forçada das filas secundárias, ele refaz a inserção garantindo a persistência.

## 3. Rotação, Limites e TTL (Limpeza Inteligente por Fila)
A função `performEmergencyCleanup` age podando os arrays e garantindo priorização. Além disso, as rotinas básicas do engine também sofreram restrições de tamanho na origem:

### a) Prioridade Alta (Imunes a podas severas prévias)
- **`mdi_leads_sync_queue` (Fila do Supabase):** Nenhuma limpeza de segurança no storage é permitida apagar um Lead que ainda está tentando ser enviado para a Nuvem! Esta é a regra de ouro implementada.
- **`mdi_utms` e `mdi_behavior`:** São mantidos íntegros porque são pequenos objetos simples (`{...}`) que pesam menos de 1 KB juntos.
- **`mdi_last_wa_page` e Sessões:** Também são intocáveis (menos de 50 bytes).

### b) Prioridade Média/Baixa (Susceptíveis ao Limpador de Cota)
Caso a memória se esgote, ou o usuário possua dados residuais de 4 meses atrás, cortamos agressivamente (mantendo apenas o frescor da última sessão):
- **`mdi_timeline`:** Limitada por padrão a `200` itens no fluxo. Na emergência cai para `50`.
- **`mdi_analytics_events` (Histórico Bruto):** Limitado por padrão a `10.000`. Na emergência sofre uma poda violenta de 95%, caindo para apenas os **500 mais recentes**.
- **`mdi_batch_queue` (Lote pendente de Analytics):** Sofre _slice_ agressivo limitando-se aos últimos **500** em caso de emergência, descartando rastreamentos antigos para dar espaço a leads reais e navegações atuais.
- **`mdi_leads` (Histórico CRM Offline):** Restrito aos últimos **20 Leads** criados. Impede que o array de cache visual do cliente cresça para milhares, sendo que após convertido para o Supabase ele não tem utilidade local senão visualização temporal rápida.

## 4. Testes de Falha e Telemetria
- Em desenvolvimento (`npm run dev`), caso uma Limpeza de Emergência seja ativada, o console emitirá o alerta laranja: `[Storage] Performing emergency cleanup due to quota limits`.
- Se a limpeza não for suficiente e o `localStorage` falhar catastroficamente de forma estrita (como modo Safari restrito total), o sistema irá usar um *fallback* engolindo a exceção (`catch {}`) em vez de travar o App inteiro com uma tela em branco de falha não tratada de React. 

## 5. Build State
Build de produção (`npm run build`) via Vite finalizado com sucesso. Nenhuma quebra de tipo introduzida na refatoração assíncrona.

**Conclusão:**
O Tracking do Mundo da Impermeabilização se tornou independente de memória local ampla, operando via **buffer rotativo**, com Garbage Collection ativo sob demanda, focado em estabilidade vitalícia sem poluir ou exceder as permissões do browser do usuário.

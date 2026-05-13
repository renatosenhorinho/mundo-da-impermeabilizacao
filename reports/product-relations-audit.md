# Product Relations Audit (TEXT)
**Data/Hora:** 12/05/2026, 23:54:38

## Resumo
- **Total de Produtos:** 17
- **parent_id Vazio/Branco (String):** 0
- **Auto-referência (parent_id = id):** 0
- **Órfãos (parent_id inexistente em products.id):** 0
- **IDs Duplicados (Inconsistência Grave):** 0

## Detalhes

### 1. parent_id Vazio/Branco (String)
Esses produtos possuem `parent_id` string vazia ao invés de `NULL`.
- Nenhum

### 2. Auto-referência (parent_id = id)
Esses produtos apontam para si mesmos como parent.
- Nenhum

### 3. Órfãos (parent_id inexistente)
Esses produtos apontam para um parent_id que não existe mais no banco (`products.id`).
- Nenhum

### 4. IDs Duplicados
Produtos dividindo a mesma Primary/Unique Key de `id`.
- Nenhum

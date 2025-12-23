# Validação de Idade e Datas Padrão - Sistema de Aniversários

## 📋 Resumo da Implementação

Implementado sistema de **validação de idade mínima (18 anos)** combinado com **bloqueio de datas padrão** para o sistema de automação de mensagens de aniversário.

---

## 🎯 Objetivo

**Problema identificado:**
1. Clientes sem data de aniversário recebem datas padrão: `2000-01-01`, `1990-01-01`, `2024-01-01`, `2025-01-01`
2. Alguns clientes podem ter data de nascimento real, mas serem menores de 18 anos
3. Sistema não deve enviar mensagens para menores de idade ou datas inválidas

**Solução implementada:**
- ✅ Bloquear datas padrão conhecidas (lista configurável)
- ✅ Validar idade mínima de 18 anos automaticamente
- ✅ Cálculo dinâmico baseado no ano atual

---

## 🧮 Lógica de Validação

### **Idade Mínima Calculada Dinamicamente**

```javascript
const currentYear = new Date().getFullYear(); // Ex: 2025
const minBirthYear = currentYear - 18;        // Ex: 2007

// Cliente nascido em 2007 ou antes = 18+ anos ✅
// Cliente nascido em 2008 ou depois = menor de 18 anos ❌
```

### **Filtros Aplicados (em ordem)**

```sql
1. birthday IS NOT NULL                          -- Deve ter data cadastrada
2. birthday NOT IN ('2000-01-01', '1990-01-01',  -- Bloquear datas padrão
                    '2024-01-01', '2025-01-01')
3. EXTRACT(YEAR FROM birthday) <= minBirthYear   -- Idade >= 18 anos
4. EXTRACT(MONTH/DAY) = targetDate               -- Dia do aniversário
```

---

## ✅ Alterações Realizadas

### 1. **Função `getClientsByBirthdayDate()`** - `server/storage.ts`

**Antes:**
```typescript
sql`${clients.birthday} NOT IN ('2000-01-01', '1990-01-01')`
// Apenas bloqueava 2 datas padrão
```

**Depois:**
```typescript
// Bloquear 4 datas padrão
sql`${clients.birthday} NOT IN ('2000-01-01', '1990-01-01', '2024-01-01', '2025-01-01')`

// + Validar idade mínima
sql`(
  (${clients.birthday} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND
   EXTRACT(YEAR FROM ${clients.birthday}::date) <= ${minBirthYear})
  OR
  (${clients.birthday} ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' AND
   CAST(SPLIT_PART(${clients.birthday}, '/', 3) AS INTEGER) <= ${minBirthYear})
)`
```

**Impacto:** 
- ✅ Bloqueia datas padrão antigas e recentes
- ✅ Bloqueia menores de 18 anos
- ✅ Cálculo dinâmico (não precisa atualizar código anualmente)

---

### 2. **Função `getUpcomingBirthdays()`** - `server/storage.ts`

**Mesma lógica aplicada:**
- ✅ Datas padrão bloqueadas: `2000-01-01`, `1990-01-01`, `2024-01-01`, `2025-01-01`
- ✅ Idade mínima: 18 anos (calculada dinamicamente)
- ✅ Funciona com ou sem filtro de `responsibleId`

---

## 🛡️ Cenários de Proteção

### ✅ **Cenário 1: Data Padrão Histórica**
```
Cliente: João Silva
Data: 2000-01-01
Idade calculada: 25 anos
Resultado: ❌ BLOQUEADO (data padrão conhecida)
```

### ✅ **Cenário 2: Data Padrão Recente**
```
Cliente: Maria Santos
Data: 2025-01-01
Idade calculada: 0 anos
Resultado: ❌ BLOQUEADO (data padrão + menor de idade)
```

### ✅ **Cenário 3: Cliente Menor de Idade**
```
Cliente: Pedro Costa
Data: 2010-05-15 (nascido em 2010)
Idade calculada: 15 anos
Resultado: ❌ BLOQUEADO (menor de 18 anos)
```

### ✅ **Cenário 4: Cliente com 17 Anos**
```
Cliente: Ana Oliveira
Data: 2008-06-20 (nascido em 2008)
Idade atual: 17 anos
Resultado: ❌ BLOQUEADO (falta 1 ano para 18)
```

### ✅ **Cenário 5: Cliente com 18 Anos (Exatos)**
```
Cliente: Carlos Souza
Data: 2007-01-01 (nascido em 2007)
Idade atual: 18 anos
Resultado: ✅ PERMITIDO (idade mínima atingida)
```

### ✅ **Cenário 6: Cliente Adulto com Data Real**
```
Cliente: Fernanda Lima
Data: 1995-03-20 (nascido em 1995)
Idade atual: 30 anos
Resultado: ✅ PERMITIDO (adulto com data válida)
```

---

## 🔄 Fluxo de Execução

```
1. Sistema busca aniversariantes do dia
   ↓
2. Aplica filtro SQL:
   ├─ Exclui datas padrão (2000, 1990, 2024, 2025)
   ├─ Exclui menores de 18 anos (ano nascimento > 2007 em 2025)
   └─ Filtra por mês/dia do aniversário
   ↓
3. Retorna apenas clientes válidos (18+ anos, data real)
   ↓
4. Sistema envia mensagens apenas para clientes válidos
```

---

## 📊 Tabela de Validação (Ano 2025)

| Ano Nascimento | Idade em 2025 | Data Exemplo | Status |
|----------------|---------------|--------------|--------|
| 2025 | 0 anos | `2025-01-01` | ❌ Bloqueado (padrão + menor) |
| 2024 | 1 ano | `2024-01-01` | ❌ Bloqueado (padrão + menor) |
| 2010 | 15 anos | `2010-05-15` | ❌ Bloqueado (menor de idade) |
| 2008 | 17 anos | `2008-06-20` | ❌ Bloqueado (menor de idade) |
| 2007 | 18 anos | `2007-01-01` | ✅ Permitido (idade mínima) |
| 2000 | 25 anos | `2000-01-01` | ❌ Bloqueado (data padrão) |
| 1995 | 30 anos | `1995-03-20` | ✅ Permitido (adulto válido) |
| 1990 | 35 anos | `1990-01-01` | ❌ Bloqueado (data padrão) |
| 1985 | 40 anos | `1985-08-10` | ✅ Permitido (adulto válido) |

---

## 🧪 Como Testar

### **Teste Automatizado:**
```powershell
npx tsx server/jobs/test-age-validation.ts
```

### **O teste valida:**
1. ✅ Datas padrão são bloqueadas (4 datas)
2. ✅ Clientes com menos de 18 anos são bloqueados
3. ✅ Clientes com 18+ anos são permitidos
4. ✅ Cálculo dinâmico de idade funciona
5. ✅ Ambos os formatos de data funcionam (YYYY-MM-DD e DD/MM/YYYY)

### **Saída Esperada:**
```
📅 Ano atual: 2025
📅 Ano mínimo de nascimento (18 anos): 2007

✅ SUCESSO: Nenhum cliente com datas padrão foi incluído
✅ SUCESSO: Todos os clientes têm 18 anos ou mais

📋 Clientes válidos encontrados (18+ anos):
   - João Silva (1995-01-01) - Idade: ~30 anos
   - Maria Santos (2005-01-01) - Idade: ~20 anos

✅ TODOS OS TESTES PASSARAM!
```

---

## 🔧 Manutenção Futura

### **Para adicionar mais datas padrão:**
```typescript
// Em storage.ts, nas 2 funções modificadas:
sql`${clients.birthday} NOT IN ('2000-01-01', '1990-01-01', '2024-01-01', '2025-01-01', '2026-01-01')`
//                                                                                        ↑ nova data
```

### **Para alterar idade mínima:**
```typescript
// Atualmente: 18 anos
const minBirthYear = currentYear - 18;

// Para 21 anos:
const minBirthYear = currentYear - 21;
```

### **Para criar configuração centralizada (recomendado):**
```typescript
// Criar em: server/config/birthday-validation.config.ts
export const BIRTHDAY_VALIDATION_CONFIG = {
  minAge: 18,
  blockedDates: ['2000-01-01', '1990-01-01', '2024-01-01', '2025-01-01'],
};
```

---

## 📝 Logs do Sistema

### **Antes:**
```
[Storage] Buscando clientes aniversariantes para 01/01 (excluindo datas padrão: 2000-01-01 e 1990-01-01)
```

### **Depois:**
```
[Storage] Buscando clientes aniversariantes para 01/01 (idade mínima: 18 anos, nascidos até 2007)
[Storage] Encontrados 12 cliente(s) aniversariante(s) válido(s) para 01/01 (idade >= 18 anos)
```

---

## ✅ Status da Implementação

- ✅ Validação de idade mínima (18 anos) implementada
- ✅ Cálculo dinâmico baseado no ano atual
- ✅ Datas padrão bloqueadas (4 datas: 2000, 1990, 2024, 2025)
- ✅ Funciona com ambos os formatos de data (YYYY-MM-DD e DD/MM/YYYY)
- ✅ Aplicado em `getClientsByBirthdayDate()`
- ✅ Aplicado em `getUpcomingBirthdays()`
- ✅ Logs informativos atualizados
- ✅ Script de teste completo criado
- ✅ Documentação detalhada

---

## 🎯 Benefícios da Solução

| Benefício | Descrição |
|-----------|-----------|
| **Automático** | Idade mínima calculada dinamicamente todo ano |
| **Seguro** | Bloqueia menores de idade automaticamente |
| **Flexível** | Fácil adicionar novas datas padrão |
| **Performático** | Filtros aplicados no banco de dados (SQL) |
| **Auditável** | Logs claros sobre critérios de filtragem |
| **Manutenível** | Não precisa atualizar código anualmente |

---

## 🚨 Datas e Idades Bloqueadas (2025)

### **Datas Padrão Bloqueadas:**
- ❌ `2000-01-01`
- ❌ `1990-01-01`
- ❌ `2024-01-01`
- ❌ `2025-01-01`

### **Idades Bloqueadas (2025):**
- ❌ 0-17 anos (nascidos em 2008 ou depois)

### **Idades Permitidas (2025):**
- ✅ 18+ anos (nascidos em 2007 ou antes)

---

**🚀 A implementação está completa e pronta para produção!**

Clientes menores de 18 anos e com datas padrão **NÃO receberão** mensagens de aniversário em nenhuma circunstância.

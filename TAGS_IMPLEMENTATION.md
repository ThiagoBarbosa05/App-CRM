# 🏷️ Sistema de Tags do Umbler - Documentação

## 📋 Visão Geral

Implementação completa de sincronização de tags do Umbler com o CRM, permitindo associar tags externas aos clientes tanto na criação quanto na atualização.

## ✅ Backend

### 1. Schema de Banco de Dados

**Tabelas:**

- `external_tags`: Armazena referências às tags do Umbler
- `client_tags`: Tabela de relacionamento entre clientes e tags externas

### 2. API Routes

- **GET** `/api/umbler/tags?query={searchTerm}` - Busca tags do Umbler com suporte a filtro por nome

### 3. Serviço de Clientes

- `createClient`: Sincroniza tags ao criar cliente
- `updateClient`: Sincroniza tags ao atualizar cliente
- Sincronização dual: Umbler (API externa) + Banco de dados local

### 4. Repository

Novos métodos:

- `syncClientTags(clientId, externalTagIds)`: Sincroniza tags localmente
- `getClientTags(clientId)`: Busca tags associadas ao cliente

## Componentes Frontend Criados:

### TagSelector Component

**Localização:** `client/src/components/ui/tag-selector.tsx`

**Características:**

- ✅ Campo de busca em tempo real
- ✅ Lista de tags filtradas
- ✅ Seleção múltipla de tags
- ✅ Badges visuais com cores e emojis das tags
- ✅ Botão para remover tags selecionadas
- ✅ Loading state durante busca
- ✅ Estado vazio quando não há tags
- ✅ Cache de 5 minutos para performance

**Interface do Componente:**

```typescript
interface TagSelectorProps {
  selectedTags: string[]; // IDs das tags selecionadas
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}
```

### 2. **Validação Atualizada** ([validations.ts](client/src/lib/validations.ts))

- Adicionado campo `externalTagIds` no `clientValidationSchema`

### 3. **Formulário de Cliente Atualizado** ([client-form-modal.tsx](client/src/components/client-form-modal.tsx))

- Import do componente `TagSelector`
- Campo `externalTagIds` adicionado no `defaultValues`
- Novo campo de formulário "Tags do Umbler" com busca e seleção múltipla
- Posicionado estrategicamente antes da seção de endereço

## 🎯 Funcionalidades Implementadas

### 1. **Componente TagSelector**

- ✅ Busca tags do Umbler via API
- ✅ Pesquisa em tempo real pelo nome da tag
- ✅ Seleção múltipla de tags
- ✅ Visual com badges customizáveis (emoji, cor)
- ✅ Remoção individual de tags selecionadas
- ✅ Cache de 5 minutos para performance
- ✅ Estados de loading e empty

### 🎨 **Características**

**Boas Práticas Implementadas:**

- ✅ Componente reutilizável e isolado
- ✅ Busca com debounce implícito via React Query
- ✅ Cache inteligente (5 minutos de staleTime)
- ✅ Loading states e feedback visual
- ✅ Pesquisa em tempo real
- ✅ Acessibilidade (ARIA roles e keyboard navigation)
- ✅ Design system consistente (shadcn/ui)
- ✅ TypeScript com tipagem forte
- ✅ Validação com Zod

### Recursos Implementados:

**TagSelector Component:**

- 🔍 **Busca em tempo real** - pesquisa tags pelo nome
- ✅ **Seleção múltipla** - permite selecionar várias tags
- 🎨 **Visual customizado** - exibe emoji e cor das tags
- 🗑️ **Remoção fácil** - badges clicáveis para remover tags
- ⚡ **Performance otimizada** - cache de 5 minutos nas tags
- 🔄 **Loading states** - feedback visual durante busca

**Fluxo de uso:**

1. Usuário abre formulário de criação/edição de cliente
2. Campo "Tags do Umbler" permite pesquisar e selecionar múltiplas tags
3. Tags selecionadas aparecem como badges removíveis
4. Ao salvar, os IDs das tags são enviados no campo `externalTagIds`
5. Backend sincroniza as tags no Umbler e no banco de dados local

**Funcionalidades implementadas:**

- ✅ Busca de tags do Umbler com pesquisa em tempo real
- ✅ Seleção múltipla de tags
- ✅ Visualização das tags selecionadas com badges coloridos
- ✅ Remoção individual de tags selecionadas
- ✅ Integração completa com formulário de criação/edição de clientes
- ✅ Cache de 5 minutos para melhor performance
- ✅ Estado de loading durante busca
- ✅ Feedback visual com emojis e cores das tags

# Template para Importação de Clientes

## Estrutura da Planilha Excel

Sua planilha deve ter exatamente estas colunas (nesta ordem):

| Nome | Telefone | CPF | Email | Aniversario | CEP | Endereco | Numero | Bairro | Cidade | Estado | Categoria | Origem | Marcadores | Responsavel |
|------|----------|-----|-------|-------------|-----|----------|---------|--------|--------|--------|-----------|--------|------------|-------------|

## Exemplos de Dados

| Nome | Telefone | CPF | Email | Aniversario | CEP | Endereco | Numero | Bairro | Cidade | Estado | Categoria | Origem | Marcadores | Responsavel |
|------|----------|-----|-------|-------------|-----|----------|---------|--------|--------|--------|-----------|--------|------------|-------------|
| João Silva | 11999887766 | 123.456.789-00 | joao@email.com | 15/03/1985 | 01234-567 | Rua das Flores | 123 | Centro | São Paulo | SP | VIP | INDICAÇÃO | VIP | Camilla |
| Maria Santos | 11888776655 | 987.654.321-00 | maria@email.com | 22/07/1990 | 54321-098 | Av. Principal | 456 | Jardins | São Paulo | SP | Leads | LOJA | Novo | Igor |

## Campos Obrigatórios
- **Nome**: Nome completo do cliente
- **Telefone**: Telefone com DDD (será usado como identificador único)
- **CPF**: CPF do cliente (será usado como identificador único)

## Campos Opcionais
- **Email**: Email do cliente
- **Aniversario**: Data no formato DD/MM/AAAA ou número do Excel
- **CEP**: CEP no formato 00000-000
- **Endereco**: Endereço completo
- **Numero**: Número da residência
- **Bairro**: Bairro
- **Cidade**: Cidade
- **Estado**: Estado (sigla, ex: SP)
- **Categoria**: Nome da categoria (deve existir no sistema)
- **Origem**: Nome da origem (deve existir no sistema)
- **Marcadores**: Marcadores separados por vírgula
- **Responsavel**: Nome do usuário responsável (deve existir no sistema)

## Validações Importantes
1. **Telefone e CPF únicos**: Não podem existir duplicatas no sistema
2. **Responsavel**: Deve ser exatamente o nome de um usuário existente no sistema
3. **Categoria**: Deve ser exatamente o nome de uma categoria existente
4. **Origem**: Deve ser exatamente o nome de uma origem existente
5. **Aniversario**: Aceita formato DD/MM/AAAA ou número serial do Excel

## Dados Disponíveis no Sistema

### Nomes de Usuários (Responsáveis)
- Eventos
- Camilla
- RENATA FROES
- Michel Sa
- Layane
- Flavia
- Jhoan
- Rogeria
- João
- Igor
- Thiago

### Categorias Disponíveis
- Confrade
- Leads
- MENSAL
- OUTROS
- QUINZENAL
- RESTAURANTE
- VIP

### Origens Disponíveis
- EVENTO
- INDICAÇÃO
- LIGAÇÃO
- LOJA
- OUTROS
- REDES SOCIAIS
- WHATSAPP

## Dicas
- Use exatamente os nomes dos usuários como aparecem no sistema
- Certifique-se de que as categorias e origens já existem no sistema antes da importação
- O sistema é case-insensitive para nomes de responsáveis, categorias e origens
- Campos em branco receberão valores padrão automaticamente
# Guia de Dark Mode - CRM Grand Cru

## Classes CSS para Temas

### Backgrounds

- `bg-white dark:bg-slate-950` - Fundo principal
- `bg-gray-50 dark:bg-slate-900` - Fundo secundário
- `bg-gray-100 dark:bg-slate-800` - Fundo terciário
- `bg-gray-200 dark:bg-slate-700` - Fundo quaternário

### Textos

- `text-slate-900 dark:text-slate-100` - Texto principal
- `text-slate-700 dark:text-slate-300` - Texto secundário
- `text-slate-600 dark:text-slate-400` - Texto terciário
- `text-slate-500 dark:text-slate-500` - Texto desabilitado

### Bordas

- `border-slate-200 dark:border-slate-800` - Borda principal
- `border-slate-300 dark:border-slate-700` - Borda secundária
- `border-gray-200 dark:border-slate-700` - Borda alternativa

### Hover States

- `hover:bg-slate-100 dark:hover:bg-slate-800` - Hover em buttons/links
- `hover:bg-gray-50 dark:hover:bg-slate-900` - Hover leve
- `hover:text-slate-900 dark:hover:text-slate-100` - Hover text

### Cores do tema

- `text-purple-600 dark:text-purple-400` - Cor primária
- `bg-purple-50 dark:bg-purple-900/20` - Background primário
- `border-purple-200 dark:border-purple-800/50` - Borda primária

### Shadows

- `shadow-md` permanece igual
- `shadow-purple-600/20 dark:shadow-purple-900/40` - Shadow colorido

## Exemplos de Uso

### Card

```tsx
<div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg">
  <div className="p-4">
    <h2 className="text-slate-900 dark:text-slate-100">Título</h2>
    <p className="text-slate-600 dark:text-slate-400">Descrição</p>
  </div>
</div>
```

### Button

```tsx
<Button className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white">
  Ação
</Button>
```

### Input

```tsx
<Input className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100" />
```

### Badge

```tsx
<Badge className="bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-300 border-gray-200 dark:border-slate-700">
  Status
</Badge>
```

## Variáveis CSS Disponíveis

As seguintes variáveis CSS já estão configuradas e podem ser usadas via Tailwind:

- `background` - Fundo da página
- `foreground` - Texto principal
- `card` - Fundo de cards
- `card-foreground` - Texto em cards
- `popover` - Fundo de popovers
- `popover-foreground` - Texto em popovers
- `primary` - Cor primária
- `primary-foreground` - Texto em elementos primários
- `secondary` - Cor secundária
- `muted` - Cor muted/desabilitado
- `accent` - Cor de destaque
- `destructive` - Cor de ações destrutivas
- `border` - Cor de bordas
- `input` - Cor de inputs
- `ring` - Cor do ring de foco

## Componentes shadcn/ui

Todos os componentes shadcn/ui já suportam dark mode automaticamente através das variáveis CSS.

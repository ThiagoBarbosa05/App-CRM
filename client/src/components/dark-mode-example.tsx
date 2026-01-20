/**
 * Exemplo de componente com suporte completo a Dark Mode
 *
 * Este arquivo demonstra as melhores práticas para criar
 * componentes que funcionam perfeitamente em ambos os temas.
 */

import { useTheme } from "@/contexts/theme-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, Sparkles } from "lucide-react";

export function DarkModeExample() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-8 transition-colors">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
            🎨 Exemplo de Dark Mode
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Demonstração completa do sistema de temas light e dark
          </p>

          {/* Theme Toggle Button */}
          <Button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white"
          >
            {theme === "light" ? (
              <>
                <Moon className="mr-2 h-4 w-4" />
                Ativar Modo Escuro
              </>
            ) : (
              <>
                <Sun className="mr-2 h-4 w-4" />
                Ativar Modo Claro
              </>
            )}
          </Button>
        </div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Card 1: Basic Card */}
          <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-100">
                Card Básico
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Este é um exemplo de card com suporte a dark mode
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-700 dark:text-slate-300">
                Os cards se adaptam automaticamente ao tema selecionado,
                mantendo boa legibilidade em ambos os modos.
              </p>

              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                  Badge Azul
                </Badge>
                <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800">
                  Badge Verde
                </Badge>
                <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                  Badge Roxo
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Interactive Elements */}
          <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Elementos Interativos
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Botões e outros elementos respondem ao tema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white">
                Botão Primário
              </Button>

              <Button
                variant="outline"
                className="w-full border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Botão Outline
              </Button>

              <Button
                variant="ghost"
                className="w-full text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Botão Ghost
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Lists and Content */}
          <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-lg">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-100">
                Listas e Conteúdo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {[
                  "Background principal se adapta",
                  "Texto mantém contraste adequado",
                  "Bordas ficam visíveis em ambos",
                  "Ícones mudam de cor sutilmente",
                  "Hover states funcionam bem",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="text-purple-600 dark:text-purple-400 font-bold">
                      •
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Card 4: Color Palette */}
          <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-lg">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-100">
                Paleta de Cores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400">
                  Fundo
                </div>
                <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400">
                  Muted
                </div>
                <div className="h-12 bg-purple-600 dark:bg-purple-500 rounded flex items-center justify-center text-xs font-medium text-white">
                  Primary
                </div>
                <div className="h-12 bg-blue-600 dark:bg-blue-500 rounded flex items-center justify-center text-xs font-medium text-white">
                  Info
                </div>
                <div className="h-12 bg-green-600 dark:bg-green-500 rounded flex items-center justify-center text-xs font-medium text-white">
                  Success
                </div>
                <div className="h-12 bg-red-600 dark:bg-red-500 rounded flex items-center justify-center text-xs font-medium text-white">
                  Error
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Code Example Section */}
        <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-lg">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-100">
              💻 Exemplo de Código
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Como usar as classes dark mode em seus componentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto border border-slate-200 dark:border-slate-800">
              <code className="text-sm text-slate-800 dark:text-slate-200">
                {`// Exemplo básico de card com dark mode
<Card className="bg-white dark:bg-slate-950 
               border-slate-200 dark:border-slate-800">
  <CardHeader>
    <CardTitle className="text-slate-900 dark:text-slate-100">
      Título
    </CardTitle>
    <CardDescription className="text-slate-600 dark:text-slate-400">
      Descrição
    </CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-slate-700 dark:text-slate-300">
      Conteúdo do card
    </p>
  </CardContent>
</Card>`}
              </code>
            </pre>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
            ℹ️ Dica
          </h3>
          <p className="text-purple-800 dark:text-purple-200">
            Sempre teste seus componentes em ambos os temas! Use a estrutura{" "}
            <code className="bg-purple-100 dark:bg-purple-800 px-2 py-1 rounded text-sm">
              className="light-class dark:dark-class"
            </code>{" "}
            para garantir boa aparência em qualquer situação.
          </p>
        </div>
      </div>
    </div>
  );
}

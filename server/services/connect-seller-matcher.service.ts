/**
 * Serviço de matching de vendedores para importação de CSV da Connect.
 * Usa similaridade por bigrama para sugerir automaticamente qual usuário
 * do sistema corresponde a cada nome de vendedor encontrado no CSV.
 */

export interface SellerMatch {
  rawName: string;
  matchedUserId: string | null;
  matchedUserName: string | null;
  score: number;
}

export interface UserForMatching {
  id: string;
  name: string;
}

/** Normaliza string para comparação: lowercase, sem acentos, sem espaços extras */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/** Gera conjunto de bigramas de uma string */
function bigrams(str: string): Set<string> {
  const s = normalize(str);
  const result = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    result.add(s.slice(i, i + 2));
  }
  return result;
}

/** Coeficiente de Dice entre dois conjuntos de bigramas (0–1) */
function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const gram of Array.from(a)) {
    if (b.has(gram)) intersection++;
  }
  return (2 * intersection) / (a.size + b.size);
}

/**
 * Verifica se o nome do vendedor é uma substring normalizada do nome do usuário
 * ou vice-versa (útil para "Vera" → "Vera Lucia Santos").
 */
function substringBonus(rawNorm: string, userNorm: string): number {
  if (userNorm.includes(rawNorm) || rawNorm.includes(userNorm)) {
    return 0.2;
  }
  // Checa se o primeiro token do rawName bate com algum token do userName
  const rawTokens = rawNorm.split(" ").filter(Boolean);
  const userTokens = userNorm.split(" ").filter(Boolean);
  const firstTokenMatch = rawTokens.some((rt) =>
    userTokens.some((ut) => ut === rt),
  );
  return firstTokenMatch ? 0.1 : 0;
}

/**
 * Calcula score de similaridade entre nome do vendedor (CSV) e nome de usuário.
 * Combina coeficiente de Dice + bônus por substring.
 */
export function computeSimilarity(
  rawName: string,
  userName: string,
): number {
  const rawNorm = normalize(rawName);
  const userNorm = normalize(userName);

  if (rawNorm === userNorm) return 1;

  const dice = diceCoefficient(bigrams(rawName), bigrams(userName));
  const bonus = substringBonus(rawNorm, userNorm);

  return Math.min(1, dice + bonus);
}

/**
 * Para cada nome de vendedor único do CSV, encontra o usuário mais similar.
 * Score >= 0.7 → match automático; < 0.7 → requer confirmação manual.
 */
export function matchSellersByName(
  sellerNames: string[],
  users: UserForMatching[],
): SellerMatch[] {
  return sellerNames.map((rawName) => {
    if (!rawName || !rawName.trim()) {
      return { rawName, matchedUserId: null, matchedUserName: null, score: 0 };
    }

    let bestScore = 0;
    let bestUser: UserForMatching | null = null;

    for (const user of users) {
      const score = computeSimilarity(rawName, user.name);
      if (score > bestScore) {
        bestScore = score;
        bestUser = user;
      }
    }

    return {
      rawName,
      matchedUserId: bestUser ? bestUser.id : null,
      matchedUserName: bestUser ? bestUser.name : null,
      score: Math.round(bestScore * 100) / 100,
    };
  });
}

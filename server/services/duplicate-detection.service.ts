import { db } from "../db";
import { clients, users } from "../../shared/schema";
import { sql, eq, and, ne } from "drizzle-orm";

export interface DuplicateMatch {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  categoria: string;
  responsavelName: string | null;
  createdAt: Date;
  matchReasons: string[];
  score: number;
}

export interface DuplicateGroup {
  key: string;
  reason: string;
  clients: DuplicateMatch[];
}

/**
 * Normaliza telefone removendo tudo que não é dígito.
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Normaliza CPF/CNPJ removendo tudo que não é dígito.
 */
function normalizeDocument(doc: string | null): string | null {
  if (!doc) return null;
  const d = doc.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

/**
 * Verifica duplicatas em tempo real para um cliente sendo cadastrado/editado.
 * Retorna lista de clientes existentes que são possíveis duplicatas.
 */
export async function checkDuplicates(params: {
  name?: string;
  phone?: string;
  cpf?: string;
  email?: string;
  excludeId?: string; // ID do próprio cliente (em modo edição)
}): Promise<DuplicateMatch[]> {
  const { name, phone, cpf, email, excludeId } = params;

  const normalizedPhone = phone ? normalizePhone(phone) : null;
  const normalizedDoc = normalizeDocument(cpf ?? null);

  // Busca candidatos por match exato em campos chave, mais similaridade de nome
  const rows = await db.execute<{
    id: string;
    name: string;
    phone: string;
    cpf: string | null;
    email: string | null;
    categoria: string;
    responsavel_name: string | null;
    created_at: Date;
    phone_match: boolean;
    doc_match: boolean;
    email_match: boolean;
    name_similarity: number;
  }>(sql`
    SELECT
      c.id,
      c.name,
      c.phone,
      c.cpf,
      c.email,
      c.categoria,
      u.name AS responsavel_name,
      c.created_at,
      (regexp_replace(c.phone, '[^0-9]', '', 'g') = ${normalizedPhone ?? ""})               AS phone_match,
      (
        ${normalizedDoc ?? ""} <> ''
        AND c.cpf IS NOT NULL
        AND regexp_replace(c.cpf, '[^0-9]', '', 'g') = ${normalizedDoc ?? ""}
      )                                                                                        AS doc_match,
      (
        ${email ?? ""} <> ''
        AND c.email IS NOT NULL
        AND lower(c.email) = lower(${email ?? ""})
      )                                                                                        AS email_match,
      COALESCE(similarity(lower(c.name), lower(${name ?? ""})), 0)                            AS name_similarity
    FROM clients c
    LEFT JOIN users u ON u.id = c.responsavel_id
    WHERE
      ${excludeId ? sql`c.id <> ${excludeId} AND` : sql``}
      (
        (${normalizedPhone ?? ""} <> '' AND regexp_replace(c.phone, '[^0-9]', '', 'g') = ${normalizedPhone ?? ""})
        OR (${normalizedDoc ?? ""} <> '' AND c.cpf IS NOT NULL AND regexp_replace(c.cpf, '[^0-9]', '', 'g') = ${normalizedDoc ?? ""})
        OR (${email ?? ""} <> '' AND c.email IS NOT NULL AND lower(c.email) = lower(${email ?? ""}))
        OR (${name ?? ""} <> '' AND similarity(lower(c.name), lower(${name ?? ""})) >= 0.6)
      )
    ORDER BY doc_match DESC, phone_match DESC, email_match DESC, name_similarity DESC
    LIMIT 10
  `);

  return rows.rows.map((row) => {
    const matchReasons: string[] = [];
    let score = 0;

    if (row.doc_match) { matchReasons.push("CPF/CNPJ idêntico"); score += 40; }
    if (row.phone_match) { matchReasons.push("Telefone idêntico"); score += 35; }
    if (row.email_match) { matchReasons.push("E-mail idêntico"); score += 25; }
    if (row.name_similarity >= 0.6 && !row.doc_match && !row.phone_match) {
      matchReasons.push(`Nome similar (${Math.round(row.name_similarity * 100)}%)`);
      score += Math.round(row.name_similarity * 20);
    }

    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      cpf: row.cpf,
      email: row.email,
      categoria: row.categoria,
      responsavelName: row.responsavel_name,
      createdAt: row.created_at,
      matchReasons,
      score,
    };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}

/**
 * Varre todos os clientes e retorna grupos de possíveis duplicatas.
 * Agrupa por: CPF igual, e-mail igual, nome muito similar.
 */
export async function findAllDuplicates(): Promise<DuplicateGroup[]> {
  const groups: DuplicateGroup[] = [];

  // 1. Duplicatas por CPF/CNPJ
  const cpfDupes = await db.execute<{
    cpf_normalized: string;
    ids: string;
    names: string;
    phones: string;
    emails: string;
    categorias: string;
    created_ats: string;
  }>(sql`
    SELECT
      regexp_replace(cpf, '[^0-9]', '', 'g') AS cpf_normalized,
      string_agg(id::text, '|' ORDER BY created_at)         AS ids,
      string_agg(name, '|' ORDER BY created_at)              AS names,
      string_agg(phone, '|' ORDER BY created_at)             AS phones,
      string_agg(COALESCE(email, ''), '|' ORDER BY created_at) AS emails,
      string_agg(categoria, '|' ORDER BY created_at)         AS categorias,
      string_agg(created_at::text, '|' ORDER BY created_at)  AS created_ats
    FROM clients
    WHERE cpf IS NOT NULL AND cpf <> ''
    GROUP BY regexp_replace(cpf, '[^0-9]', '', 'g')
    HAVING count(*) > 1
    ORDER BY count(*) DESC
  `);

  for (const row of cpfDupes.rows) {
    const ids = row.ids.split("|");
    const names = row.names.split("|");
    const phones = row.phones.split("|");
    const emails = row.emails.split("|");
    const categorias = row.categorias.split("|");
    const dates = row.created_ats.split("|");

    groups.push({
      key: `cpf:${row.cpf_normalized}`,
      reason: "CPF/CNPJ idêntico",
      clients: ids.map((id, i) => ({
        id,
        name: names[i] ?? "",
        phone: phones[i] ?? "",
        cpf: row.cpf_normalized,
        email: emails[i] || null,
        categoria: categorias[i] ?? "",
        responsavelName: null,
        createdAt: new Date(dates[i] ?? ""),
        matchReasons: ["CPF/CNPJ idêntico"],
        score: 40,
      })),
    });
  }

  // 2. Duplicatas por e-mail
  const emailDupes = await db.execute<{
    email_normalized: string;
    ids: string;
    names: string;
    phones: string;
    cpfs: string;
    categorias: string;
    created_ats: string;
  }>(sql`
    SELECT
      lower(email) AS email_normalized,
      string_agg(id::text, '|' ORDER BY created_at)          AS ids,
      string_agg(name, '|' ORDER BY created_at)               AS names,
      string_agg(phone, '|' ORDER BY created_at)              AS phones,
      string_agg(COALESCE(cpf, ''), '|' ORDER BY created_at) AS cpfs,
      string_agg(categoria, '|' ORDER BY created_at)          AS categorias,
      string_agg(created_at::text, '|' ORDER BY created_at)   AS created_ats
    FROM clients
    WHERE email IS NOT NULL AND email <> ''
    GROUP BY lower(email)
    HAVING count(*) > 1
    ORDER BY count(*) DESC
  `);

  for (const row of emailDupes.rows) {
    // Evitar duplicar grupo já coberto por CPF
    const ids = row.ids.split("|");
    const names = row.names.split("|");
    const phones = row.phones.split("|");
    const cpfs = row.cpfs.split("|");
    const categorias = row.categorias.split("|");
    const dates = row.created_ats.split("|");

    const alreadyCovered = groups.some((g) =>
      ids.every((id) => g.clients.some((c) => c.id === id)),
    );
    if (alreadyCovered) continue;

    groups.push({
      key: `email:${row.email_normalized}`,
      reason: "E-mail idêntico",
      clients: ids.map((id, i) => ({
        id,
        name: names[i] ?? "",
        phone: phones[i] ?? "",
        cpf: cpfs[i] || null,
        email: row.email_normalized,
        categoria: categorias[i] ?? "",
        responsavelName: null,
        createdAt: new Date(dates[i] ?? ""),
        matchReasons: ["E-mail idêntico"],
        score: 25,
      })),
    });
  }

  // 3. Duplicatas por nome similar (pg_trgm)
  const nameDupes = await db.execute<{
    id_a: string; name_a: string; phone_a: string; cpf_a: string | null; email_a: string | null; categoria_a: string; created_at_a: Date;
    id_b: string; name_b: string; phone_b: string; cpf_b: string | null; email_b: string | null; categoria_b: string; created_at_b: Date;
    sim: number;
  }>(sql`
    SELECT
      a.id AS id_a, a.name AS name_a, a.phone AS phone_a, a.cpf AS cpf_a, a.email AS email_a, a.categoria AS categoria_a, a.created_at AS created_at_a,
      b.id AS id_b, b.name AS name_b, b.phone AS phone_b, b.cpf AS cpf_b, b.email AS email_b, b.categoria AS categoria_b, b.created_at AS created_at_b,
      similarity(lower(a.name), lower(b.name)) AS sim
    FROM clients a
    JOIN clients b ON a.id < b.id
    WHERE similarity(lower(a.name), lower(b.name)) >= 0.75
      AND regexp_replace(a.phone, '[^0-9]', '', 'g') <> regexp_replace(b.phone, '[^0-9]', '', 'g')
    ORDER BY sim DESC
    LIMIT 50
  `);

  for (const row of nameDupes.rows) {
    const alreadyCovered = groups.some(
      (g) =>
        g.clients.some((c) => c.id === row.id_a) &&
        g.clients.some((c) => c.id === row.id_b),
    );
    if (alreadyCovered) continue;

    groups.push({
      key: `name:${row.id_a}:${row.id_b}`,
      reason: `Nome similar (${Math.round(row.sim * 100)}%)`,
      clients: [
        {
          id: row.id_a, name: row.name_a, phone: row.phone_a, cpf: row.cpf_a,
          email: row.email_a, categoria: row.categoria_a, responsavelName: null,
          createdAt: row.created_at_a, matchReasons: [`Nome similar (${Math.round(row.sim * 100)}%)`], score: Math.round(row.sim * 20),
        },
        {
          id: row.id_b, name: row.name_b, phone: row.phone_b, cpf: row.cpf_b,
          email: row.email_b, categoria: row.categoria_b, responsavelName: null,
          createdAt: row.created_at_b, matchReasons: [`Nome similar (${Math.round(row.sim * 100)}%)`], score: Math.round(row.sim * 20),
        },
      ],
    });
  }

  return groups;
}

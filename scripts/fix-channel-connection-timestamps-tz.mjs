/**
 * Converte whatsapp_channels.connection_status_at e .connection_checked_at de
 * `timestamp` para `timestamptz`.
 *
 * O bug: o driver grava a Date como instante UTC, o Postgres guarda o relógio
 * nu ("2026-08-06 00:09:01"), e na leitura o pg-types interpreta esse relógio
 * como horário LOCAL do processo (America/Sao_Paulo) — devolvendo
 * 2026-08-06T03:09:01Z, três horas no futuro.
 *
 * O estrago não é cosmético. `decideStatusTransition` compara o valor lido com
 * um `new Date()` real: com o carimbo sempre 3h adiantado, todo evento novo
 * parecia mais velho que o último aplicado e virava `stale_event`. Na prática,
 * cada canal só conseguia mudar de status uma vez a cada 3 horas — qualquer
 * "close" que chegasse dentro dessa janela era descartado em silêncio, e a tela
 * seguia mostrando "Conectado" com a sessão morta.
 *
 * Os dados gravados estão corretos (relógio UTC); o USING abaixo só declara
 * isso ao Postgres, sem deslocar nada.
 *
 * Uso:
 *   node scripts/fix-channel-connection-timestamps-tz.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

for (const column of ["connection_status_at", "connection_checked_at"]) {
  const [current] = await sql`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'whatsapp_channels' AND column_name = ${column}
  `;
  if (!current) {
    console.error(`[migration] Coluna ${column} não existe — rode antes os scripts que a criam.`);
    process.exit(1);
  }
  if (current.data_type === "timestamp with time zone") {
    console.log(`[migration] ${column} já é timestamptz; nada a fazer.`);
    continue;
  }
  // Identificador não pode ir como parâmetro ($1), então a interpolação é
  // necessária — e segura: a lista de colunas é fixa e literal, logo acima.
  // `sql.query` é a forma de mandar SQL montado; `sql(...)` como chamada comum
  // deixou de existir no driver (só tagged template).
  await sql.query(
    `ALTER TABLE whatsapp_channels
     ALTER COLUMN ${column} TYPE timestamptz
     USING ${column} AT TIME ZONE 'UTC'`,
  );
  console.log(`[migration] ${column} convertida para timestamptz.`);
}

// Conferência final, meramente informativa: os ALTERs acima já aconteceram.
// Vai dentro de try/catch porque versões diferentes do driver @neondatabase
// divergem no formato da resposta (a do Replit devolve `rows: null` aqui), e
// uma falha na CONFERÊNCIA não pode passar a impressão de que a MIGRAÇÃO
// falhou — foi exatamente o susto que esse script deu na primeira execução.
try {
  const [check] = await sql`
    SELECT connection_checked_at
    FROM whatsapp_channels
    WHERE connection_checked_at IS NOT NULL
    ORDER BY connection_checked_at DESC LIMIT 1
  `;
  if (!check) {
    console.log("[migration] Nenhum canal verificado ainda; nada a conferir.");
  } else {
    const ageSeconds = Math.round((Date.now() - new Date(check.connection_checked_at)) / 1000);
    console.log(
      `[migration] Verificação: última confirmação há ${ageSeconds}s ` +
        (ageSeconds < 0
          ? "— NEGATIVO: o desvio de fuso persiste, avise antes de seguir."
          : "— positivo, o desvio de fuso foi corrigido."),
    );
  }
} catch (error) {
  console.warn(
    "[migration] Colunas convertidas com sucesso; só a conferência final falhou:",
    error.message,
  );
}

import "dotenv/config";
import { scanCopilotoSignals, getCopilotoFeed, loadMoreFromBacklog, actOnSignal } from "./server/services/copiloto.service";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

const r = await scanCopilotoSignals({ withAi: false });
console.log(`varredura -> fila: ${r.generated} | backlog: ${r.backlogged} | vendedores: ${r.sellers}`);

const dist = await db.execute(sql`
  SELECT u.name, COUNT(*) FILTER (WHERE s.status='pending') AS fila,
         COUNT(*) FILTER (WHERE s.status='backlog') AS backlog
  FROM copiloto_signals s JOIN users u ON u.id=s.seller_id
  GROUP BY u.name HAVING COUNT(*) FILTER (WHERE s.status='backlog') > 0
  ORDER BY 3 DESC LIMIT 4`);
console.log("\nvendedores com backlog:"); console.table(dist.rows);

// Pega o vendedor com mais backlog e simula ele concluindo TODA a fila
const [alvo] = (await db.execute(sql`
  SELECT seller_id FROM copiloto_signals WHERE status='backlog'
  GROUP BY seller_id ORDER BY COUNT(*) DESC LIMIT 1`)).rows as any[];
const sid = String(alvo.seller_id);

let feed = await getCopilotoFeed(sid);
console.log(`\n--- vendedor: fila=${feed.cards.length}, backlogCount=${feed.backlogCount}`);

console.log("concluindo todos os 15...");
for (const c of feed.cards) await actOnSignal({ signalId: c.id, sellerId: sid, action: "done" });
feed = await getCopilotoFeed(sid);
console.log(`--- depois de concluir: fila=${feed.cards.length}, backlogCount=${feed.backlogCount}`);

const lm = await loadMoreFromBacklog(sid, { withAi: false });
feed = await getCopilotoFeed(sid);
console.log(`\n"Carregar mais" -> promovidos=${lm.promoted}, restam=${lm.remaining}`);
console.log(`--- fila agora: ${feed.cards.length} cards | backlogCount=${feed.backlogCount}`);
console.log(`--- os promovidos têm fatos? ${feed.cards.filter(c => (c.payload as any).facts).length}/${feed.cards.length}`);
console.log(`--- score ordenado? ${feed.cards.map(c => c.score).join(" > ")}`);
process.exit(0);

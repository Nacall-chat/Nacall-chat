#!/usr/bin/env node
// Publica no sino do NACALL a novidade escrita num PR mesclado (seção "Novidade para quem usa" do corpo do PR).
//
//   node scripts/novidade.mjs --pr 142 [--pr 143] [--dias 3] [--dry-run]
//
// Lê o PR com o `gh` (GH_TOKEN no Actions), confere o texto (tamanho e sem jargão) e grava em product_updates pelo
// REST do Supabase com a chave de serviço. Variáveis: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (secrets do workflow,
// nunca no código). Sem elas, ou com --dry-run, só mostra o que seria publicado. PR sem a seção: nada a fazer.
import { execFileSync } from 'node:child_process';
import { parseNovidade, updateRow, validateNovidade } from './novidade-lib.mjs';

const args = process.argv.slice(2);
const prs = args.flatMap((arg, i) => (arg === '--pr' ? String(args[i + 1] ?? '').split(',') : [])).map(v => v.trim()).filter(Boolean);
const days = Number(args[args.indexOf('--dias') + 1] ?? 3) || 3;
const dryRun = args.includes('--dry-run');
const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!prs.length) { console.error('Informe o PR: --pr <número>'); process.exit(2); }
if (!dryRun && (!url || !key)) { console.log('::warning::SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não cadastrados: nada foi publicado (veja docs/NOVIDADES.md).'); process.exit(0); }

let failed = false;
for (const pr of prs) {
  if (!/^\d+$/.test(pr)) { console.error(`PR inválido: ${pr}`); failed = true; continue; }
  const info = JSON.parse(execFileSync('gh', ['pr', 'view', pr, '--json', 'number,url,body,mergedAt'], { encoding: 'utf8' }));
  if (!info.mergedAt) { console.log(`PR #${pr} ainda não foi mesclado: nada a publicar.`); continue; }
  const novidade = parseNovidade(info.body);
  if (!novidade) { console.log(`PR #${pr} não tem a seção "Novidade para quem usa": nada a publicar.`); continue; }
  const problems = validateNovidade(novidade);
  if (problems.length) { console.log(`::error::PR #${pr}: a novidade não foi publicada. ${problems.join(' ')}`); failed = true; continue; }
  const row = updateRow({ number: info.number, url: info.url, title: novidade.title, text: novidade.text, days });
  if (dryRun) { console.log(`[simulação] PR #${pr}:`, JSON.stringify(row, null, 2)); continue; }
  const response = await fetch(`${url}/rest/v1/product_updates?on_conflict=slug`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!response.ok) { console.log(`::error::PR #${pr}: o banco recusou a novidade (HTTP ${response.status}).`); failed = true; continue; }
  console.log(`PR #${pr}: novidade "${row.title}" publicada até ${row.expires_at}.`);
}
process.exit(failed ? 1 : 0);

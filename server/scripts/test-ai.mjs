// Test direct d'OpenRouter, sans Express ni Prisma.
//   node scripts/test-ai.mjs                      -> teste AI_MODEL du .env
//   node scripts/test-ai.mjs google/gemma-4-31b-it:free   -> teste un autre modele
// Demande une vraie page HTML : c'est le seul test qui compte pour ce projet.
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(process.cwd(), '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
}

const model = process.argv[2] || process.env.AI_MODEL || 'z-ai/glm-4.5-air:free';
const key = process.env.AI_API_KEY;
console.log('modele :', model);
console.log('cle    :', key ? `${key.slice(0, 8)}... (${key.length} caracteres)` : 'ABSENTE');

const t0 = Date.now();
const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model,
    reasoning: { exclude: true },
    messages: [
      {
        role: 'system',
        content:
          'You are an expert web developer. Output valid HTML only, no markdown, no code fences, no explanation. Use Tailwind via <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>.',
      },
      { role: 'user', content: 'Landing page for a coffee shop: hero, menu, footer.' },
    ],
  }),
});

console.log('statut :', res.status, res.statusText, `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
const body = await res.json();
if (!res.ok) {
  console.log('erreur :', JSON.stringify(body, null, 2));
  process.exit(1);
}

const choice = body.choices?.[0];
const content = choice?.message?.content || '';
const reasoning = choice?.message?.reasoning || '';
console.log('finish        :', choice?.finish_reason);
console.log('content       :', content.length, 'caracteres');
console.log('reasoning     :', reasoning.length, 'caracteres');
console.log('fences ```    :', content.includes('```') ? 'OUI (a nettoyer)' : 'non');
console.log('debut         :', JSON.stringify(content.slice(0, 90)));

const ok =
  content.length > 1500 &&
  /<html[\s>]/i.test(content) &&
  /<\/html>/i.test(content) &&
  choice?.finish_reason !== 'length';
console.log(ok ? '\nOK : page complete, ce modele fait le travail.' : '\nKO : voir ci-dessus (vide, tronque, ou pas du HTML).');

fs.writeFileSync('scripts/last-test.html', content);
console.log('sortie ecrite dans scripts/last-test.html, ouvre-la dans le navigateur.');

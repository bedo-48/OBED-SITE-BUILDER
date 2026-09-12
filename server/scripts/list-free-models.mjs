// Liste les modeles gratuits d'OpenRouter, tries par taille de sortie.
//   node scripts/list-free-models.mjs
// La colonne "sortie" compte : une page HTML complete fait 3000 a 8000 tokens.
const res = await fetch('https://openrouter.ai/api/v1/models');
const { data } = await res.json();

const free = data
  .filter((m) => m.id.endsWith(':free'))
  .map((m) => ({
    id: m.id,
    ctx: m.context_length ?? 0,
    out: m.top_provider?.max_completion_tokens ?? m.context_length ?? 0,
  }))
  .sort((a, b) => b.out - a.out);

console.log(`${free.length} modeles gratuits\n`);
console.log('sortie   contexte  modele');
for (const m of free) {
  console.log(String(m.out).padStart(6), String(m.ctx).padStart(9), ' ', m.id);
}

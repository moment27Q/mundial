const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyD7EAy-pwzYf7hDd-K-vdIL3qMHVC9LOQU';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

async function listModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
  const data = await res.json();
  const names = (data.models || []).map(m => m.name);
  console.log('[Gemini] Modelos disponibles:', names.join(', '));
}

async function analyzeMatch(match) {
  const isFinished = match.status === 'finished';
  const isLive     = match.status === 'live';

  const context = isFinished
    ? `Resultado final: ${match.home_score}-${match.away_score}`
    : isLive
    ? `Partido EN VIVO ahora mismo. Marcador parcial: ${match.home_score ?? 0}-${match.away_score ?? 0}`
    : `Partido próximo a jugarse.`;

  const prompt = `Eres un analista experto de fútbol del Mundial de fútbol. Analiza este partido de forma concisa en español:

${match.home_flag || ''} ${match.home_team} vs ${match.away_team} ${match.away_flag || ''}
Fase: ${match.stage}
${context}

Incluí:
- ${isFinished ? 'Análisis breve del resultado y actuaciones destacadas' : 'Predicción del resultado con porcentaje estimado'}
- 2 factores clave que definirán/definieron el partido
- Un dato histórico o curiosidad relevante de estos equipos

Responde en español, máximo 120 palabras, sin encabezados markdown.`;

  const res = await fetch(`${BASE_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 350, temperature: 0.75 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini: respuesta vacía');
  return text.trim();
}

module.exports = { analyzeMatch, listModels };

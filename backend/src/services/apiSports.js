const API_KEY = process.env.API_SPORTS_KEY || 'e6e977706479e8ef2a20025afc0c1547';
const BASE_URL = 'https://v3.football.api-sports.io';

const FLAGS = {
  'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'France': '🇫🇷', 'Germany': '🇩🇪',
  'Spain': '🇪🇸', 'Portugal': '🇵🇹', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Italy': '🇮🇹',
  'Netherlands': '🇳🇱', 'Belgium': '🇧🇪', 'Croatia': '🇭🇷', 'Morocco': '🇲🇦',
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Mexico': '🇲🇽', 'Uruguay': '🇺🇾',
  'United States': '🇺🇸', 'USA': '🇺🇸', 'Canada': '🇨🇦', 'Australia': '🇦🇺',
  'Switzerland': '🇨🇭', 'Poland': '🇵🇱', 'Denmark': '🇩🇰', 'Senegal': '🇸🇳',
  'Ecuador': '🇪🇨', 'Ghana': '🇬🇭', 'Cameroon': '🇨🇲', 'Serbia': '🇷🇸',
  'Qatar': '🇶🇦', 'Tunisia': '🇹🇳', 'Iran': '🇮🇷', 'Saudi Arabia': '🇸🇦',
  'South Africa': '🇿🇦', 'Costa Rica': '🇨🇷', 'Panama': '🇵🇦', 'Jamaica': '🇯🇲',
  'Peru': '🇵🇪', 'Chile': '🇨🇱', 'Colombia': '🇨🇴', 'Venezuela': '🇻🇪',
  'Bolivia': '🇧🇴', 'Paraguay': '🇵🇾', 'Honduras': '🇭🇳', 'El Salvador': '🇸🇻',
  'Guatemala': '🇬🇹', 'Algeria': '🇩🇿', 'Nigeria': '🇳🇬', 'Egypt': '🇪🇬',
  'Mali': '🇲🇱', 'Ivory Coast': '🇨🇮', 'Guinea': '🇬🇳', 'DR Congo': '🇨🇩',
  'Zambia': '🇿🇲', 'Tanzania': '🇹🇿', 'Congo': '🇨🇬', 'Burkina Faso': '🇧🇫',
  'Cape Verde': '🇨🇻', 'Mozambique': '🇲🇿', 'Benin': '🇧🇯', 'Uganda': '🇺🇬',
  'Zimbabwe': '🇿🇼', 'Namibia': '🇳🇦', 'New Zealand': '🇳🇿', 'Uzbekistan': '🇺🇿',
  'Jordan': '🇯🇴', 'Iraq': '🇮🇶', 'UAE': '🇦🇪', 'Kuwait': '🇰🇼',
  'Oman': '🇴🇲', 'Bahrain': '🇧🇭', 'Syria': '🇸🇾', 'India': '🇮🇳',
  'China': '🇨🇳', 'Thailand': '🇹🇭', 'Indonesia': '🇮🇩', 'Vietnam': '🇻🇳',
  'Palestine': '🇵🇸', 'Turkey': '🇹🇷', 'Czech Republic': '🇨🇿', 'Slovakia': '🇸🇰',
  'Hungary': '🇭🇺', 'Romania': '🇷🇴', 'Greece': '🇬🇷', 'Austria': '🇦🇹',
  'Sweden': '🇸🇪', 'Norway': '🇳🇴', 'Finland': '🇫🇮', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Republic of Ireland': '🇮🇪', 'Albania': '🇦🇱',
  'Kosovo': '🇽🇰', 'North Macedonia': '🇲🇰', 'Slovenia': '🇸🇮', 'Bosnia': '🇧🇦',
  'Montenegro': '🇲🇪', 'Ukraine': '🇺🇦', 'Georgia': '🇬🇪', 'Armenia': '🇦🇲',
  'Azerbaijan': '🇦🇿', 'Kazakhstan': '🇰🇿', 'Israel': '🇮🇱', 'Iceland': '🇮🇸',
  'Faroe Islands': '🇫🇴', 'Luxembourg': '🇱🇺', 'Cuba': '🇨🇺', 'Haiti': '🇭🇹',
  'Trinidad and Tobago': '🇹🇹', 'Kenya': '🇰🇪', 'Ethiopia': '🇪🇹',
};

const GROUP_MAP = {
  'Group A': 'Grupo A', 'Group B': 'Grupo B', 'Group C': 'Grupo C',
  'Group D': 'Grupo D', 'Group E': 'Grupo E', 'Group F': 'Grupo F',
  'Group G': 'Grupo G', 'Group H': 'Grupo H', 'Group I': 'Grupo I',
  'Group J': 'Grupo J', 'Group K': 'Grupo K', 'Group L': 'Grupo L',
};

const STAGE_MAP = {
  'Round of 16': 'Octavos de final',
  'Quarter-finals': 'Cuartos de final',
  'Semi-finals': 'Semifinal',
  '3rd Place Final': 'Tercer puesto',
  'Final': 'Final',
};

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE']);
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN', 'ABD', 'AWD', 'WO']);

function mapStatus(s) {
  if (LIVE_STATUSES.has(s)) return 'live';
  if (FINISHED_STATUSES.has(s)) return 'finished';
  return 'upcoming';
}

function mapStage(round, group) {
  if (group && GROUP_MAP[group]) return GROUP_MAP[group];
  return STAGE_MAP[round] || round || 'Grupo';
}

function dateStr(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().split('T')[0];
}

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  if (!res.ok) throw new Error(`API-Sports HTTP ${res.status}`);
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length) {
    const err = new Error(JSON.stringify(data.errors));
    err.apiErrors = data.errors;
    throw err;
  }
  return data.response || [];
}

async function fetchFixtures({ league = 1, season = 2026 } = {}) {
  // 1. Con season (planes pagos — acceso completo)
  try {
    const data = await apiFetch(`/fixtures?league=${league}&season=${season}`);
    if (data.length > 0) return data;
  } catch (err) {
    if (!err.apiErrors?.plan && !err.apiErrors?.season) throw err;
    console.log(`[API-Sports] season=${season} bloqueada en plan gratuito`);
  }

  // 2. Próximos partidos sin season (puede funcionar en algunos planes)
  try {
    const data = await apiFetch(`/fixtures?league=${league}&next=100`);
    if (data.length > 0) return data;
    console.log('[API-Sports] ?next=100 devolvió 0 resultados');
  } catch (err) {
    console.log(`[API-Sports] ?next error: ${err.message}`);
  }

  // 3. Rango de fechas sin filtro de liga (free-plan friendly), filtramos después
  try {
    const from = dateStr(0);
    const to   = dateStr(60);
    const all  = await apiFetch(`/fixtures?from=${from}&to=${to}`);
    const filtered = all.filter(f => f.league.id === league);
    if (filtered.length > 0) {
      console.log(`[API-Sports] Rango de fechas: ${filtered.length} partidos para liga ${league}`);
      return filtered;
    }
    console.log(`[API-Sports] Sin partidos de liga ${league} en los próximos 60 días`);
  } catch (err) {
    console.log(`[API-Sports] Rango de fechas error: ${err.message}`);
  }

  // 4. Fallback: última temporada accesible en plan gratuito (WC 2022 — datos reales, status correcto)
  const fallback = season > 2022 ? 2022 : season;
  console.log(`[API-Sports] Usando fallback season=${fallback} (datos reales con status correcto)`);
  return apiFetch(`/fixtures?league=${league}&season=${fallback}`);
}

async function fetchLiveFixtures({ league = 1 } = {}) {
  try {
    return await apiFetch(`/fixtures?league=${league}&live=all`);
  } catch (err) {
    console.log(`[API-Sports] Live sync error: ${err.message}`);
    return [];
  }
}

function fixtureToMatch(f) {
  const short  = f.fixture.status.short;
  const status = mapStatus(short);
  const isLive = status === 'live';
  const isDone = status === 'finished';
  return {
    external_id:   f.fixture.id,
    home_team:     f.teams.home.name,
    away_team:     f.teams.away.name,
    home_flag:     FLAGS[f.teams.home.name] || '',
    away_flag:     FLAGS[f.teams.away.name] || '',
    stage:         mapStage(f.league.round, f.league.group),
    match_date:    new Date(f.fixture.date).toISOString(),
    home_score:    (isLive || isDone) ? (f.goals.home ?? null) : null,
    away_score:    (isLive || isDone) ? (f.goals.away ?? null) : null,
    status,
    elapsed:       f.fixture.status.elapsed ?? null,
    status_short:  short,
  };
}

module.exports = { fetchFixtures, fetchLiveFixtures, fixtureToMatch };

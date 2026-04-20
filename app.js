// === F1 Dashboard — Main Application ===

const API_BASE = 'https://api.jolpi.ca/ergast/f1';
const CURRENT_YEAR = new Date().getFullYear();
const NEWS_PROXY = 'https://api.rss2json.com/v1/api.json?rss_url=';

// Team colors mapping
const TEAM_COLORS = {
  'red_bull': '#3671C6', 'mercedes': '#27F4D2', 'ferrari': '#E8002D',
  'mclaren': '#FF8000', 'aston_martin': '#229971', 'alpine': '#FF87BC',
  'williams': '#64C4FF', 'rb': '#6692FF', 'kick_sauber': '#52E252',
  'haas': '#B6BABD', 'racing_bulls': '#6692FF', 'sauber': '#52E252',
  'alphatauri': '#6692FF', 'alfa': '#C92D4B',
  // Fallback matching by partial name
};

function getTeamColor(constructorId, constructorName) {
  const id = (constructorId || '').toLowerCase().replace(/\s+/g, '_');
  const name = (constructorName || '').toLowerCase();
  if (TEAM_COLORS[id]) return TEAM_COLORS[id];
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (id.includes(key) || name.includes(key.replace('_', ' '))) return color;
  }
  return '#555555';
}

// Country flag emoji from country name (best-effort)
const COUNTRY_CODES = {
  'bahrain': 'BH', 'saudi arabia': 'SA', 'australia': 'AU', 'japan': 'JP',
  'china': 'CN', 'usa': 'US', 'united states': 'US', 'miami': 'US',
  'italy': 'IT', 'monaco': 'MC', 'canada': 'CA', 'spain': 'ES',
  'austria': 'AT', 'uk': 'GB', 'great britain': 'GB', 'united kingdom': 'GB',
  'hungary': 'HU', 'belgium': 'BE', 'netherlands': 'NL', 'azerbaijan': 'AZ',
  'singapore': 'SG', 'mexico': 'MX', 'brazil': 'BR', 'las vegas': 'US',
  'qatar': 'QA', 'abu dhabi': 'AE', 'uae': 'AE', 'portugal': 'PT',
  'turkey': 'TR', 'france': 'FR', 'russia': 'RU', 'germany': 'DE',
  'emilia romagna': 'IT', 'imola': 'IT', 'monza': 'IT', 'jeddah': 'SA',
  'zandvoort': 'NL', 'baku': 'AZ', 'melbourne': 'AU', 'spa': 'BE',
  'silverstone': 'GB', 'barcelona': 'ES', 'montreal': 'CA', 'suzuka': 'JP',
  'shanghai': 'CN', 'interlagos': 'BR', 'yas marina': 'AE', 'lusail': 'QA',
  'las vegas': 'US', 'miami gardens': 'US',
};

function countryFlag(name) {
  const lower = (name || '').toLowerCase();
  for (const [key, code] of Object.entries(COUNTRY_CODES)) {
    if (lower.includes(key)) {
      return code.replace(/./g, c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65));
    }
  }
  return '';
}

// ── Fetch helpers ──

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── NEWS ──

let allNewsItems = [];
let newsDisplayed = 0;
const NEWS_PER_PAGE = 10;

async function loadNews() {
  const feeds = [
    encodeURIComponent('https://news.google.com/rss/search?q=formula+1+OR+F1+racing&hl=en-US&gl=US&ceid=US:en'),
    encodeURIComponent('https://news.google.com/rss/search?q=F1+grand+prix+2025&hl=en-US&gl=US&ceid=US:en'),
    encodeURIComponent('https://www.autosport.com/rss/f1/news/'),
    encodeURIComponent('https://www.motorsport.com/rss/f1/news/'),
  ];

  const results = await Promise.allSettled(
    feeds.map(feed => fetchJSON(`${NEWS_PROXY}${feed}`).catch(() => ({ items: [] })))
  );

  const seen = new Set();
  allNewsItems = [];

  for (const result of results) {
    const data = result.status === 'fulfilled' ? result.value : { items: [] };
    const items = data.items || [];
    for (const item of items) {
      const key = (item.title || '').toLowerCase().trim().slice(0, 60);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      allNewsItems.push({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        source: extractSource(item.author || item.title || ''),
        description: stripHtml(item.description || item.content || '').slice(0, 200),
        thumbnail: item.thumbnail || item.enclosure?.link || '',
        category: categorizeNews(item.title + ' ' + (item.description || '')),
      });
    }
  }

  allNewsItems.sort((a, b) => b.pubDate - a.pubDate);
  newsDisplayed = 0;
  renderHero();
  renderMoreNews();
}

function extractSource(text) {
  // Google News items often have source in author
  if (text.includes(' - ')) return text.split(' - ').pop().trim();
  return text.slice(0, 30);
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function categorizeNews(text) {
  const t = text.toLowerCase();
  if (/race|grand prix|qualifying|sprint|practice|fp[123]|grid/.test(t)) return 'race';
  if (/team|constructor|factory|car launch|livery|upgrades/.test(t)) return 'team';
  if (/driver|contract|signing|transfer|rookie|champion/.test(t)) return 'driver';
  return 'all';
}

function timeAgo(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderHero() {
  const mainEl = document.getElementById('hero-main');
  const sideEl = document.getElementById('hero-side');
  if (allNewsItems.length === 0) return;

  const hero = allNewsItems[0];
  const sideItems = allNewsItems.slice(1, 4);

  mainEl.innerHTML = `
    <a href="${hero.link}" target="_blank" rel="noopener noreferrer" class="block">
      ${hero.thumbnail ? `<div class="aspect-[16/9] overflow-hidden"><img src="${hero.thumbnail}" alt="" class="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" loading="lazy" /></div>` : `<div class="aspect-[16/9] bg-gradient-to-br from-f1-red/20 to-f1-surface flex items-center justify-center"><svg class="w-16 h-16 text-f1-red/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg></div>`}
      <div class="p-5 lg:p-6">
        <span class="inline-block px-2 py-0.5 bg-f1-red text-white text-[10px] font-bold uppercase tracking-wider rounded-sm mb-3">Latest</span>
        <h2 class="font-heading text-2xl lg:text-3xl font-bold leading-tight mb-2">${hero.title}</h2>
        <p class="text-f1-dimtext text-sm leading-relaxed line-clamp-2">${hero.description}</p>
        <div class="mt-4 flex items-center gap-2 text-xs text-f1-muted">
          <span>${hero.source}</span>
          <span>&middot;</span>
          <time>${timeAgo(hero.pubDate)}</time>
        </div>
      </div>
    </a>
  `;

  sideEl.innerHTML = sideItems.map((item, i) => `
    <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="news-card bg-f1-card border border-f1-border rounded-lg p-4 flex gap-3 cursor-pointer group">
      ${item.thumbnail ? `<div class="w-20 h-20 flex-shrink-0 rounded overflow-hidden"><img src="${item.thumbnail}" alt="" class="w-full h-full object-cover" loading="lazy" /></div>` : `<div class="w-20 h-20 flex-shrink-0 rounded bg-f1-surface flex items-center justify-center"><span class="text-2xl font-heading font-bold text-f1-border">${i + 2}</span></div>`}
      <div class="flex-1 min-w-0">
        <h3 class="font-heading text-sm font-bold leading-snug line-clamp-2 group-hover:text-f1-red transition-colors duration-200">${item.title}</h3>
        <div class="mt-2 flex items-center gap-2 text-[11px] text-f1-muted">
          <span>${item.source}</span>
          <span>&middot;</span>
          <time>${timeAgo(item.pubDate)}</time>
        </div>
      </div>
    </a>
  `).join('');

  newsDisplayed = 4;
}

function renderMoreNews(filter = 'all') {
  const feedEl = document.getElementById('news-feed');
  const items = filter === 'all'
    ? allNewsItems.slice(4)
    : allNewsItems.filter(n => n.category === filter);

  const toShow = items.slice(0, newsDisplayed > 4 ? newsDisplayed - 4 + NEWS_PER_PAGE : NEWS_PER_PAGE);

  feedEl.innerHTML = toShow.map(item => `
    <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="news-card block bg-f1-card border border-f1-border rounded-lg p-4 cursor-pointer">
      <div class="flex gap-4">
        ${item.thumbnail ? `<div class="w-24 h-[72px] flex-shrink-0 rounded overflow-hidden hidden sm:block"><img src="${item.thumbnail}" alt="" class="w-full h-full object-cover" loading="lazy" /></div>` : ''}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-sm ${
              item.category === 'race' ? 'bg-f1-red/15 text-f1-red' :
              item.category === 'team' ? 'bg-blue-500/15 text-blue-400' :
              item.category === 'driver' ? 'bg-amber-500/15 text-amber-400' :
              'bg-f1-surface text-f1-muted'
            }">${item.category}</span>
            <span class="text-[11px] text-f1-muted">${timeAgo(item.pubDate)}</span>
          </div>
          <h3 class="font-heading text-sm font-bold leading-snug line-clamp-2 mb-1">${item.title}</h3>
          <p class="text-f1-dimtext text-xs leading-relaxed line-clamp-1 hidden sm:block">${item.description}</p>
          <span class="text-[11px] text-f1-muted mt-1 inline-block">${item.source}</span>
        </div>
      </div>
    </a>
  `).join('');

  newsDisplayed = 4 + toShow.length;
  const loadMoreBtn = document.getElementById('load-more-news');
  if (toShow.length < items.length) {
    loadMoreBtn.classList.remove('hidden');
  } else {
    loadMoreBtn.classList.add('hidden');
  }
}

// News filters
document.getElementById('news-filters').addEventListener('click', e => {
  const btn = e.target.closest('.news-filter');
  if (!btn) return;
  document.querySelectorAll('.news-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  newsDisplayed = 4;
  renderMoreNews(btn.dataset.filter);
});

document.getElementById('load-more-news').addEventListener('click', () => {
  const activeFilter = document.querySelector('.news-filter.active')?.dataset.filter || 'all';
  renderMoreNews(activeFilter);
});

// ── RACE CALENDAR ──

let races = [];
let nextRaceDate = null;

async function loadCalendar() {
  try {
    const data = await fetchJSON(`${API_BASE}/${CURRENT_YEAR}.json`);
    races = data.MRData?.RaceTable?.Races || [];
    renderCalendar();
    renderNextRace();
    startCountdown();
  } catch {
    // Fallback: try previous year
    try {
      const data = await fetchJSON(`${API_BASE}/${CURRENT_YEAR - 1}.json`);
      races = data.MRData?.RaceTable?.Races || [];
      renderCalendar();
      renderNextRace();
    } catch {
      document.getElementById('calendar-list').innerHTML = '<p class="p-4 text-f1-muted text-sm">Calendar data unavailable</p>';
    }
  }
}

function renderCalendar() {
  const listEl = document.getElementById('calendar-list');
  const now = new Date();
  let completedCount = 0;

  listEl.innerHTML = races.map((race, i) => {
    const raceDate = new Date(`${race.date}T${race.time || '14:00:00Z'}`);
    const isPast = raceDate < now;
    const isNext = !isPast && (i === 0 || new Date(`${races[i - 1].date}T${races[i - 1].time || '14:00:00Z'}`) < now);

    if (isPast) completedCount++;

    const flag = countryFlag(race.Circuit?.Location?.country || race.raceName);
    const dateStr = raceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `
      <div class="calendar-row ${isPast ? 'past' : ''} ${isNext ? 'next' : ''} px-4 py-3 flex items-center gap-3" ${isNext ? 'id="next-race-row"' : ''}>
        <span class="text-xs font-bold text-f1-muted w-6 text-center">${i + 1}</span>
        <span class="text-base w-8 text-center" aria-hidden="true">${flag}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold truncate">${race.raceName}</div>
          <div class="text-[11px] text-f1-muted truncate">${race.Circuit?.circuitName || ''}</div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="text-xs font-medium">${dateStr}</div>
          ${isPast ? '<span class="text-[10px] text-f1-muted">Completed</span>' : isNext ? '<span class="text-[10px] text-f1-red font-bold">UPCOMING</span>' : ''}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('calendar-progress').textContent = `${completedCount}/${races.length} completed`;

  // Scroll to next race
  setTimeout(() => {
    const nextRow = document.getElementById('next-race-row');
    if (nextRow) nextRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 300);
}

function renderNextRace() {
  const infoEl = document.getElementById('next-race-info');
  const now = new Date();
  const next = races.find(r => new Date(`${r.date}T${r.time || '14:00:00Z'}`) > now);

  if (!next) {
    infoEl.innerHTML = '<p class="text-f1-muted text-sm">Season complete</p>';
    return;
  }

  nextRaceDate = new Date(`${next.date}T${next.time || '14:00:00Z'}`);
  const flag = countryFlag(next.Circuit?.Location?.country || next.raceName);
  const dateStr = nextRaceDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = nextRaceDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  infoEl.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="text-3xl mt-0.5" aria-hidden="true">${flag}</span>
      <div>
        <h3 class="font-heading text-lg font-bold leading-tight">${next.raceName}</h3>
        <p class="text-f1-dimtext text-sm mt-0.5">${next.Circuit?.circuitName || ''}</p>
        <p class="text-f1-dimtext text-xs mt-1">${next.Circuit?.Location?.locality || ''}, ${next.Circuit?.Location?.country || ''}</p>
        <div class="mt-2 flex items-center gap-3 text-xs">
          <span class="font-medium">${dateStr}</span>
          <span class="text-f1-muted">${timeStr}</span>
        </div>
      </div>
    </div>
  `;
}

function startCountdown() {
  function update() {
    if (!nextRaceDate) return;
    const diff = nextRaceDate - Date.now();
    if (diff <= 0) {
      document.getElementById('next-race-countdown').textContent = 'NOW';
      document.getElementById('live-indicator').classList.replace('hidden', 'flex');
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    document.getElementById('next-race-countdown').textContent = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
  }
  update();
  setInterval(update, 60000);
}

// ── DRIVER STANDINGS ──

async function loadDriverStandings() {
  const panel = document.getElementById('drivers-standings');
  try {
    const data = await fetchJSON(`${API_BASE}/${CURRENT_YEAR}/driverstandings.json`);
    const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];

    if (standings.length === 0) {
      // Try previous year
      const fallback = await fetchJSON(`${API_BASE}/${CURRENT_YEAR - 1}/driverstandings.json`);
      const fbStandings = fallback.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
      renderDriverStandings(fbStandings, panel);
      return;
    }
    renderDriverStandings(standings, panel);
  } catch {
    panel.innerHTML = '<p class="p-4 text-f1-muted text-sm">Standings data unavailable</p>';
  }
}

function renderDriverStandings(standings, panel) {
  const maxPts = parseFloat(standings[0]?.points) || 1;

  panel.innerHTML = standings.map((s, i) => {
    const pos = parseInt(s.position);
    const driver = s.Driver;
    const constructor = s.Constructors?.[0];
    const teamColor = getTeamColor(constructor?.constructorId, constructor?.name);
    const pctWidth = Math.max(4, (parseFloat(s.points) / maxPts) * 100);
    const posClass = pos <= 3 ? `pos-${pos}` : 'text-f1-muted';

    return `
      <div class="standings-row flex items-center gap-3 px-4 py-2.5">
        <span class="text-xs font-bold w-6 text-center ${posClass}">${pos}</span>
        <div class="team-color h-8" style="background:${teamColor}"></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-semibold truncate">${driver.givenName} <strong>${driver.familyName}</strong></span>
          </div>
          <div class="text-[11px] text-f1-muted truncate">${constructor?.name || ''}</div>
        </div>
        <div class="text-right flex-shrink-0 w-20">
          <div class="text-sm font-bold tabular-nums">${s.points}</div>
          <div class="mt-0.5 h-1 rounded-full bg-f1-surface overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500" style="width:${pctWidth}%;background:${teamColor}"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── CONSTRUCTOR STANDINGS ──

async function loadConstructorStandings() {
  const panel = document.getElementById('constructors-standings');
  try {
    const data = await fetchJSON(`${API_BASE}/${CURRENT_YEAR}/constructorstandings.json`);
    const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];

    if (standings.length === 0) {
      const fallback = await fetchJSON(`${API_BASE}/${CURRENT_YEAR - 1}/constructorstandings.json`);
      const fbStandings = fallback.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
      renderConstructorStandings(fbStandings, panel);
      return;
    }
    renderConstructorStandings(standings, panel);
  } catch {
    panel.innerHTML = '<p class="p-4 text-f1-muted text-sm">Standings data unavailable</p>';
  }
}

function renderConstructorStandings(standings, panel) {
  const maxPts = parseFloat(standings[0]?.points) || 1;

  panel.innerHTML = standings.map((s, i) => {
    const pos = parseInt(s.position);
    const constructor = s.Constructor;
    const teamColor = getTeamColor(constructor?.constructorId, constructor?.name);
    const pctWidth = Math.max(4, (parseFloat(s.points) / maxPts) * 100);
    const posClass = pos <= 3 ? `pos-${pos}` : 'text-f1-muted';

    return `
      <div class="standings-row flex items-center gap-3 px-4 py-3">
        <span class="text-xs font-bold w-6 text-center ${posClass}">${pos}</span>
        <div class="team-color h-10" style="background:${teamColor}"></div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-bold truncate">${constructor.name}</div>
          <div class="text-[11px] text-f1-muted">${s.wins} win${s.wins !== '1' ? 's' : ''}</div>
        </div>
        <div class="text-right flex-shrink-0 w-24">
          <div class="text-sm font-bold tabular-nums">${s.points} <span class="text-[10px] text-f1-muted font-normal">PTS</span></div>
          <div class="mt-0.5 h-1.5 rounded-full bg-f1-surface overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500" style="width:${pctWidth}%;background:${teamColor}"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── RACE WEEKEND ──

let nextRaceRound = null;

function findNextRaceRound() {
  const now = new Date();
  const next = races.find(r => new Date(`${r.date}T${r.time || '14:00:00Z'}`) > now);
  if (next) {
    nextRaceRound = next.round;
    return next;
  }
  // If season is over, show the last race
  if (races.length > 0) {
    const last = races[races.length - 1];
    nextRaceRound = last.round;
    return last;
  }
  return null;
}

async function loadRaceWeekend() {
  const panel = document.getElementById('raceweekend-standings');
  const race = findNextRaceRound();
  if (!race) {
    panel.innerHTML = '<p class="p-4 text-f1-muted text-sm">No race weekend data available</p>';
    return;
  }

  const round = nextRaceRound;
  const year = CURRENT_YEAR;
  const flag = countryFlag(race.Circuit?.Location?.country || race.raceName);

  // Build session schedule from the race data
  const sessions = [];
  if (race.FirstPractice) sessions.push({ name: 'Practice 1', date: race.FirstPractice.date, time: race.FirstPractice.time });
  if (race.SecondPractice) sessions.push({ name: 'Practice 2', date: race.SecondPractice.date, time: race.SecondPractice.time });
  if (race.ThirdPractice) sessions.push({ name: 'Practice 3', date: race.ThirdPractice.date, time: race.ThirdPractice.time });
  if (race.Sprint) sessions.push({ name: 'Sprint', date: race.Sprint.date, time: race.Sprint.time });
  if (race.SprintQualifying) sessions.push({ name: 'Sprint Qualifying', date: race.SprintQualifying.date, time: race.SprintQualifying.time });
  if (race.SprintShootout) sessions.push({ name: 'Sprint Shootout', date: race.SprintShootout.date, time: race.SprintShootout.time });
  if (race.Qualifying) sessions.push({ name: 'Qualifying', date: race.Qualifying.date, time: race.Qualifying.time });
  sessions.push({ name: 'Race', date: race.date, time: race.time });

  // Sort sessions chronologically
  sessions.sort((a, b) => new Date(`${a.date}T${a.time || '00:00:00Z'}`) - new Date(`${b.date}T${b.time || '00:00:00Z'}`));

  const now = new Date();

  // Try to load results for past sessions
  const [qualifyingResult, raceResult, sprintResult] = await Promise.allSettled([
    fetchJSON(`${API_BASE}/${year}/${round}/qualifying.json`),
    fetchJSON(`${API_BASE}/${year}/${round}/results.json`),
    fetchJSON(`${API_BASE}/${year}/${round}/sprint.json`),
  ]);

  const qualiData = qualifyingResult.status === 'fulfilled' ? qualifyingResult.value?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults : null;
  const raceData = raceResult.status === 'fulfilled' ? raceResult.value?.MRData?.RaceTable?.Races?.[0]?.Results : null;
  const sprintData = sprintResult.status === 'fulfilled' ? sprintResult.value?.MRData?.RaceTable?.Races?.[0]?.SprintResults : null;

  let html = `
    <div class="px-4 py-3 border-b border-f1-border">
      <div class="flex items-center gap-2">
        <span class="text-xl" aria-hidden="true">${flag}</span>
        <div>
          <h4 class="font-heading text-sm font-bold">${race.raceName}</h4>
          <p class="text-[11px] text-f1-muted">${race.Circuit?.circuitName || ''} &mdash; Round ${round}</p>
        </div>
      </div>
    </div>
  `;

  // Render each session
  html += '<div class="divide-y divide-f1-border">';
  for (const session of sessions) {
    const sessionDate = new Date(`${session.date}T${session.time || '00:00:00Z'}`);
    const isPast = sessionDate < now;
    const localDate = sessionDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const localTime = session.time ? sessionDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : 'TBD';

    // Check if we have results for this session
    let resultsHtml = '';
    if (session.name === 'Qualifying' && qualiData && qualiData.length > 0) {
      resultsHtml = renderSessionResults(qualiData.slice(0, 5), 'qualifying');
    } else if (session.name === 'Race' && raceData && raceData.length > 0) {
      resultsHtml = renderSessionResults(raceData.slice(0, 5), 'race');
    } else if (session.name === 'Sprint' && sprintData && sprintData.length > 0) {
      resultsHtml = renderSessionResults(sprintData.slice(0, 5), 'race');
    }

    const statusBadge = isPast && resultsHtml
      ? '<span class="text-[10px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">RESULTS</span>'
      : isPast
      ? '<span class="text-[10px] font-bold text-f1-muted bg-f1-surface px-1.5 py-0.5 rounded">DONE</span>'
      : '<span class="text-[10px] font-bold text-f1-red bg-f1-red/10 px-1.5 py-0.5 rounded">UPCOMING</span>';

    html += `
      <div class="px-4 py-3">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm font-semibold">${session.name}</span>
          ${statusBadge}
        </div>
        <div class="flex items-center gap-3 text-[11px] text-f1-muted">
          <span>${localDate}</span>
          <span>${localTime}</span>
        </div>
        ${resultsHtml}
      </div>
    `;
  }
  html += '</div>';

  panel.innerHTML = html;
}

function renderSessionResults(results, type) {
  let html = '<div class="mt-2 space-y-1">';
  for (const r of results) {
    const pos = r.position;
    const driver = r.Driver;
    const constructor = r.Constructor;
    const teamColor = getTeamColor(constructor?.constructorId, constructor?.name);
    const posClass = parseInt(pos) <= 3 ? `pos-${pos}` : 'text-f1-muted';

    let detail = '';
    if (type === 'qualifying') {
      detail = r.Q3 || r.Q2 || r.Q1 || '';
    } else {
      detail = r.Time?.time || r.status || '';
    }

    html += `
      <div class="flex items-center gap-2 text-xs">
        <span class="w-5 text-center font-bold ${posClass}">${pos}</span>
        <div class="team-color h-4" style="background:${teamColor}"></div>
        <span class="flex-1 truncate font-medium">${driver.code || driver.familyName}</span>
        <span class="text-f1-dimtext tabular-nums text-[11px]">${detail}</span>
      </div>
    `;
  }
  html += '</div>';
  return html;
}

// ── STANDINGS TABS ──

document.querySelectorAll('.standings-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.standings-tab').forEach(t => {
      t.classList.remove('text-f1-red', 'border-f1-red');
      t.classList.add('text-f1-muted', 'border-transparent');
    });
    tab.classList.add('text-f1-red', 'border-f1-red');
    tab.classList.remove('text-f1-muted', 'border-transparent');

    document.querySelectorAll('.standings-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`${tab.dataset.tab}-standings`).classList.remove('hidden');
  });
});

// ── INIT ──

(async function init() {
  // Load all data in parallel (calendar first since race weekend depends on it)
  await Promise.allSettled([
    loadNews(),
    loadCalendar(),
    loadDriverStandings(),
    loadConstructorStandings(),
  ]);
  // Race weekend depends on calendar being loaded
  await loadRaceWeekend();
})();

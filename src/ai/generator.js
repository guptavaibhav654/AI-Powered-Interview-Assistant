const FALLBACK_BANK = {
  easy: [
    { q: 'Which hook manages local state in a React function component?', choices: ['useMemo', 'useEffect', 'useState', 'useRef'], correctIndex: 2 },
    { q: 'Which HTTP method is idempotent by convention?', choices: ['POST', 'GET', 'PATCH', 'CONNECT'], correctIndex: 1 },
    { q: 'What attribute is required when rendering lists in React?', choices: ['className', 'style', 'key', 'ref'], correctIndex: 2 },
    { q: 'Which array method returns a new array?', choices: ['push', 'splice', 'map', 'sort'], correctIndex: 2 },
    { q: 'Where should keys be placed when mapping a list in React?', choices: ['On the parent <ul>', 'On each list item root', 'On every child element', 'On the container div'], correctIndex: 1 },
    { q: 'Which hook runs after every render by default?', choices: ['useMemo', 'useEffect', 'useRef', 'useCallback'], correctIndex: 1 },
    { q: 'Which HTTP code indicates success?', choices: ['201', '404', '500', '301'], correctIndex: 0 },
    { q: 'What does Array.filter return?', choices: ['Boolean', 'New array', 'Array length', 'Mutated original'], correctIndex: 1 },
  ],
  medium: [
    { q: 'React reconciles lists efficiently when you provide:', choices: ['array length', 'index as key', 'stable unique keys', 'className'], correctIndex: 2 },
    { q: 'Which schedules microtasks?', choices: ['setTimeout', 'Promise.then', 'requestAnimationFrame', 'setInterval'], correctIndex: 1 },
    { q: 'In Node, which stream is readable by default?', choices: ['fs.createWriteStream', 'process.stdin', 'http.ServerResponse', 'crypto.createCipheriv'], correctIndex: 1 },
    { q: 'Which hook memoizes expensive calculations?', choices: ['useCallback', 'useMemo', 'useRef', 'useEffect'], correctIndex: 1 },
    { q: 'Which HTTP cache header controls client caching?', choices: ['Cache-Control', 'Authorization', 'Accept', 'Origin'], correctIndex: 0 },
    { q: 'How to avoid re-creating callbacks passed to children?', choices: ['useCallback', 'useMemo', 'useRef', 'useId'], correctIndex: 0 },
    { q: 'Which Node module handles compression?', choices: ['zlib', 'fs', 'net', 'dns'], correctIndex: 0 },
    { q: 'How to protect secrets in a React app?', choices: ['Store in .env client', 'Hardcode in source', 'Proxy via backend', 'LocalStorage'], correctIndex: 2 },
  ],
  hard: [
    { q: 'Best way to render 100k items list?', choices: ['Memoize items only', 'Virtualize/Windowing', 'Use CSS only', 'Increase heap size'], correctIndex: 1 },
    { q: 'Offload CPU‑bound tasks in Node without blocking?', choices: ['cluster module', 'worker_threads', 'setImmediate loop', 'child_process.exec only'], correctIndex: 1 },
    { q: 'Prevent React re-renders in deep trees effectively?', choices: ['PureComponent only', 'key reuse', 'memo + proper deps', 'global state only'], correctIndex: 2 },
    { q: 'Reduce bundle size in React app?', choices: ['Disable source maps', 'Code-splitting + dynamic import', 'Remove prop-types', 'Use class components'], correctIndex: 1 },
    { q: 'Which pattern improves SSR hydration performance?', choices: ['Single bundle', 'Lazy dynamic import', 'Disable SSR', 'Inline scripts'], correctIndex: 1 },
    { q: 'How to limit event loop delay in Node?', choices: ['Spin CPU', 'Use worker threads', 'Block on sync IO', 'More timeouts'], correctIndex: 1 },
    { q: 'Best approach to tree‑shake dead code?', choices: ['CommonJS only', 'ES Modules with sideEffects flag', 'Dynamic eval', 'Webpack dev mode'], correctIndex: 1 },
    { q: 'Prevent XSS in React?', choices: ['dangerouslySetInnerHTML', 'Sanitize + escape', 'Inline scripts ok', 'Disable CSP'], correctIndex: 1 },
  ],
}

function secureRandomInt(maxExclusive) {
  const g = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff : Math.random()
  return Math.floor(g * maxExclusive)
}

function shuffle(arr) {
  const copy = arr.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy
}

function pickN(arr, n) {
  return shuffle(arr).slice(0, n)
}

export function generateFallbackSet() {
  const easy = pickN(FALLBACK_BANK.easy, 2).map((x) => ({ ...x, diff: 'easy', time: 20 }))
  const medium = pickN(FALLBACK_BANK.medium, 2).map((x) => ({ ...x, diff: 'medium', time: 60 }))
  const hard = pickN(FALLBACK_BANK.hard, 2).map((x) => ({ ...x, diff: 'hard', time: 120 }))
  return [...easy, ...medium, ...hard]
}

export function ensureSessionQuestions() {
  // Always generate a fresh set - no caching
  return generateFallbackSet()
}

export function clearSessionQuestions() {
  try { localStorage.removeItem('tw_session_questions') } catch {}
}



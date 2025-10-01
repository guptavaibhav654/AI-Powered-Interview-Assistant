import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, Link, useSearchParams } from 'react-router-dom'
import './main.css'
import { ensureSessionQuestions, clearSessionQuestions } from './ai/generator'

function Layout({ children, title }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 font-semibold">{title || 'AI-Powered Interview'}</div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="text-center text-sm text-slate-500 py-6">© {new Date().getFullYear()} AI Interview</footer>
    </div>
  )
}

function Landing() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">Ace interviews with AI </h1>
          <p className="mt-4 text-slate-600">Upload a resume, practice timed Q&A, and review candidates in a lightweight dashboard.</p>
          <div className="mt-6 flex gap-3">
            <Link className="px-5 py-2.5 rounded-md bg-blue-600 text-white" to="/app">Start Practicing</Link>
            <Link className="px-5 py-2.5 rounded-md border border-slate-300" to="/app?tab=interviewer">Open Dashboard</Link>
          </div>
        </div>
        <div className="bg-white shadow rounded-xl p-6">
          <h3 className="font-semibold mb-2">Highlights</h3>
          <ul className="list-disc pl-6 text-slate-700 space-y-1">
            <li>Resume parsing (PDF/DOCX)</li>
            <li>Timed questions with countdown</li>
            <li>Auto scoring and summary</li>
            <li>Simple dashboard</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

function useAi() {
  const [sessionQuestions, setSessionQuestions] = React.useState(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const loadQuestions = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const questions = await ensureSessionQuestions()
      setSessionQuestions(questions)
      return questions
    } finally {
      setIsLoading(false)
    }
  }, [])

  const resetQuestions = React.useCallback(() => {
    setSessionQuestions(null)
  }, [])

  return {
    get(index) { return sessionQuestions?.[index] || { q: 'Loading...', diff: 'easy', time: 20, choices: [], correctIndex: 0 } },
    list: sessionQuestions || [],
    total: 6,
    loadQuestions,
    resetQuestions,
    isLoading,
  }
}

async function extractTextFromFile(file) {
  if (!file) throw new Error('No file')
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist')
    const workerSrc = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n'
    }
    return text
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }
  throw new Error('Unsupported file type')
}

function extractFields(text) {
  const nameMatch = text.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/)
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const phoneMatch = text.match(/(?:(?:\+\d{1,3}[\s-]?)?(?:\(\d{2,3}\)[\s-]?)?\d{3}[\s-]?\d{3,4}[\s-]?\d{3,4})/)
  return { name: nameMatch?.[0] || '', email: emailMatch?.[0] || '', phone: phoneMatch?.[0] || '' }
}

function Countdown({ secondsLeft, onElapsed }) {
  const [s, setS] = React.useState(secondsLeft)
  React.useEffect(() => setS(secondsLeft), [secondsLeft])
  React.useEffect(() => {
    if (s <= 0) { onElapsed?.(); return }
    const id = setTimeout(() => setS((x) => x - 1), 1000)
    return () => clearTimeout(id)
  }, [s, onElapsed])
  return <div className="font-mono text-green-600 text-right">{s}s</div>
}

function App() {
  const [tab, setTab] = React.useState('interviewee')
  const [params] = useSearchParams()
  const ai = useAi()

  React.useEffect(() => {
    const t = params.get('tab')
    if (t === 'interviewer') setTab('interviewer')
  }, [params])

  // persisted state
  const [candidates, setCandidates] = React.useState(()=> {
    try { return JSON.parse(localStorage.getItem('tw_candidates') || '[]') } catch { return [] }
  })
  const [active, setActive] = React.useState(()=> {
    try { return JSON.parse(localStorage.getItem('tw_active') || 'null') } catch { return null }
  })
  const [step, setStep] = React.useState(()=> localStorage.getItem('tw_step') || 'collect')
  const [qIndex, setQIndex] = React.useState(0)
  const [deadline, setDeadline] = React.useState(()=> {
    const v = parseInt(localStorage.getItem('tw_deadline') || '0', 10)
    return Number.isFinite(v) && v > 0 ? v : null
  })
  const [selected, setSelected] = React.useState(null)
  const [correctCount, setCorrectCount] = React.useState(0)
  const [points, setPoints] = React.useState(0)
  const [submittedQuestions, setSubmittedQuestions] = React.useState(new Set())
  const [viewId, setViewId] = React.useState(null)
  const [showWelcome, setShowWelcome] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [sort, setSort] = React.useState('score_desc')

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q ? candidates.filter(c => (c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q)) : candidates.slice()
    return base
  }, [candidates, search])

  const sorted = React.useMemo(() => {
    const arr = filtered.slice()
    if (sort === 'score_desc') arr.sort((a,b)=> (b.finalScore ?? -1) - (a.finalScore ?? -1))
    if (sort === 'score_asc') arr.sort((a,b)=> (a.finalScore ?? -1) - (b.finalScore ?? -1))
    if (sort === 'created_desc') arr.sort((a,b)=> (b.createdAt ?? 0) - (a.createdAt ?? 0))
    if (sort === 'created_asc') arr.sort((a,b)=> (a.createdAt ?? 0) - (b.createdAt ?? 0))
    return arr
  }, [filtered, sort])

  const weightOf = React.useCallback((diff) => {
    if (diff === 'hard') return 3
    if (diff === 'medium') return 2
    return 1
  }, [])

  const maxTotalPoints = React.useMemo(() => {
    // Maximum includes a 30% time bonus when answering instantly
    const totalWeight = ai.list.reduce((sum, q) => sum + weightOf(q.diff), 0)
    return totalWeight * 1.3
  }, [ai.list, weightOf])

  // persist to localStorage
  React.useEffect(() => { localStorage.setItem('tw_candidates', JSON.stringify(candidates)) }, [candidates])
  React.useEffect(() => { localStorage.setItem('tw_active', JSON.stringify(active)) }, [active])
  React.useEffect(() => { localStorage.setItem('tw_step', step) }, [step])
  React.useEffect(() => { localStorage.setItem('tw_deadline', String(deadline || 0)) }, [deadline])

  React.useEffect(() => {
    const hasUnfinished = !!active && candidates.find(c=>c.id===active) && step !== 'done'
    if (hasUnfinished) setShowWelcome(true)
  }, [])

  async function onResumeUpload(file) {
    const id = crypto.randomUUID()
    const objectUrl = URL.createObjectURL(file)
    let parsed = { name: '', email: '', phone: '' }
    try {
      const text = await extractTextFromFile(file)
      parsed = extractFields(text)
    } catch (e) {
      console.error('Failed to parse resume', e)
    }
    const c = { id, name: parsed.name, email: parsed.email, phone: parsed.phone, resumeUrl: objectUrl, resumeFileName: file.name, qa: [], completed: false, finalScore: null, summary: '', createdAt: Date.now() }
    setCandidates((arr) => [c, ...arr])
    setActive(id)
    setStep('collect')
    // Reset questions for new candidate
    ai.resetQuestions()
    clearSessionQuestions()
    return false
  }

  async function startQA(updates) {
    if (!active) return
    setCandidates((arr) => arr.map((c) => c.id === active ? { ...c, ...updates, qa: [] } : c))
    // Reset quiz state completely
    setCorrectCount(0)
    setPoints(0)
    setSelected(null)
    setQIndex(0)  // Always start from question 0 (which displays as question 1)
    setSubmittedQuestions(new Set())  // Clear submitted questions
    setStep('qa')
    // Load fresh questions for this session and wait for them to be ready
    await ai.loadQuestions()
    // Wait a bit more to ensure questions are fully loaded
    setTimeout(() => {
      const meta = ai.get(0)
      console.log('Starting quiz with qIndex:', 0, 'Question:', meta.q)
      if (meta.q && meta.q !== 'Loading...') {
        setDeadline(Date.now() + meta.time * 1000)
      }
    }, 100)
  }

  function timeLeft() {
    if (!deadline) return 0
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
  }


  function submitAnswer() {
    if (!active) return
    const meta = ai.get(qIndex)
    console.log('Submitting answer for qIndex:', qIndex, 'Question:', meta.q, 'Selected:', selected, 'Correct:', meta.correctIndex)
    
    // Prevent submitting if question is still loading
    if (!meta.q || meta.q === 'Loading...') {
      console.log('Skipping submission - question not ready')
      return
    }
    
    // Prevent duplicate submissions
    if (submittedQuestions.has(qIndex)) {
      console.log('Skipping submission - already submitted this question')
      return
    }
    
    const used = meta.time - timeLeft()
    const isCorrect = selected === meta.correctIndex
    let nextPoints = points
    let nextCorrect = correctCount
    if (isCorrect) {
      const weight = weightOf(meta.diff)
      const timeRatio = Math.max(0, Math.min(1, timeLeft() / meta.time))
      const earned = weight + (weight * 0.3 * timeRatio)
      nextPoints = points + earned
      nextCorrect = correctCount + 1
      setPoints(nextPoints)
      setCorrectCount(nextCorrect)
    }
    setCandidates((arr) => arr.map((c) => c.id === active ? { ...c, qa: [...c.qa, { question: meta.q, choices: meta.choices, selected, correctIndex: meta.correctIndex, secondsAllowed: meta.time, secondsUsed: Math.max(0, used) }] } : c))
    setSubmittedQuestions(prev => new Set([...prev, qIndex]))
    setSelected(null)
    if (qIndex >= ai.total - 1) {
      // Final question - calculate score based on actual answers
      const finalCorrect = nextCorrect
      const finalDisplay = Math.round((finalCorrect / ai.total) * 100)
      const summaryText = `Answered ${finalCorrect}/${ai.total} correctly. Overall score ${finalDisplay}.`
      setCandidates((arr) => arr.map((c) => c.id === active ? { ...c, completed: true, finalScore: finalDisplay, summary: summaryText } : c))
      setStep('done')
      return
    }
    const next = qIndex + 1
    setQIndex(next)
    const nextMeta = ai.get(next)
    setDeadline(Date.now() + nextMeta.time * 1000)
  }

  return (
    <Layout title="AI-Powered Interview">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6 border-b border-slate-200 mb-6">
          <button className={`py-2 ${tab==='interviewee' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-600'}`} onClick={()=>setTab('interviewee')}>Interviewee (Chat)</button>
          <button className={`py-2 ${tab==='interviewer' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-600'}`} onClick={()=>setTab('interviewer')}>Interviewer (Dashboard)</button>
        </div>

        {showWelcome && (
          <div className="mb-4 p-4 rounded-md bg-blue-50 text-slate-800 border border-blue-200 flex items-center justify-between">
            <div>
              <div className="font-semibold">Welcome Back</div>
              <div className="text-sm">You have an unfinished interview. Resume to continue.</div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-md bg-blue-600 text-white" onClick={()=> { setShowWelcome(false); setTab('interviewee') }}>Resume</button>
              <button className="px-3 py-1.5 rounded-md border" onClick={()=> { setShowWelcome(false); setActive(null); setStep('collect') }}>Discard</button>
            </div>
          </div>
        )}

        {tab==='interviewee' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow">
              <div className="p-4 border-b font-semibold">Upload Resume (PDF/DOCX)</div>
              <div className="p-6">
                <label className="block w-full border-2 border-dashed rounded-lg p-8 text-center text-slate-500">
                  <input type="file" className="hidden" onChange={(e)=> e.target.files && onResumeUpload(e.target.files[0])} accept=".pdf,.docx" />
                  Click to upload
                </label>
              </div>
            </div>

            {step==='collect' && active && (
              <div className="bg-white rounded-xl shadow">
                <div className="p-4 border-b font-semibold">Confirm Your Details</div>
                <form className="p-6 grid sm:grid-cols-3 gap-4" onSubmit={(e)=>{e.preventDefault(); const f=new FormData(e.currentTarget); startQA({ name:f.get('name'), email:f.get('email'), phone:f.get('phone')});}}>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-600">Full Name</label>
                    <input name="name" defaultValue={candidates.find(c=>c.id===active)?.name} className="border rounded-md px-3 py-2" placeholder="Your full name" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-600">Email</label>
                    <input type="email" name="email" defaultValue={candidates.find(c=>c.id===active)?.email} className="border rounded-md px-3 py-2" placeholder="you@example.com" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-600">Phone</label>
                    <input name="phone" defaultValue={candidates.find(c=>c.id===active)?.phone} className="border rounded-md px-3 py-2" placeholder="+1 555 123 4567" required />
                  </div>
                  <div className="sm:col-span-3">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md">Start Interview</button>
                  </div>
                </form>
              </div>
            )}

            {step==='qa' && active && (
              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Quiz Question {qIndex+1} of {ai.total}</h3>
                  <Countdown secondsLeft={timeLeft()} onElapsed={submitAnswer} />
                </div>
                {ai.isLoading ? (
                  <p className="mt-2 text-slate-500">Loading questions...</p>
                ) : (
                  <>
                    <p className="mt-2 text-slate-700">{ai.get(qIndex).q}</p>
                    <p className="text-sm text-slate-500 mt-1">Difficulty: {ai.get(qIndex).diff.toUpperCase()} · Time: {timeLeft()}s left</p>
                  </>
                )}
                <form className="mt-4 space-y-2" onSubmit={(e)=>{e.preventDefault(); submitAnswer();}}>
                  <div className="space-y-2">
                    {ai.get(qIndex).choices.map((ch, i)=> (
                      <label key={i} className={`flex items-center gap-3 border rounded-md p-3 cursor-pointer ${selected===i? 'border-blue-500 bg-blue-50' : ''}`}>
                        <input type="radio" name="choice" className="accent-blue-600" checked={selected===i} onChange={()=>setSelected(i)} />
                        <span>{ch}</span>
                      </label>
                    ))}
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md mt-2" disabled={selected===null || ai.isLoading}>Submit</button>
                </form>
              </div>
            )}

            {step==='done' && active && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold">Interview Completed</h3>
                <p className="text-slate-700 mt-2">Final Score: {candidates.find(c=>c.id===active)?.finalScore}</p>
                <p className="text-slate-600">{candidates.find(c=>c.id===active)?.summary}</p>
              </div>
            )}
          </div>
        )}

        {tab==='interviewer' && (
          <div className="bg-white rounded-xl shadow">
            <div className="p-4 border-b font-semibold">Candidates</div>
            <div className="p-4 flex flex-col gap-3 overflow-x-auto">
              <div className="flex flex-wrap gap-2 items-center">
                <input className="border rounded-md px-3 py-2" placeholder="Search by name or email" value={search}
                  onChange={(e)=> setSearch(e.target.value)} />
                <select className="border rounded-md px-3 py-2" value={sort}
                  onChange={(e)=> setSort(e.target.value)}>
                  <option value="score_desc">Score (High → Low)</option>
                  <option value="score_asc">Score (Low → High)</option>
                  <option value="created_desc">Created (New → Old)</option>
                  <option value="created_asc">Created (Old → New)</option>
                </select>
              </div>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Phone</th>
                    <th className="py-2 pr-4">Score</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sorted.map((c)=> (
                    <tr key={c.id}>
                      <td className="py-2 pr-4">{c.name || '—'}</td>
                      <td className="py-2 pr-4">{c.email || '—'}</td>
                      <td className="py-2 pr-4">{c.phone || '—'}</td>
                      <td className="py-2 pr-4">{c.finalScore ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <button className="text-blue-600 hover:underline" onClick={()=> setViewId(c.id)}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewId && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white w-[95vw] max-w-5xl max-h-[90vh] rounded-xl shadow-lg overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-5 py-3 border-b">
                <h3 className="font-semibold">Candidate Details</h3>
                <button className="text-slate-500 hover:text-slate-700" onClick={()=> setViewId(null)}>Close</button>
              </div>
              <div className="grid md:grid-cols-2 gap-0 flex-1 overflow-auto">
                <div className="border-r p-4 space-y-3">
                  <h4 className="font-semibold">Resume</h4>
                  {candidates.find(c=>c.id===viewId)?.resumeUrl ? (
                    <div className="h-[70vh] border rounded">
                      <iframe title="resume" src={candidates.find(c=>c.id===viewId).resumeUrl} className="w-full h-full" />
                    </div>
                  ) : (
                    <p className="text-slate-600">No resume uploaded.</p>
                  )}
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="font-semibold">Summary</h4>
                    <p className="text-slate-700 mt-1">{candidates.find(c=>c.id===viewId)?.summary || '—'}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">Quiz Answers</h4>
                    <ol className="mt-2 space-y-2 list-decimal pl-5">
                      {candidates.find(c=>c.id===viewId)?.qa.slice(0, 6).map((qa, idx) => {
                        // Only show questions with valid data
                        if (!qa.question || qa.question === 'Loading...') return null
                        
                        const questionText = qa.question
                        const selectedText = qa.selected !== null && qa.selected !== undefined ? 
                          (qa.choices ? qa.choices[qa.selected] : `Option ${qa.selected + 1}`) : '—'
                        const correctText = qa.correctIndex !== null && qa.correctIndex !== undefined ? 
                          (qa.choices ? qa.choices[qa.correctIndex] : `Option ${qa.correctIndex + 1}`) : '—'
                        const correct = qa.selected === qa.correctIndex
                        return (
                          <li key={idx} className="">
                            <div className="font-medium">{questionText}</div>
                            <div className={`text-sm ${correct? 'text-green-700' : 'text-red-700'}`}>Selected: {selectedText} {correct? '(Correct)' : '(Incorrect)'}</div>
                            {!correct && (
                              <div className="text-sm text-slate-600">Correct: {correctText}</div>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)



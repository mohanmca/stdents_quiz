import React, { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const initialAuthState = {
  email: "",
  password: ""
};

const ScoreChart = ({ data }) => {
  if (!data.length) {
    return <p style={{ color: "#4b5168" }}>No attempts yet. Take a quiz to see your progress.</p>;
  }

  const sorted = [...data].sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
  const maxScore = Math.max(...sorted.map((d) => d.score));
  const minScore = Math.min(...sorted.map((d) => d.score));
  const normalize = (score) => {
    if (maxScore === minScore) return 50;
    return 100 - ((score - minScore) / (maxScore - minScore)) * 80 - 10;
  };

  const width = 320;
  const height = 140;
  const step = sorted.length > 1 ? width / (sorted.length - 1) : width;
  const points = sorted
    .map((d, idx) => `${idx * step},${normalize(d.score)}`)
    .join(" ");

  return (
    <div className="shell" style={{ marginTop: 16 }}>
      <div className="header">
        <h3 style={{ margin: 0 }}>Progress</h3>
        <p className="badge">{sorted.length} attempts tracked</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", maxWidth: 520, height: height }}>
        <defs>
          <linearGradient id="lineGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3f4bff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#6e7dff" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          points={points}
        />
        {sorted.map((d, idx) => (
          <g key={d.id || idx}>
            <circle
              cx={idx * step}
              cy={normalize(d.score)}
              r="5"
              fill="#fff"
              stroke="#3f4bff"
              strokeWidth="2"
            />
            <text x={idx * step} y={height - 8} textAnchor="middle" fontSize="11" fill="#4b5168">
              {Math.round(d.score)}%
            </text>
          </g>
        ))}
      </svg>
      <p style={{ color: "#4b5168", marginTop: 8 }}>
        Scores plotted over time (oldest → newest). Re-take quizzes to see your trend line update.
      </p>
    </div>
  );
};

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(initialAuthState);
  const [quizzes, setQuizzes] = useState([]);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [startedAt, setStartedAt] = useState(null);
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }),
    [token]
  );

  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/me`, { headers: authHeaders })
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data) => {
          setUser(data.user);
          loadQuizzes();
          loadResults();
        })
        .catch(() => {
          setToken("");
          localStorage.removeItem("token");
        });
    }
  }, [token, authHeaders]);

  const loadQuizzes = () => {
    fetch(`${API_URL}/quizzes`)
      .then((res) => res.json())
      .then((data) => setQuizzes(data.quizzes || []))
      .catch(() => setMessage("Unable to load quizzes right now."));
  };

  const loadResults = () => {
    if (!token) return;
    fetch(`${API_URL}/results`, { headers: authHeaders })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => setResults(data.results || []))
      .catch(() => setMessage("Unable to load previous attempts."));
  };

  const handleAuth = (mode) => {
    setLoading(true);
    setMessage("");
    fetch(`${API_URL}/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authForm)
    })
      .then((res) => (res.ok ? res.json() : res.json().then((d) => Promise.reject(d))))
      .then((data) => {
        const receivedToken = data.token;
        setToken(receivedToken);
        localStorage.setItem("token", receivedToken);
        setUser(data.user);
        setAuthForm(initialAuthState);
        loadQuizzes();
        loadResults();
      })
      .catch((err) => setMessage(err.error || "Something went wrong."))
      .finally(() => setLoading(false));
  };

  const startQuiz = (quiz) => {
    setCurrentQuiz(quiz);
    setAnswers({});
    setStartedAt(new Date().toISOString());
    setMessage("");
  };

  const selectAnswer = (questionId, option) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const submitQuiz = () => {
    if (!currentQuiz) return;
    setLoading(true);
    const payload = {
      answers,
      started_at: startedAt,
      completed_at: new Date().toISOString()
    };
    fetch(`${API_URL}/quizzes/${currentQuiz.id}/submit`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(payload)
    })
      .then((res) => (res.ok ? res.json() : res.json().then((d) => Promise.reject(d))))
      .then((data) => {
        setMessage(`Submitted! Score: ${Math.round(data.result.score)}%`);
        setCurrentQuiz(null);
        setAnswers({});
        setStartedAt(null);
        loadResults();
      })
      .catch((err) => setMessage(err.error || "Unable to submit."))
      .finally(() => setLoading(false));
  };

  const logout = () => {
    setToken("");
    localStorage.removeItem("token");
    setUser(null);
    setResults([]);
  };

  const authFormView = (
    <div className="shell auth-box">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Student Quiz</h2>
        <div className="pill-group">
          {["login", "register"].map((mode) => (
            <button
              key={mode}
              className={`pill ${authMode === mode ? "active" : ""}`}
              onClick={() => setAuthMode(mode)}
            >
              {mode === "login" ? "Login" : "Register"}
            </button>
          ))}
        </div>
      </div>
      <p style={{ color: "#4b5168", marginTop: 4 }}>
        {authMode === "login" ? "Welcome back. Sign in to continue." : "Create an account to start quizzing."}
      </p>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="input"
          type="email"
          value={authForm.email}
          onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
          placeholder="student@example.com"
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          className="input"
          type="password"
          value={authForm.password}
          onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
          placeholder="Choose a password"
        />
      </div>
      <button className="btn" style={{ width: "100%", marginTop: 16 }} disabled={loading} onClick={() => handleAuth(authMode)}>
        {loading ? "Working..." : authMode === "login" ? "Login" : "Register"}
      </button>
      {message ? (
        <p style={{ color: "#e63946", fontWeight: 600, marginTop: 12, textAlign: "center" }}>{message}</p>
      ) : null}
    </div>
  );

  const quizListView = (
    <div className="shell" style={{ marginTop: 16 }}>
      <div className="header">
        <div>
          <p className="badge">Signed in as {user?.email}</p>
          <h2 style={{ margin: "6px 0 0" }}>Available quizzes</h2>
          <p style={{ color: "#4b5168", marginTop: 6 }}>Pick a quiz to begin. Your progress and time are recorded.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn secondary" onClick={loadQuizzes}>
            Refresh
          </button>
          <button className="btn secondary" onClick={loadResults}>
            Results
          </button>
          <button className="btn secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
      <div className="grid" style={{ marginTop: 16 }}>
        {quizzes.map((quiz) => (
          <div key={quiz.id} className="card">
            <div className="badge">{quiz.time_limit_seconds ? `${Math.round(quiz.time_limit_seconds / 60)} min` : "Timed"}</div>
            <h3 style={{ margin: 0 }}>{quiz.title}</h3>
            <p style={{ margin: "4px 0 0", color: "#4b5168" }}>{quiz.description}</p>
            <button className="btn" onClick={() => startQuiz(quiz)}>
              Start quiz
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const quizView = currentQuiz ? (
    <div className="shell" style={{ marginTop: 16 }}>
      <div className="header">
        <div>
          <p className="badge">{currentQuiz.title}</p>
          <h2 style={{ margin: "6px 0 0" }}>Attempt</h2>
          <p style={{ color: "#4b5168" }}>
            Started at {new Date(startedAt).toLocaleTimeString()} · {currentQuiz.questions.length} questions
          </p>
        </div>
        <button className="btn secondary" onClick={() => setCurrentQuiz(null)}>
          Exit
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        {currentQuiz.questions.map((q, idx) => (
          <div key={q.id} className="question">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Q{idx + 1}. {q.text}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {q.options.map((opt) => (
                <label
                  key={opt}
                  className={`option ${answers[q.id] === opt ? "selected" : ""}`}
                  onClick={() => selectAnswer(q.id, opt)}
                >
                  <input type="radio" checked={answers[q.id] === opt} onChange={() => selectAnswer(q.id, opt)} />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className="btn" style={{ marginTop: 16 }} onClick={submitQuiz} disabled={loading}>
        {loading ? "Submitting..." : "Submit answers"}
      </button>
      {message ? (
        <p style={{ color: "#1b4332", fontWeight: 600, marginTop: 12 }}>{message}</p>
      ) : null}
    </div>
  ) : null;

  const resultsView = results.length ? (
    <>
      <ScoreChart data={results} />
      <div className="shell" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Recent activity</h3>
        <div className="grid">
          {results.map((r) => (
            <div className="card" key={r.id}>
              <div className="badge">{r.quiz_title}</div>
              <div style={{ fontWeight: 700 }}>{Math.round(r.score)}% score</div>
              <div style={{ color: "#4b5168" }}>
                {r.correct_count}/{r.total_questions} correct · completed {new Date(r.completed_at).toLocaleString()}
              </div>
              {r.duration_seconds ? (
                <div style={{ color: "#4b5168" }}>Time spent: {Math.round(r.duration_seconds)}s</div>
              ) : null}
              {r.started_at ? (
                <div style={{ color: "#4b5168" }}>
                  Started {new Date(r.started_at).toLocaleString()} • Finished {new Date(r.completed_at).toLocaleString()}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className="page">
      {!token ? (
        authFormView
      ) : (
        <>
          {quizListView}
          {quizView}
          {resultsView}
          {message && !currentQuiz ? <p style={{ color: "#e63946", marginTop: 12 }}>{message}</p> : null}
        </>
      )}
    </div>
  );
}

export default App;

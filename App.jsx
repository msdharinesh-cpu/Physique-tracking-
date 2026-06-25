import { useState, useEffect } from "react";
import {
  Camera,
  Image as ImageIcon,
  Upload,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  Target,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Flame,
  Leaf,
  X,
} from "lucide-react";

const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Sedentary", desc: "Little to no exercise" },
  { id: "light", label: "Light", desc: "Exercise 1–3 days/week" },
  { id: "moderate", label: "Moderate", desc: "Exercise 3–5 days/week" },
  { id: "active", label: "Active", desc: "Exercise 6–7 days/week" },
  { id: "veryActive", label: "Very Active", desc: "Intense daily training" },
];

const GOAL_PRESETS = [
  { id: "lean", label: "Lean & toned", desc: "Lower body fat, visible definition" },
  { id: "athletic", label: "Athletic build", desc: "Balanced muscle, moderate leanness" },
  { id: "muscular", label: "Muscular & bulky", desc: "Maximum size, calorie surplus" },
  { id: "healthy", label: "Just healthier", desc: "Sustainable fat loss, no specific look" },
];

const LOADING_MESSAGES = [
  "Reading your scan…",
  "Cross-referencing your goal…",
  "Calculating daily targets…",
  "Tuning macro split…",
];

const STEP_LABELS = ["SCAN", "VITALS", "GOAL", "TARGETS"];

export default function RecompApp() {
  const [step, setStep] = useState(1);
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [stats, setStats] = useState({ age: "", heightCm: "", weightKg: "", sex: "male", activity: "moderate" });
  const [goalMode, setGoalMode] = useState("preset");
  const [goalPreset, setGoalPreset] = useState(null);
  const [goalPhoto, setGoalPhoto] = useState(null);
  const [goalText, setGoalText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length), 1400);
    return () => clearInterval(id);
  }, [loading]);

  function handleFileChange(e, setter) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      setter({ dataUrl, base64, mediaType: file.type || "image/jpeg" });
    };
    reader.readAsDataURL(file);
  }

  const canStep1 = !!currentPhoto;
  const canStep2 = stats.age && stats.heightCm && stats.weightKg;
  const canStep3 =
    goalMode === "preset" ? !!goalPreset : goalMode === "photo" ? !!goalPhoto : goalText.trim().length > 0;

  function reset() {
    setStep(1);
    setCurrentPhoto(null);
    setStats({ age: "", heightCm: "", weightKg: "", sex: "male", activity: "moderate" });
    setGoalMode("preset");
    setGoalPreset(null);
    setGoalPhoto(null);
    setGoalText("");
    setError(null);
    setResults(null);
  }

  async function handleAnalyze() {
    setError(null);
    setStep(4);
    setLoading(true);

    const goalDescription =
      goalMode === "preset"
        ? `${GOAL_PRESETS.find((g) => g.id === goalPreset)?.label} — ${GOAL_PRESETS.find((g) => g.id === goalPreset)?.desc}`
        : goalMode === "text"
        ? goalText.trim()
        : "See the second attached image — that is their goal/reference physique.";

    const activityInfo = ACTIVITY_LEVELS.find((a) => a.id === stats.activity);

    const introText = `You are a fitness and nutrition analyst. Analyze the attached photo(s) and the stats below, then produce a daily nutrition plan.

Person's stats:
- Age: ${stats.age}
- Height: ${stats.heightCm} cm
- Weight: ${stats.weightKg} kg
- Biological sex: ${stats.sex}
- Activity level: ${activityInfo?.label} (${activityInfo?.desc})

Stated goal: ${goalDescription}

Image 1 below is their current physique.${goalMode === "photo" ? " Image 2 is their goal/reference physique." : ""}

From the current photo, give a rough visual body-fat percentage estimate as a range (this is an approximation from a photo, not a clinical measurement — be honest about that limitation). Then calculate a daily calorie target and macro targets appropriate for moving toward the stated goal at a safe, sustainable rate, plus 4-5 key vitamins/micronutrients worth paying attention to for this goal with a brief reason for each.

Respond with ONLY valid JSON, no markdown formatting, no code fences, no extra commentary, matching exactly this schema:
{
  "bodyFat": {"estimate": <number, percent>, "range": "<low>-<high>%", "confidence": "low" | "medium"},
  "calories": <number, kcal/day>,
  "protein": <number, grams/day>,
  "carbs": <number, grams/day>,
  "fats": <number, grams/day>,
  "vitamins": [{"name": "<string>", "amount": "<string with unit>", "note": "<short reason, under 15 words>"}],
  "summary": "<2-3 sentence plain-language summary of the plan and how it connects to the stated goal>",
  "tips": ["<short actionable tip>", "<short actionable tip>", "<short actionable tip>"]
}`;

    const content = [
      { type: "text", text: introText },
      { type: "image", source: { type: "base64", media_type: currentPhoto.mediaType, data: currentPhoto.base64 } },
    ];
    if (goalMode === "photo" && goalPhoto) {
      content.push({ type: "image", source: { type: "base64", media_type: goalPhoto.mediaType, data: goalPhoto.base64 } });
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content }],
        }),
      });
      const data = await response.json();
      const text = (data.content || [])
        .map((block) => (block.type === "text" ? block.text : ""))
        .filter(Boolean)
        .join("\n");
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setResults(parsed);
      setLoading(false);
      setStep(5);
    } catch (err) {
      setError("Couldn't read that scan. Try again, or use a clearer, well-lit photo.");
      setLoading(false);
      setStep(3);
    }
  }

  function renderPhotoUpload(photo, setter, inputId, helperText) {
    return (
      <div>
        {!photo ? (
          <label htmlFor={inputId} className="upload-box">
            <ImageIcon size={26} strokeWidth={1.5} />
            <span className="upload-title">Tap to upload a photo</span>
            <span className="upload-sub">{helperText}</span>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e, setter)}
              style={{ display: "none" }}
            />
          </label>
        ) : (
          <div className="photo-preview">
            <img src={photo.dataUrl} alt="uploaded" />
            <button className="photo-remove" onClick={() => setter(null)} aria-label="Remove photo">
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    );
  }

  const gaugeSize = 176;
  const stroke = 14;
  const radius = (gaugeSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = gaugeSize / 2;
  const cy = gaugeSize / 2;
  const bf = results?.bodyFat;
  const bfClamped = bf ? Math.min(Math.max(bf.estimate, 0), 40) : 0;
  const bfRatio = bfClamped / 40;
  const dashOffset = circumference * (1 - bfRatio);
  const ticks = [0, 10, 20, 30];

  const protein = results?.protein || 0;
  const carbs = results?.carbs || 0;
  const fats = results?.fats || 0;
  const kcalP = protein * 4;
  const kcalC = carbs * 4;
  const kcalF = fats * 9;
  const kcalTotal = Math.max(kcalP + kcalC + kcalF, 1);
  const pctP = (kcalP / kcalTotal) * 100;
  const pctC = (kcalC / kcalTotal) * 100;
  const pctF = (kcalF / kcalTotal) * 100;

  const rulerIndex = step <= 3 ? step : 4;

  return (
    <div className="shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');

        .shell {
          --bg: #12141c;
          --surface: #1b1e28;
          --surface2: #232838;
          --border: #2d3242;
          --text: #edeae2;
          --text-dim: #8b90a0;
          --gold: #e8a23d;
          --sage: #8aa379;
          --rust: #c1654a;
          --steel: #7c97b3;

          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', sans-serif;
          max-width: 480px;
          margin: 0 auto;
          padding: 22px 18px 32px;
          border-radius: 18px;
          box-sizing: border-box;
        }
        .shell * { box-sizing: border-box; }

        .top-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .wordmark {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: 26px;
          letter-spacing: 0.5px;
          line-height: 1;
        }
        .tagline {
          color: var(--text-dim);
          font-size: 12.5px;
          margin-top: 4px;
          letter-spacing: 0.2px;
        }
        .reset-btn {
          background: none;
          border: 1px solid var(--border);
          color: var(--text-dim);
          border-radius: 999px;
          padding: 7px 9px;
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .reset-btn:hover { color: var(--text); border-color: var(--text-dim); }

        .ruler {
          display: flex;
          gap: 6px;
          margin-bottom: 26px;
        }
        .ruler-item { flex: 1; }
        .ruler-tick {
          height: 3px;
          border-radius: 2px;
          background: var(--border);
          margin-bottom: 7px;
          transition: background 0.3s ease;
        }
        .ruler-item.active .ruler-tick, .ruler-item.done .ruler-tick { background: var(--gold); }
        .ruler-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.6px;
          color: var(--text-dim);
        }
        .ruler-item.active .ruler-label { color: var(--gold); }
        .ruler-item.done .ruler-label { color: var(--text-dim); }

        .step-title {
          font-family: 'Fraunces', serif;
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 6px;
        }
        .step-sub {
          color: var(--text-dim);
          font-size: 14px;
          line-height: 1.5;
          margin: 0 0 20px;
        }

        .upload-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 1.5px dashed var(--border);
          border-radius: 16px;
          padding: 36px 16px;
          cursor: pointer;
          color: var(--text-dim);
          text-align: center;
          transition: border-color 0.2s ease, color 0.2s ease;
        }
        .upload-box:hover { border-color: var(--gold); color: var(--gold); }
        .upload-title { font-size: 14.5px; font-weight: 600; color: var(--text); }
        .upload-sub { font-size: 12px; max-width: 280px; }

        .photo-preview {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--border);
        }
        .photo-preview img { width: 100%; display: block; max-height: 320px; object-fit: cover; }
        .photo-remove {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(18,20,28,0.75);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 999px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .privacy-note {
          font-size: 11.5px;
          color: var(--text-dim);
          margin-top: 10px;
          text-align: center;
        }

        .field-row { margin-bottom: 16px; }
        .field-label {
          display: block;
          font-size: 12px;
          letter-spacing: 0.4px;
          color: var(--text-dim);
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        input[type="number"] {
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 10px;
          padding: 12px 14px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 15px;
          outline: none;
        }
        input[type="number"]:focus { border-color: var(--gold); }
        input[type="number"]::placeholder { color: var(--text-dim); }

        .pill-row { display: flex; gap: 8px; }
        .pill {
          flex: 1;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text-dim);
          border-radius: 10px;
          padding: 10px 0;
          text-align: center;
          font-size: 13.5px;
          cursor: pointer;
        }
        .pill.active { border-color: var(--gold); color: var(--gold); background: var(--surface2); }

        .activity-grid { display: flex; flex-direction: column; gap: 8px; }
        .activity-card {
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 14px;
          cursor: pointer;
        }
        .activity-card.active { border-color: var(--gold); background: var(--surface2); }
        .activity-card .a-label { font-size: 13.5px; font-weight: 600; color: var(--text); }
        .activity-card .a-desc { font-size: 11.5px; color: var(--text-dim); }
        .activity-card.active .a-label { color: var(--gold); }

        .tab-row { display: flex; gap: 6px; margin-bottom: 16px; }
        .tab {
          flex: 1;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text-dim);
          border-radius: 999px;
          padding: 8px 0;
          text-align: center;
          font-size: 12.5px;
          cursor: pointer;
        }
        .tab.active { background: var(--gold); color: #1b1407; border-color: var(--gold); font-weight: 600; }

        .preset-grid { display: flex; flex-direction: column; gap: 8px; }
        .preset-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 13px 14px;
          cursor: pointer;
        }
        .preset-card.active { border-color: var(--gold); background: var(--surface2); }
        .preset-card .p-label { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
        .preset-card.active .p-label { color: var(--gold); }
        .preset-card .p-desc { font-size: 12px; color: var(--text-dim); }

        textarea {
          width: 100%;
          min-height: 110px;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 12px;
          padding: 12px 14px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          resize: vertical;
          outline: none;
        }
        textarea:focus { border-color: var(--gold); }

        .nav-row { display: flex; gap: 10px; margin-top: 26px; }
        .btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-radius: 12px;
          padding: 13px 0;
          font-size: 14.5px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }
        .btn-primary { background: var(--gold); color: #1b1407; }
        .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }
        .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text-dim); flex: 0 0 80px; }

        .error-banner {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          background: rgba(193,101,74,0.1);
          border: 1px solid var(--rust);
          color: var(--rust);
          border-radius: 10px;
          padding: 11px 13px;
          font-size: 13px;
          margin-top: 16px;
        }

        .loading-wrap { text-align: center; padding: 10px 0 4px; }
        .scan-photo-wrap {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          border: 1px solid var(--border);
          margin-bottom: 22px;
        }
        .scan-photo-wrap img { width: 100%; display: block; max-height: 320px; object-fit: cover; opacity: 0.55; }
        .scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--gold), transparent);
          box-shadow: 0 0 12px var(--gold);
          animation: scanmove 1.9s ease-in-out infinite alternate;
        }
        @keyframes scanmove { from { top: 2%; } to { top: 96%; } }
        .loading-msg {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--text-dim);
          font-size: 14px;
          font-family: 'IBM Plex Mono', monospace;
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .gauge-wrap { display: flex; flex-direction: column; align-items: center; margin-bottom: 22px; }
        .gauge-label { font-size: 11px; letter-spacing: 0.6px; color: var(--text-dim); text-transform: uppercase; margin-top: 8px; }
        .gauge-conf {
          font-size: 11px;
          color: var(--text-dim);
          margin-top: 4px;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 3px 10px;
        }

        .card-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 18px; }
        .stat-card {
          background: var(--surface);
          border-radius: 12px;
          padding: 12px 10px;
          border-left: 3px solid var(--border);
        }
        .stat-card .s-num { font-family: 'IBM Plex Mono', monospace; font-size: 18px; font-weight: 600; }
        .stat-card .s-label { font-size: 10.5px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.4px; margin-top: 3px; }

        .calorie-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--surface);
          border-radius: 14px;
          padding: 16px 18px;
          margin-bottom: 14px;
        }
        .calorie-banner .c-num { font-family: 'IBM Plex Mono', monospace; font-size: 30px; font-weight: 600; line-height: 1; }
        .calorie-banner .c-label { font-size: 11.5px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.4px; margin-top: 4px; }

        .macro-bar { display: flex; height: 8px; border-radius: 999px; overflow: hidden; margin-bottom: 10px; }
        .macro-legend { display: flex; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-dim); }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; }

        .section-label {
          font-size: 11px;
          letter-spacing: 0.6px;
          color: var(--text-dim);
          text-transform: uppercase;
          margin: 22px 0 10px;
        }
        .vitamin-row {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          background: var(--surface);
          border-radius: 10px;
          padding: 10px 12px;
          margin-bottom: 8px;
        }
        .vitamin-row .v-name { font-size: 13.5px; font-weight: 600; }
        .vitamin-row .v-amount { font-family: 'IBM Plex Mono', monospace; color: var(--gold); font-size: 12.5px; }
        .vitamin-row .v-note { font-size: 11.5px; color: var(--text-dim); margin-top: 2px; }

        .summary-text { font-size: 13.5px; line-height: 1.6; color: var(--text); margin-bottom: 18px; }
        .tip-row { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; color: var(--text-dim); margin-bottom: 7px; line-height: 1.5; }

        .disclaimer {
          font-size: 11px;
          color: var(--text-dim);
          line-height: 1.5;
          border-top: 1px solid var(--border);
          padding-top: 14px;
          margin-top: 22px;
        }
      `}</style>

      <div className="top-row">
        <div>
          <div className="wordmark">RECOMP</div>
          <div className="tagline">scan → stats → daily targets</div>
        </div>
        {step > 1 && (
          <button className="reset-btn" onClick={reset} aria-label="Start over">
            <RotateCcw size={15} />
          </button>
        )}
      </div>

      <div className="ruler">
        {STEP_LABELS.map((label, i) => {
          const idx = i + 1;
          const state = idx < rulerIndex ? "done" : idx === rulerIndex ? "active" : "";
          return (
            <div key={label} className={`ruler-item ${state}`}>
              <div className="ruler-tick" />
              <div className="ruler-label">0{idx} {label}</div>
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div>
          <h2 className="step-title">Scan your starting point</h2>
          <p className="step-sub">
            Upload a clear, well-lit photo of your physique — front-on, fitted clothing or activewear works best.
          </p>
          {renderPhotoUpload(currentPhoto, setCurrentPhoto, "photo-current", "Front-on, good lighting, full body or torso")}
          <p className="privacy-note">This stays in this chat — nothing is stored or shared.</p>
          <div className="nav-row">
            <button className="btn btn-primary" disabled={!canStep1} onClick={() => setStep(2)}>
              Continue <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="step-title">Your vitals</h2>
          <p className="step-sub">This helps calculate how much you actually need each day.</p>

          <div className="field-grid">
            <div className="field-row">
              <label className="field-label">Age</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="e.g. 27"
                value={stats.age}
                onChange={(e) => setStats({ ...stats, age: e.target.value })}
              />
            </div>
            <div className="field-row">
              <label className="field-label">Height (cm)</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="e.g. 175"
                value={stats.heightCm}
                onChange={(e) => setStats({ ...stats, heightCm: e.target.value })}
              />
            </div>
          </div>

          <div className="field-row">
            <label className="field-label">Weight (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="e.g. 70"
              value={stats.weightKg}
              onChange={(e) => setStats({ ...stats, weightKg: e.target.value })}
            />
          </div>

          <div className="field-row">
            <label className="field-label">Biological sex</label>
            <div className="pill-row">
              <div className={`pill ${stats.sex === "male" ? "active" : ""}`} onClick={() => setStats({ ...stats, sex: "male" })}>Male</div>
              <div className={`pill ${stats.sex === "female" ? "active" : ""}`} onClick={() => setStats({ ...stats, sex: "female" })}>Female</div>
            </div>
          </div>

          <div className="field-row">
            <label className="field-label">Activity level</label>
            <div className="activity-grid">
              {ACTIVITY_LEVELS.map((a) => (
                <div
                  key={a.id}
                  className={`activity-card ${stats.activity === a.id ? "active" : ""}`}
                  onClick={() => setStats({ ...stats, activity: a.id })}
                >
                  <div className="a-label">{a.label}</div>
                  <div className="a-desc">{a.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="nav-row">
            <button className="btn btn-ghost" onClick={() => setStep(1)}><ChevronLeft size={16} /></button>
            <button className="btn btn-primary" disabled={!canStep2} onClick={() => setStep(3)}>
              Continue <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="step-title">Where are you headed?</h2>
          <p className="step-sub">Pick a goal, upload a reference photo, or describe it in your own words.</p>

          <div className="tab-row">
            <div className={`tab ${goalMode === "preset" ? "active" : ""}`} onClick={() => setGoalMode("preset")}>Pick a goal</div>
            <div className={`tab ${goalMode === "photo" ? "active" : ""}`} onClick={() => setGoalMode("photo")}>Upload a photo</div>
            <div className={`tab ${goalMode === "text" ? "active" : ""}`} onClick={() => setGoalMode("text")}>Describe it</div>
          </div>

          {goalMode === "preset" && (
            <div className="preset-grid">
              {GOAL_PRESETS.map((g) => (
                <div
                  key={g.id}
                  className={`preset-card ${goalPreset === g.id ? "active" : ""}`}
                  onClick={() => setGoalPreset(g.id)}
                >
                  <div className="p-label">{g.label}</div>
                  <div className="p-desc">{g.desc}</div>
                </div>
              ))}
            </div>
          )}

          {goalMode === "photo" &&
            renderPhotoUpload(goalPhoto, setGoalPhoto, "photo-goal", "A physique you'd like to work toward")}

          {goalMode === "text" && (
            <textarea
              placeholder="e.g. Broader shoulders, flatter stomach — nothing extreme, just leaner and more defined."
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
            />
          )}

          {error && (
            <div className="error-banner">
              <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div className="nav-row">
            <button className="btn btn-ghost" onClick={() => setStep(2)}><ChevronLeft size={16} /></button>
            <button className="btn btn-primary" disabled={!canStep3} onClick={handleAnalyze}>
              Analyze <Sparkles size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="loading-wrap">
          <h2 className="step-title">Reading your scan</h2>
          <p className="step-sub">This takes a few seconds.</p>
          <div className="scan-photo-wrap">
            <img src={currentPhoto?.dataUrl} alt="scanning" />
            <div className="scan-line" />
          </div>
          <div className="loading-msg">
            <Loader2 size={16} className="spin" />
            {LOADING_MESSAGES[msgIndex]}
          </div>
        </div>
      )}

      {step === 5 && results && (
        <div>
          <h2 className="step-title">Your daily targets</h2>

          <div className="gauge-wrap">
            <svg width={gaugeSize} height={gaugeSize}>
              <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke="var(--steel)"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
              {ticks.map((v) => {
                const angle = (-90 + (v / 40) * 360) * (Math.PI / 180);
                const outerR = radius + stroke / 2 + 5;
                const innerR = radius + stroke / 2 - 1;
                const x1 = cx + outerR * Math.cos(angle);
                const y1 = cy + outerR * Math.sin(angle);
                const x2 = cx + innerR * Math.cos(angle);
                const y2 = cy + innerR * Math.sin(angle);
                return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--border)" strokeWidth="2" />;
              })}
              <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="28" fontWeight="600" fill="var(--text)">
                {results.bodyFat?.estimate}%
              </text>
              <text x={cx} y={cy + 16} textAnchor="middle" fontFamily="Inter" fontSize="11" fill="var(--text-dim)">
                est. body fat
              </text>
            </svg>
            <div className="gauge-label">range {results.bodyFat?.range}</div>
            <div className="gauge-conf">{results.bodyFat?.confidence} confidence — photo estimate</div>
          </div>

          <div className="calorie-banner">
            <Flame size={26} color="var(--gold)" />
            <div>
              <div className="c-num">{results.calories} kcal</div>
              <div className="c-label">daily target</div>
            </div>
          </div>

          <div className="macro-bar">
            <div style={{ width: `${pctP}%`, background: "var(--gold)" }} />
            <div style={{ width: `${pctC}%`, background: "var(--sage)" }} />
            <div style={{ width: `${pctF}%`, background: "var(--rust)" }} />
          </div>
          <div className="macro-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background: "var(--gold)" }} /> Protein {protein}g</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "var(--sage)" }} /> Carbs {carbs}g</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: "var(--rust)" }} /> Fats {fats}g</div>
          </div>

          <div className="card-grid">
            <div className="stat-card" style={{ borderLeftColor: "var(--gold)" }}>
              <div className="s-num">{protein}g</div>
              <div className="s-label">Protein</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: "var(--sage)" }}>
              <div className="s-num">{carbs}g</div>
              <div className="s-label">Carbs</div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: "var(--rust)" }}>
              <div className="s-num">{fats}g</div>
              <div className="s-label">Fats</div>
            </div>
          </div>

          {results.summary && <p className="summary-text">{results.summary}</p>}

          {results.vitamins && results.vitamins.length > 0 && (
            <div>
              <div className="section-label">Key vitamins & micronutrients</div>
              {results.vitamins.map((v, i) => (
                <div className="vitamin-row" key={i}>
                  <Leaf size={15} color="var(--sage)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <span className="v-name">{v.name} </span>
                    <span className="v-amount">{v.amount}</span>
                    <div className="v-note">{v.note}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.tips && results.tips.length > 0 && (
            <div>
              <div className="section-label">Tips</div>
              {results.tips.map((t, i) => (
                <div className="tip-row" key={i}>
                  <Target size={13} color="var(--gold)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          )}

          <p className="disclaimer">
            This is an estimate based on a single photo and general formulas — not a medical or clinical
            assessment. Check with a doctor or registered dietitian before making major changes to your diet,
            especially if you have any health conditions.
          </p>

          <div className="nav-row">
            <button className="btn btn-ghost" onClick={() => setStep(3)}><ChevronLeft size={16} /></button>
            <button className="btn btn-primary" onClick={reset}>
              <CheckCircle2 size={16} /> Start a new scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

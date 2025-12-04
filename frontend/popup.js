// popup.js - full-featured UI (confetti, shake, PDF, highlighting, url scan, dark persist)

const API = "http://127.0.0.1:5000/predict";
const KEYWORDS = [
  "verify","password","bank","account","login","click","urgent",
  "suspend","confirm","credentials","update","win","lottery","limited","verify your"
];
const URL_RE = /http[s]?:\/\/[^\s'"]+/gi;

// DOM
const root = document.getElementById("root");
const modeToggle = document.getElementById("mode");
const emailText = document.getElementById("emailText");
const checkBtn = document.getElementById("checkBtn");
const clearBtn = document.getElementById("clearBtn");
const resultArea = document.getElementById("resultArea");
const predText = document.getElementById("predText");
const metaText = document.getElementById("metaText");
const scoreNum = document.getElementById("scoreNum");
const scoreFill = document.getElementById("scoreFill");
const pulse = document.getElementById("pulse");
const badgesEl = document.getElementById("badges");
const keywordsEl = document.getElementById("keywords");
const urlsEl = document.getElementById("urls");
const previewText = document.getElementById("previewText");
const exportPdfBtn = document.getElementById("exportPdf");
const copyReportBtn = document.getElementById("copyReport");
const resultCard = document.getElementById("resultCard");
const logoImg = document.getElementById("logoImg");

// theme persistence (default light)
const THEME_KEY = "phishbuster_theme";
(function applySavedTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if(saved === "dark"){
    root.setAttribute("data-theme","dark");
    modeToggle.checked = true;
  } else {
    root.setAttribute("data-theme","light");
    modeToggle.checked = false;
  }
})();

modeToggle.addEventListener("change", () => {
  if(modeToggle.checked){
    root.setAttribute("data-theme","dark");
    localStorage.setItem(THEME_KEY,"dark");
  } else {
    root.setAttribute("data-theme","light");
    localStorage.setItem(THEME_KEY,"light");
  }
});

// optional logo show/hide
logoImg.onerror = () => { logoImg.style.display = "none"; };
logoImg.onload = () => { document.getElementById("logoLetters").style.display = "none"; logoImg.style.display = "block"; };
logoImg.src = "logo.png";

// helpers
function findKeywords(text){
  const lower = text.toLowerCase();
  const found = [];
  KEYWORDS.forEach(k=>{
    if(lower.includes(k) && !found.includes(k)) found.push(k);
  });
  return found;
}

function extractUrls(text){
  const m = text.match(URL_RE);
  return m ? m : [];
}

function evaluateUrlRisk(url){
  let score = 0;
  const u = url.toLowerCase();
  if(/\b\d{1,3}(\.\d{1,3}){3}\b/.test(u)) score += 45;
  if(/(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|shorturl)/.test(u)) score += 40;
  if((u.match(/-/g)||[]).length > 3) score += 15;
  if(/\b(login|secure|account|update|verify)\b/.test(u)) score += 15;
  return Math.min(100,score);
}

function animateScore(value){
  scoreNum.textContent = value;
  scoreFill.style.width = value + "%";
  if(value >= 75) scoreFill.style.background = "linear-gradient(90deg,var(--danger),#ffb4b4)";
  else if(value >= 45) scoreFill.style.background = "linear-gradient(90deg,#ffae42,#ffd9a8)";
  else scoreFill.style.background = "linear-gradient(90deg,var(--safe),#8cf0b3)";
  // pulse
  const size = 8 + Math.min(30, Math.round(value / 3));
  pulse.style.width = size + "px";
  pulse.style.height = size + "px";
  pulse.style.boxShadow = `0 8px 30px ${colorFromScore(value)}33`;
}

function colorFromScore(score){
  if(score >= 75) return getComputedStyle(document.documentElement).getPropertyValue('--danger') || "#ff4d4d";
  if(score >= 45) return "#ffae42";
  return getComputedStyle(document.documentElement).getPropertyValue('--safe') || "#16a34a";
}

function confettiSafe(){
  try{
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.4 },
      colors: ['#4d6aff','#6c87ff','#34d399','#fbbf24']
    });
  }catch(e){}
}

function shakeCard(){
  resultCard.classList.remove("shake");
  // force reflow
  void resultCard.offsetWidth;
  resultCard.classList.add("shake");
}

// highlight preview - simple: wrap keywords in <mark>
function makePreviewWithHighlights(text, keywords){
  if(!keywords || keywords.length === 0) return escapeHtml(text);
  let preview = escapeHtml(text);
  keywords.forEach(k=>{
    const re = new RegExp(`(${escapeRegExp(k)})`,'ig');
    preview = preview.replace(re, `<mark style="background:rgba(255,235,59,0.35);padding:0 4px;border-radius:4px;color:inherit">$1</mark>`);
  });
  // also highlight URLs
  preview = preview.replace(URL_RE, match => `<a style="color:var(--accent1);text-decoration:underline" href="${match}" target="_blank">${match}</a>`);
  return preview;
}

function escapeHtml(str){
  return (str || "").replace(/[&<>"'`=\/]/g, s => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","/":"&#x2F;","`":"&#96;","=":"&#61;"}[s]));
}
function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// export PDF
async function exportPdf(summary){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
  doc.setFontSize(18);
  doc.text("PhishBuster Report", 40, 60);
  doc.setFontSize(12);
  doc.text(`Date: ${new Date().toLocaleString()}`, 40, 86);
  doc.setFontSize(13);
  doc.text(`Prediction: ${summary.prediction}`, 40, 120);
  doc.text(`Risk score: ${summary.score}/100`, 40, 140);
  doc.text(`Keywords: ${summary.keywords.join(", ") || "None"}`, 40, 162);
  doc.text("URLs detected:", 40, 186);
  let y = 206;
  summary.urls.forEach(u=>{
    doc.text(`${u.url}  (risk ${u.risk})`, 40, y);
    y += 14;
    if(y > 720){ doc.addPage(); y = 40; }
  });
  doc.text("Full text:", 40, y+14);
  doc.setFontSize(10);
  const split = doc.splitTextToSize(summary.text, 520);
  doc.text(split, 40, y+34);
  doc.save("PhishBuster-report.pdf");
}

// copy report to clipboard
function copyReportText(summary){
  const parts = [
    `PhishBuster Report - ${new Date().toLocaleString()}`,
    `Prediction: ${summary.prediction}`,
    `Score: ${summary.score}/100`,
    `Keywords: ${summary.keywords.join(", ") || "None"}`,
    `URLs: ${summary.urls.map(u=>u.url + " (risk " + u.risk + ")").join("; ") || "None"}`,
    `\n\nText:\n${summary.text}`
  ];
  navigator.clipboard.writeText(parts.join("\n")).then(()=>{
    alert("Report copied to clipboard!");
  }).catch(()=>alert("Unable to copy report"));
}

// main scanner
async function scanText(text){
  resultArea.style.display = "block";
  predText.textContent = "Prediction: analyzing…";
  metaText.textContent = "Model + heuristics";
  badgesEl.innerHTML = "";
  keywordsEl.innerHTML = "";
  urlsEl.innerHTML = "";
  previewText.innerHTML = "";

  // 1) ML call
  let modelPred = "unknown";
  try{
    const r = await fetch(API, {
      method:'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ text })
    });
    const j = await r.json();
    modelPred = j.prediction || "unknown";
  }catch(e){
    modelPred = "error";
  }

  // keywords + display
  const keywords = findKeywords(text);
  keywords.forEach(k=>{
    const el = document.createElement("div"); el.className="kw"; el.textContent = k;
    keywordsEl.appendChild(el);
  });

  // urls
  const urls = extractUrls(text).map(u => ({ url: u, risk: evaluateUrlRisk(u) }));
  urls.forEach(u=>{
    const row = document.createElement("div");
    row.className = "url " + (u.risk >= 40 ? "danger" : "safe");
    row.innerHTML = `<div style="max-width:72%">${escapeHtml(u.url)}</div><div style="font-weight:700">${u.risk}%</div>`;
    urlsEl.appendChild(row);
  });

  // combine score
  let score = 0;
  if(modelPred === "phishing") score += 60;
  else if(modelPred === "spam") score += 35;
  else if(modelPred === "legitimate") score += 5;
  else score += 20;

  score += Math.min(30, keywords.length * 8);
  const maxUrl = urls.reduce((a,b)=> Math.max(a,b.risk), 0);
  score += Math.min(40, maxUrl);
  score = Math.min(100, Math.round(score));

  // update UI
  predText.textContent = `Prediction: ${modelPred}`;
  const b1 = document.createElement("div"); b1.className="badge"; b1.textContent = `Model: ${modelPred}`;
  const b2 = document.createElement("div"); b2.className="badge"; b2.textContent = `${keywords.length} keywords`;
  const b3 = document.createElement("div"); b3.className="badge"; b3.textContent = `${urls.length} urls`;
  badgesEl.appendChild(b1); badgesEl.appendChild(b2); badgesEl.appendChild(b3);

  animateScore(score);
  previewText.innerHTML = makePreviewWithHighlights(text, keywords);

  // visual actions
  if(score >= 75){
    // danger
    shakeCard();
  } else {
    // safe: confetti
    confettiSafe();
  }

  // attach export + copy
  const summary = { prediction:modelPred, score, keywords, urls, text };
  exportPdfBtn.onclick = ()=> exportPdf(summary);
  copyReportBtn.onclick = ()=> copyReportText(summary);

  return summary;
}

// UI wiring
checkBtn.addEventListener('click', async ()=>{
  const val = emailText.value.trim();
  if(!val){ alert("Please paste email content first"); return; }
  await scanText(val);
});

clearBtn.addEventListener('click', ()=>{
  emailText.value = "";
  resultArea.style.display = "none";
});

// hide result initially
resultArea.style.display = "none";

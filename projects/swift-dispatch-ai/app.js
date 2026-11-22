import { extractOffline } from "./src/extract.js";
import { extractWithClaude } from "./src/claude.js";
import { quote } from "./src/pricing.js";
import { draftReply } from "./src/reply.js";

const SAMPLES = [
  "My 2015 Ford F-150 won't start, I'm on the shoulder of 288 near the Manvel exit. Need a tow to my house in Pearland, about 12 miles. Call me at 281-555-0147",
  "Hey I locked my keys inside my 2019 Honda Civic at the HEB on Broadway in Pearland. My number is 832-555-0199",
  "My 2011 Jeep Grand Cherokee is stuck in the mud off of FM 521 in Rosharon, it's getting dark",
  "I was just in an accident on I-45 near the Beltway, my 2020 Toyota Camry is smoking. I need it taken to the body shop on Edgebrook, about 6 miles. 713-555-0123",
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const label = (s) => (s ? s.replace(/_/g, " ") : "—");

document.querySelectorAll("[data-sample]").forEach((b) =>
  b.addEventListener("click", () => { $("msg").value = SAMPLES[Number(b.dataset.sample)]; $("msg").focus(); }));

document.querySelectorAll("input[name=engine]").forEach((r) =>
  r.addEventListener("change", () => { $("keyRow").hidden = engine() !== "claude"; }));

const engine = () => document.querySelector("input[name=engine]:checked").value;

$("run").addEventListener("click", run);
$("copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("reply").value); setStatus("Reply copied."); }
  catch { $("reply").select(); setStatus("Press Ctrl+C to copy."); }
});

function setStatus(msg, isError = false) {
  $("status").textContent = msg;
  $("status").className = isError ? "err" : "";
}

async function run() {
  const text = $("msg").value.trim();
  if (!text) return setStatus("Paste or type a customer message first.", true);

  $("run").disabled = true;
  let job;
  let used = engine();
  try {
    if (used === "claude") {
      const key = $("apiKey").value.trim();
      if (!key) throw new Error("Enter an API key or switch to the offline demo.");
      setStatus("Asking Claude…");
      job = await extractWithClaude(text, key, $("model").value.trim() || undefined);
    } else {
      job = extractOffline(text);
    }
    setStatus(`Done (${used === "claude" ? "Claude AI" : "offline demo"}).`);
  } catch (e) {
    job = extractOffline(text);
    used = "offline";
    setStatus(`${e.message} Showing offline result instead.`, true);
  } finally {
    $("run").disabled = false;
  }
  render(job);
}

function render(job) {
  const v = job.vehicle;
  const vehicle = [v.year, v.make, v.model].filter(Boolean).join(" ") || "—";
  const urgencyClass = { normal: "ok", high: "warn", emergency: "bad" }[job.urgency] || "ok";

  $("ticket").className = "";
  $("ticket").innerHTML = `
    <p class="summary">${esc(job.summary)}</p>
    <dl>
      <dt>Service</dt><dd>${esc(label(job.service_type))}</dd>
      <dt>Vehicle</dt><dd>${esc(vehicle)} <small>(${esc(label(v.vehicle_class))})</small></dd>
      <dt>Pickup</dt><dd>${esc(job.pickup_location || "—")}</dd>
      <dt>Drop-off</dt><dd>${esc(job.destination || "—")}</dd>
      <dt>Distance</dt><dd>${job.estimated_miles != null ? esc(job.estimated_miles) + " mi" : "—"}</dd>
      <dt>Callback</dt><dd>${esc(job.callback_phone || "—")}</dd>
      <dt>Urgency</dt><dd><span class="pill ${urgencyClass}">${esc(job.urgency)}</span></dd>
      <dt>Safety</dt><dd>${job.safety_flags.length ? job.safety_flags.map((f) => `<span class="pill warn">${esc(label(f))}</span>`).join(" ") : "none"}</dd>
    </dl>
    ${job.missing_info_questions.length ? `<p class="miss-h">Still need:</p><ul>${job.missing_info_questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}`;

  const q = quote(job);
  if (q.ok) {
    $("quote").className = "";
    $("quote").innerHTML = `<table>${q.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>$${l.amount.toFixed(2)}</td></tr>`).join("")}
      <tr class="total"><td>${q.isEstimateOnly ? "Starting price" : "Estimated total"}</td><td>$${q.total.toFixed(2)}</td></tr></table>`;
  } else {
    $("quote").className = "empty";
    $("quote").textContent = q.reason;
  }

  $("reply").value = draftReply(job, q);
  $("json").textContent = JSON.stringify(job, null, 2);
}

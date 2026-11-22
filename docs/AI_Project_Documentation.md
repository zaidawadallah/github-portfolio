# AI Project Documentation — Swift Dispatch AI

**Student:** Zaid Awadallah · **Course:** COSC 4272 Senior Seminar  
**Live demo:** https://zaidawadallah.github.io/github-portfolio/projects/swift-dispatch-ai/  
**Source:** https://github.com/zaidawadallah/github-portfolio/tree/main/projects/swift-dispatch-ai

## 1. Problem
Towing customers usually contact a company by a short text or voicemail, often at night and often from a dangerous spot on a highway. The message rarely contains everything a dispatcher needs: the exact location, the vehicle, where it should go and a callback number. The dispatcher must read it, ask follow-up questions, work out a price and reply — while possibly driving.

## 2. Solution
Swift Dispatch AI is a web application that takes the raw customer message and, in a few seconds, produces:
- a **structured dispatch ticket** (service, vehicle and vehicle class, pickup, drop-off, distance, callback number, urgency, safety flags, and the questions still to ask)
- an **itemized estimate**
- a **draft SMS reply** with safety advice when needed

## 3. Features
| Feature | Details |
|---|---|
| Two extraction engines | Claude AI (Anthropic Messages API) or an offline rule-based engine |
| Structured AI output | Forced tool call with a JSON schema; invalid values repaired by `normalize()` |
| Safety triage | Highway, children, unsafe conditions, injury and hazard flags; urgency normal / high / emergency |
| Deterministic pricing | Base rates, per-mile charges, vehicle-class multiplier, highway and after-hours surcharges |
| Missing-information questions | Lists exactly what to ask before dispatching |
| Customer reply | Includes "call 911" and "stay away from traffic" advice when flagged |
| Automatic fallback | Missing key, invalid key or network error → offline engine with a visible message |
| Responsive UI | Works on a phone, which is how dispatchers actually work |

## 4. Architecture
```
index.html / app.js  (UI, rendering, HTML escaping)
        │
        ├── src/claude.js   → Anthropic Messages API (tool: record_tow_request, JOB_SCHEMA), normalize()
        ├── src/extract.js  → offline regex extractor (same schema)
        ├── src/pricing.js  → quote(job, now): itemized lines, total
        └── src/reply.js    → draftReply(job, quote)
tests/dispatch.test.mjs → 13 unit tests (node --test)
```

## 5. Design decisions
1. **AI extracts, code decides.** Prices are calculated by tested code, never by the model, so a customer can never be quoted a hallucinated number.
2. **Schema-first.** Both engines return the same object, so the UI, pricing and reply code do not care which engine ran.
3. **Graceful degradation.** The app is always usable, even with no key or no network to the API.
4. **No build step.** Plain ES modules run directly on GitHub Pages and are easy to review.
5. **Security.** The key is entered by the user, held only in memory, and sent only to `api.anthropic.com`. All model output is HTML-escaped before rendering.

## 6. Testing
Run `npm test` in `projects/swift-dispatch-ai` (Node 18+). 13 tests, all passing:
- service detection, including "explicit tow beats jump start"
- vehicle parsing: year, make, model, two-word models, medium-duty trucks
- highway and hazard flags, urgency levels
- missing-information questions
- every pricing rule (base, mileage, class multiplier, highway, after-hours, unknown distance)
- `normalize()` with an invalid AI response
- reply text includes 911 advice and the price

Manual testing: four sample messages (highway breakdown, lockout, stuck in mud, accident) on desktop and on a 390 px mobile viewport.

## 7. How to run
```bash
cd projects/swift-dispatch-ai
python3 -m http.server 8000     # open http://localhost:8000
npm test
```
Choose **Offline demo** for no setup, or **Claude AI** and paste an Anthropic API key.

## 8. Screenshots
See `screenshots/swift-dispatch-ai.png` (highway breakdown) and `screenshots/swift-dispatch-ai-accident.png` (accident with hazard).

## 9. Limitations and future work
- Distance comes only from the customer's words → add geocoding and road-distance lookup.
- API key in the browser is fine for a demo → move calls to a serverless backend for production.
- Add speech-to-text for voicemails, a ticket history database and SMS sending through a VoIP provider.
- Rates are sample values for demonstration.

## 10. AI-assisted development
Claude was used as a pair programmer for architecture, API usage, first drafts of code and tests, and a security review. Every suggestion was tested; several were corrected (see `docs/AI_PROMPT_LOG.md`).

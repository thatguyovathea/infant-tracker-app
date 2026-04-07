# Technical User Review — Claude Dev Framework v3.0.0

**Reviewer perspective:** Technically literate professional who builds software projects with Claude Code but is not a software developer by trade. Comfortable with terminal commands, git, and reading documentation, but does not write bash scripts or maintain CI/CD infrastructure.

**Date:** 2026-04-02

---

## Executive Summary (Plain Language)

The Claude Dev Framework is a set of bash scripts that watch what Claude Code does and enforce a structured development process — evaluate before coding, plan before implementing, test before committing, document before closing. It's like hiring a project manager who physically stands between Claude and the keyboard until the checklist is done.

**The good:** It solves a real problem. Claude *will* skip steps when it decides something is simple. This framework catches that mechanically. If you've ever had Claude blow past your carefully written rules in CLAUDE.md because it classified your request as "trivial," this is the fix.

**The bad:** The setup cost is significant, the dependency chain is non-trivial, and the documentation assumes you already understand Claude Code's hook system, bash scripting, and jq. The framework is clearly built by a developer, for developers, despite its potential value to a broader audience.

**Bottom line:** If you're building real projects with Claude Code and you've been burned by Claude skipping steps, this framework is worth the investment. But budget 2-4 hours for initial setup and expect a learning curve.

---

## Can I Actually Use This?

### Prerequisites Check

| Requirement | Difficulty | Notes |
|---|---|---|
| Bash 3.2+ | Easy | Already on macOS/Linux |
| jq | Easy | `brew install jq` — one command |
| Git | Easy | Already installed if you use Claude Code |
| Claude Code | Already have it | That's why you're here |
| Superpowers plugin | Easy | `/plugins` → search → install |
| Terminal comfort | Moderate | You'll need to run init scripts, read error messages, and occasionally debug hook output |
| Understanding of hooks | Hard | The documentation does not adequately explain *what hooks are* to a non-developer |

**Verdict:** 4 out of 5 prerequisites are trivial. The fifth — understanding how Claude Code hooks work, what stdin/stdout means in this context, and what "exit code 2" means for your workflow — is where non-developers will struggle.

---

## Category Assessments

### 1. Documentation Quality — 6/10

**What works:**
- The README is well-structured and gives a clear picture of what the framework does and why
- The IMPLEMENTATION_GUIDE is genuinely step-by-step — clone, cd, run init
- The HOOK_REFERENCE and RULE_REFERENCE are complete — every hook and rule has a one-line summary, the event it fires on, and how to disable it
- The GLOSSARY enforces consistent terminology, which prevents confusion

**What doesn't work:**
- The documentation assumes you already know what a "PreToolUse hook" is, what "exit 2" means, and what "stdin JSON" looks like. There is no onboarding ramp for someone who doesn't write bash
- The COMPLIANCE_ENGINEERING document is fascinating (genuinely interesting analysis of Claude's behavioral model) but is written at a systems-engineering level that most users won't engage with
- There is no "What does a typical session look like?" walkthrough showing the framework in action — no example of what the user sees when a hook fires, what the error message looks like, and what to do about it
- Error messages from hooks are terse. When `pre-commit-checks.sh` blocks a commit, you get a list of what's missing, but not what command to run to fix it
- No FAQ or common-issues section

**What's missing:**
- A 2-minute video or annotated screenshot walkthrough of a typical enforce → fix → proceed cycle
- Plain-language explanations of each hook's user-facing behavior ("When you try to commit, this hook checks if you forgot to update the version number. If you did, it stops the commit and tells you which files to update.")

### 2. Setup Experience — 7/10

**What works:**
- `init.sh` is genuinely well-built. It detects project type automatically (tried 5 profiles, picks the best match based on file patterns), handles migration from existing `.claude/` setups, and creates backups before touching anything
- The discovery interview is optional — you can skip every question and get a working setup
- Profile inheritance (`_base` → `mobile-app`, etc.) means you get sensible defaults without configuration
- Multi-machine setup is documented clearly

**What doesn't work:**
- If `init.sh` fails (e.g., jq not installed, not in a git repo), the error messages are developer-oriented ("Not inside a git repository. Run this from your project root.") rather than user-oriented ("This tool needs to be run from inside your project folder — the one with your source code. Navigate there first with `cd ~/your-project`.")
- The Superpowers plugin check happens during init but the error if it's missing doesn't explain *what* Superpowers does or *why* it's required
- Profile detection is invisible — you don't see which profile was selected or why unless you inspect `manifest.json` afterward
- No uninstall script. If you want to remove the framework, you'd need to manually delete `.claude/framework/`, remove hook entries from `settings.json`, and clean up `manifest.json`. A `teardown.sh` would be valuable

**Time investment:** 10-15 minutes for a clean setup on a new project. 20-30 minutes if you have existing `.claude/` configuration that needs migration.

### 3. Day-to-Day Workflow Impact — 8/10

**What works:**
- The evaluate-before-implement enforcement genuinely prevents Claude from jumping straight to code. When you say "add a logout button," Claude is mechanically required to present options, get your approval, then implement — it can't just start writing code
- The Superpowers workflow (brainstorm → plan → implement) adds structure that makes complex changes more predictable
- The stop-checklist catches the "Claude tried to end the session without committing" problem, which is a real and frequent issue
- Marker auto-reset after commits means each change goes through the full loop — no accumulated "I already evaluated" state carrying over to unrelated changes
- The pre-deploy-check prevents the "deployed without pushing" mistake, which can be catastrophic

**What doesn't work:**
- The framework can feel heavy for genuinely trivial changes. Fixing a typo in a comment still triggers the evaluation enforcement unless you tell Claude to skip it. The "trivial" escape hatch exists in the rules but requires Claude to correctly classify the change, which is the same judgment call the framework was built to override
- The version-bump and changelog-update enforcement assumes your project uses semantic versioning and maintains a changelog. If you don't (many personal projects don't), you'll need to disable these hooks or set up dummy version/changelog files
- 13 hooks firing on various events means there's non-trivial latency added to every file write and every commit. Each hook reads stdin, runs jq, and does file checks. On a fast machine this is barely noticeable; on slower hardware it could add up

**Net effect:** The workflow is slower but significantly more disciplined. You'll catch problems earlier, your commit history will be cleaner, and Claude won't silently skip steps. The trade-off is real overhead on small tasks.

### 4. Configuration and Customization — 7/10

**What works:**
- `manifest.json` is the single source of truth and it's well-structured — active rules, active hooks, project config, discovery answers are all in one place
- Disabling any hook or rule is documented: remove it from the manifest's `activeHooks` or `activeRules` array
- Profile system means you can create a `my-project-type.yml` with custom rules and hooks
- Discovery answers persist and drive hook behavior (e.g., `futurePlatforms` drives the scalability check, `deployCommands` drives the pre-deploy check)

**What doesn't work:**
- Editing `manifest.json` requires understanding JSON structure. No `claude-framework config` CLI for common operations like "disable the version-bump rule" or "add a protected branch"
- The relationship between `manifest.json` (what's active), `settings.json` (where hooks are registered with Claude Code), and the profile YAML (where defaults come from) is a three-way dependency that's not well-explained
- If you edit `settings.json` directly to add/remove hooks, it can get out of sync with `manifest.json`. There's no validation that the two files agree
- Custom rules require writing markdown files following a specific structure, then registering them in the profile YAML and the manifest. No template or generator for this

**What I'd want:** A `claude-framework` CLI with subcommands: `disable-rule <name>`, `add-hook <name>`, `show-config`, `validate`. Even a simple bash wrapper would suffice.

### 5. Learning Curve — 5/10

**First hour:** Clone, run init, start a session. You'll see a wall of rule summaries at session start. Claude will behave differently — it'll present evaluations and ask for approval before coding. This part "just works."

**First day:** You'll hit your first hook block. A commit will be rejected because you didn't bump the version or update the changelog. If you don't have those files configured, you'll be confused. The error message tells you *what's wrong* but not *how your project is configured* or *where to change it*.

**First week:** You'll start to internalize the workflow and either love it (because Claude is now consistently disciplined) or be frustrated by it (because trivial tasks feel heavy). You'll probably disable 1-2 hooks that don't match your project (version-bump if you don't semver, changelog-update if you don't maintain one).

**First month:** You'll have the mental model. Evaluate → plan → implement → verify → close becomes natural. You'll start appreciating the stop-checklist and the marker-reset-on-commit behavior. You'll probably forget the framework is there except when it catches something.

**Pain points along the curve:**
- No "gentle mode" or "training wheels" configuration that starts with fewer hooks and adds more as you get comfortable
- No in-session help. You can't ask Claude "why did that hook fire?" and get a useful answer because Claude doesn't have visibility into hook internals
- The Superpowers dependency means you need to learn two systems simultaneously

### 6. Error Messages and Recovery — 5/10

**What works:**
- Blocking hooks do clearly state what's wrong: "Missing version bump," "Missing changelog update," "Uncommitted changes"
- Advisory hooks add context to Claude's response without stopping your workflow
- The stop-checklist gives a numbered list of issues to resolve before ending the session

**What doesn't work:**
- Error messages are written for someone who knows what to do about them. "Version files not staged alongside source changes" assumes you know what your version files are, where they are, and what "staged" means in git terms
- When a hook blocks, there's no "run this command to fix it" suggestion. Compare to tools like ESLint which say "Run `eslint --fix` to auto-fix 3 problems"
- If a hook errors (crashes, jq parse failure, file not found), the failure mode is silent — the hook exits 0 (pass) on error, so you don't know something went wrong. This is by design (fail-open for advisory hooks) but means broken hooks are invisible
- No `--verbose` or `--debug` mode to see what hooks are doing in real-time
- The audit trail (`audit.jsonl`) exists but there's no tool to read or query it. It's append-only JSON Lines, which is fine for developers but opaque for non-developers

**What I'd want:** Actionable error messages with suggested fix commands. A `claude-framework status` command that shows which markers exist, which hooks are active, and what state the workflow is in.

### 7. Personal Project Viability — 7/10

For a solo developer building a personal project (like this infant tracker app):

**Worth it if:**
- You use Claude Code as your primary development tool
- You've been burned by Claude skipping steps, pushing without testing, or ending sessions with uncommitted work
- Your project is complex enough that discipline matters (>5 files, multiple features, production users)
- You plan to maintain the project long-term

**Not worth it if:**
- You're prototyping or exploring and want maximum speed with minimal friction
- Your project is a single-file script or a weekend hack
- You don't have a changelog or version numbering scheme
- You're not comfortable occasionally debugging bash when something goes wrong

**My assessment:** For this specific project (an infant tracker with Supabase backend, Capacitor mobile wrapper, push notifications, 49 E2E tests), the framework adds genuine value. The evaluate-before-implement enforcement alone has probably prevented several "Claude rewrote the auth layer because I asked for a color change" incidents.

### 8. Enterprise/Team Viability — 4/10

**Significant gaps for team use:**
- No multi-user support. Markers use a per-machine project hash, which is correct for single-user, but there's no concept of team-wide enforcement or shared state
- No CI/CD integration. The hooks only fire inside Claude Code sessions — if someone commits from the command line or from a different editor, none of the checks apply
- No dashboard or reporting. The audit trail is a raw JSONL file with no aggregation, visualization, or alerting
- No role-based configuration. Junior developers should probably have stricter enforcement than senior developers, but the framework has one configuration per project
- The LEGAL.md disclaimers are thorough and honest ("this is not a compliance control") but an enterprise would need to layer actual compliance tooling on top
- No SSO, no centralized management, no fleet deployment beyond "clone and init on each machine"

**Would work in a team if:** Every team member uses Claude Code, everyone runs init on their machine, and you treat it as a developer-local discipline tool rather than a team-wide enforcement system. Essentially, it's a very sophisticated `.editorconfig` for Claude Code behavior — personal discipline, not organizational control.

### 9. Honesty and Self-Awareness — 9/10

This is where the framework genuinely stands out:

- The README's Limitations section is refreshingly honest: "Enforcement is probabilistic, not absolute," "Not a compliance control," "AI-generated code carries legal risk"
- The COMPLIANCE_ENGINEERING document openly describes Claude's bypass behaviors and the framework's inability to fully prevent them
- The LEGAL.md doesn't oversell: it explicitly says the framework doesn't satisfy any regulatory framework and shouldn't be used for safety-critical systems
- The distinction between "compliance" (internal workflow discipline) and regulatory compliance is called out repeatedly
- The framework acknowledges that Claude can still rationalize past any individual enforcement layer — the defense is probabilistic, not deterministic
- Credit to prior art (PAUL, GSD, Superpowers) is specific and honest about what was adopted and what wasn't

This level of intellectual honesty is rare in developer tooling and builds trust.

### 10. Comparison to Alternatives — 6/10

**vs. Just using CLAUDE.md rules:**
The framework is dramatically better at enforcement. CLAUDE.md rules are suggestions that Claude will ignore when it classifies a task as trivial. The framework makes ignoring rules mechanically harder. However, CLAUDE.md is zero-setup and zero-friction, which matters for small projects.

**vs. PAUL (Plan-Apply-Unify Loop):**
PAUL focuses on the planning loop with subagent orchestration and dynamic rule loading. It's lighter-weight and more prompt-engineering-oriented. The Claude Dev Framework is heavier but has mechanical enforcement via hooks. Choose based on whether you want suggestions (PAUL) or guardrails (this framework).

**vs. GSD (Get Shit Done):**
GSD focuses on codebase mapping and verification. The Claude Dev Framework covers a broader workflow (evaluate through close) but is heavier. GSD might be better for teams that want less friction and more trust in Claude's judgment.

**vs. Custom hooks (DIY):**
You could write 2-3 hooks yourself for the specific behaviors you care about. The framework's value is the *system* — 13 hooks that work together, with marker tracking, integrity verification, and profile inheritance. Building this yourself would take weeks.

**What's not compared:** The documentation doesn't compare to GitHub Actions, pre-commit hooks, or Husky, which serve a similar "enforce process before commit" role in non-AI-assisted development. A comparison section showing "what this replaces that you were doing with git hooks" would help users understand the value proposition.

---

## Time Investment Estimate

| Activity | Time | One-time or Ongoing |
|---|---|---|
| Read README + Implementation Guide | 30 min | One-time |
| Install prerequisites (jq, Superpowers) | 10 min | One-time |
| Run init on first project | 15 min | Per project |
| Understand first hook block and resolve it | 30 min | One-time |
| Internalize workflow (evaluate → close) | 1-2 weeks | One-time |
| Configure/disable hooks for your project | 30 min | Per project |
| Framework updates (`git pull` + `sync.sh`) | 5 min | Monthly |
| **Total first-project investment** | **~2-4 hours** | |
| **Ongoing per-session overhead** | **~5-10 min** | Per session |

---

## What I Wish Existed

1. **A "first session" walkthrough** — annotated example showing what the user sees at each enforcement point, what the error messages look like, and what to do
2. **A `claude-framework` CLI wrapper** — `status`, `disable-rule`, `add-hook`, `validate`, `logs` subcommands
3. **A "lite" mode** — start with 3-4 essential hooks (evaluate, stop-checklist, branch-safety) and opt into more as you get comfortable
4. **Actionable error messages** — "Run `git add CHANGELOG.md && git commit` to fix" instead of "Missing changelog update"
5. **An uninstall script** — `teardown.sh` that cleanly removes the framework from a project
6. **A visual status indicator** — something in the terminal that shows the current workflow state (evaluated? planned? superpowers invoked?) without inspecting marker files
7. **A non-developer README** — parallel documentation track that explains the same concepts without assuming bash/jq/hook knowledge
8. **Hook dry-run mode** — `--dry-run` flag that shows what hooks *would* do without actually blocking

---

## Honest Recommendation

**For technically literate non-developers building real projects with Claude Code:** **Conditionally recommended.**

The framework solves a genuine, painful problem — Claude's tendency to skip its own rules. The enforcement is real and effective. The workflow it imposes (evaluate → plan → implement → verify → close) genuinely improves output quality.

But the barrier to entry is higher than it needs to be. The documentation assumes developer knowledge, the error messages assume you know what to do, and the configuration requires editing JSON files and understanding three-way file relationships. A technically literate non-developer *can* use this framework, but will need patience during setup and the first week of use.

**If you have 2-4 hours and moderate frustration tolerance:** Install it. The workflow discipline it enforces will pay for itself within a few sessions.

**If you want zero friction and are doing small projects:** Stick with CLAUDE.md rules and accept that Claude will occasionally skip them.

### Overall Usability Rating

| Category | Score |
|---|---|
| Documentation Quality | 6/10 |
| Setup Experience | 7/10 |
| Day-to-Day Workflow Impact | 8/10 |
| Configuration and Customization | 7/10 |
| Learning Curve | 5/10 |
| Error Messages and Recovery | 5/10 |
| Personal Project Viability | 7/10 |
| Enterprise/Team Viability | 4/10 |
| Honesty and Self-Awareness | 9/10 |
| Comparison to Alternatives | 6/10 |
| **Overall** | **6.4/10** |

The framework's engineering is strong and its problem analysis is exceptional. Its accessibility to non-developers is where it falls short. With a CLI wrapper, better error messages, and a parallel non-developer documentation track, this could easily be an 8/10.

---

*Review conducted against framework v3.0.0 (commit 5522677) as deployed on the infant tracker project (profile: web-api, 14 active rules, 11 active hooks, 3 security hooks added locally).*

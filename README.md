# letsappeal-start

**This repo serves `start.letsappeal.com` and nothing else.**

Read that line again before changing anything, because it was wrong in this README until
2026-08-13 and the mistake cost real work.

| URL | File | What it is |
|---|---|---|
| `start.letsappeal.com/` | `index.html` | The ad landing page. Meta ads point here |
| `start.letsappeal.com/appeal.html` | `appeal.html` | Your First Letter, the free tool. Google ads point here |
| `start.letsappeal.com/privacy.html` | `privacy.html` | Privacy policy |
| `start.letsappeal.com/guarantee.html` | `guarantee.html` | 14-day guarantee |

## letsappeal.com is a different site, in a different repo

The apex domain is served by the Vercel project **`letsappeal-site`**, built from
**`github.com/garrettqa/letsappeal-site`**. It is a separate website with its own palette
(deep navy, teal, gold), its own design system in `assets/brand.css`, its own course content,
and its own GLP-1 and hardship sections. Nothing in this repo reaches it.

This matters because it is easy to get wrong:

- This repo used to contain a `home.html` plus host-based `routes` in `vercel.json` aimed at
  serving `letsappeal.com` from here. The domain moved to `letsappeal-site` at some point and the
  config was never cleaned up, so the file and the rules sat here doing nothing.
- On 2026-08-03 a full redesign was applied to that `home.html`, verified as live, and reported as
  live. It was not live. It had never been live. Nothing served it.
- Both were removed on 2026-08-13. If you want to change what people see at `letsappeal.com`, work
  in the other repo.

**Before editing any file here, confirm which hostname serves it.** `curl -sL https://letsappeal.com/ | grep -o '<title>[^<]*'`
against the same on `start.letsappeal.com` takes five seconds and settles it.

## vercel.json is deliberately almost empty

It carries only `$schema`. Static files are served from the filesystem by default, which is all
this project needs now that there is no host-based routing.

Two lessons are preserved here in case routing is ever needed again, both learned the hard way:

**Use `routes`, not `rewrites`, for anything that must beat the filesystem.** Vercel evaluates
`rewrites` *after* the filesystem, so a rewrite on `/` never fires because `/` already matches
`index.html`. Legacy `routes` are evaluated *before* the filesystem, with
`{ "handle": "filesystem" }` as the fallthrough.

**You cannot put comments in `vercel.json`.** It is schema-validated and rejects unknown top-level
properties, including the `"//"` trick. Adding one fails the build, and Vercel keeps serving the
previous deployment, so the site looks fine while your change is silently not live. Check the
Deployments tab if a change seems to have no effect.

## Things that are load-bearing

- **GA4 `G-TBFMF11ME4` and Google Ads `AW-18278890681`** on every page. Same IDs across all
  subdomains, which is why no cross-domain linker is needed.
- **Meta Pixel `1031029212882366`**. PageView everywhere, plus ViewContent, Lead,
  CompleteRegistration and InitiateCheckout. Advanced Matching is deliberately OFF and must stay
  off. `privacy.html` promises in writing that no email is attached to these signals.
- **`api/capi.js`** mirrors browser events to the Conversions API with a shared `event_id` so Meta
  deduplicates the pair. It must never send `em`, `ph`, `fn` or `ln`.
- **`appeal.html` transmits nothing** except the first name and email typed on the last screen.
  Every answer about the claim stays in the browser. The privacy policy promises this in writing,
  so it is not a detail that can quietly change.
- **Meta ads optimise for ViewContent**, which fires on `appeal.html`. Breaking that event breaks
  ad delivery, not just reporting.

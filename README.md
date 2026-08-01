# letsappeal-start

One Vercel project serving two sites.

| URL | File | What it is |
|---|---|---|
| `letsappeal.com/` | `home.html` | The marketing homepage |
| `start.letsappeal.com/` | `index.html` | The ad landing page |
| `start.letsappeal.com/appeal.html` | `appeal.html` | Your First Letter, the free tool |
| `www.letsappeal.com` | | 307 to the apex, configured in Vercel not in DNS |

## Two things about vercel.json that will bite you

**1. It must use `routes`, not `rewrites`.**

Vercel evaluates `rewrites` *after* the filesystem. So a rewrite on `/` never fires, because `/`
already matches `index.html` and the filesystem wins. The apex silently served the ad landing page
instead of the homepage, and it looked like a DNS or cache problem rather than a config one.

Legacy `routes` are evaluated *before* the filesystem, with `{ "handle": "filesystem" }` as the
fallthrough. That is why this file looks old-fashioned. Do not "modernise" it back to `rewrites`
without testing **both** hostnames afterwards.

**2. You cannot put comments in it.**

`vercel.json` is schema-validated and rejects unknown top-level properties, including the common
`"//"` comment trick. Adding one fails the build with
`should NOT have additional property '//'`, and Vercel keeps serving the previous deployment, so the
site looks fine while your change is silently not live. Check the Deployments tab if a change seems
to have no effect. That is why this explanation lives in the README instead.

## Adding a page

A new file is served on **every** hostname by default. If a page belongs to only one of them, add a
matching host rule to `routes`.

## Things that are load-bearing

- **GA4 `G-TBFMF11ME4` and Google Ads `AW-18278890681`** on every page. Same IDs across all
  subdomains, which is why no cross-domain linker is needed.
- **Meta Pixel `1031029212882366`**, PageView everywhere plus Lead on signup. Advanced Matching is
  deliberately OFF and should stay off.
- **UTM pass-through** on `home.html`, copying incoming `utm_*` onto the Whop and tool links.
- **`appeal.html` transmits nothing** except the first name and email typed on the last screen. Every
  answer about the claim stays in the browser. The privacy policy promises this in writing, so it is
  not a detail that can quietly change.

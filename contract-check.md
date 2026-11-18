# My schema, auth and contract checks (week 4, project P4)

App: Conduit practice app on my laptop · Date: 2026-11-18

## 1. My first look
How I would check that an article answer has the right shape: Check all the keys from API.md are there, and check their types instead of their values

## 2. Practice: the key list check
File: `P4/materials/contract-example.spec.ts` (the sign-up answer).
Three changes: `bio` is missing · a new field `password` is added · `token` becomes a number.
- **The toMatchObject check (worked example):** missing: passes · new field: passes · number: fails
- **The key list check (my answer):** missing: fails · new field: fails · number: passes

## 3. My prompt for Claude
```text
Task: Write Playwright API tests in P4/tests/contract.spec.ts. Schema checks: the answers of GET /api/articles/:slug and GET /api/user have the shape that API.md gives, checked with toMatchObject and expect.any. Auth tests: no token, a wrong token, and changing someone else's article. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/tests/example.spec.ts Send requests with the request fixture, like this example.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Do not run the tests. Check every field from API.md with expect.any, and check the exact key list too.
```

## 4. Claude's tests and my run
- **Run:** `npx playwright test tests/contract.spec.ts` · **Result:** 5 passed, 0 failed
- **A red test, and who was wrong:** No test failed.

## 5. The teammate's question
- **Claude's test:** "GET /api/articles/:slug answers with the Article shape" (from another run; my own article test already had an exact key list, because of my rule)
- **Claude said:** "an anonymous reader gets 200 and the full Article shape."
- **My answer:** No. toMatchObject ignores fields it doesn't list, so a password field would pass. Only an exact key list check would turn it red.

## 6. My change
- **What I asked Claude:** "In the Article shape test, toMatchObject lets in extra fields. Add an exact key list check for the article and its author, with the keys from API.md. Do not run the tests." (practice line for the test from another run, not sent: my own file already had the key lists)
- **The run after it:** no change to my file · 5 passed, 0 failed

## 7. Proof: the contract test fails when the answer changes
- **My prediction before the run:** I think "GET /api/articles/:slug returns the Article shape from API.md" will fail, because its exact key list expects all 10 article keys and F2 removes one. The User and token tests don't read an article, so they pass. The 403 test only checks the title, so it passes too, unless the missing field is title.
- **Run with the practice fault F2 on:** `$env:CONDUIT_FAULT = "F2"`, then `npx playwright test tests/contract.spec.ts` · **Result:** 1 failed, 4 passed. Failed: "GET /api/articles/:slug returns the Article shape from API.md"
- **What Playwright showed:** the key list check on line 95: `- Expected - 1` / `+ Received + 0`, with `-   "body",`
- **My answer about a red test:** The Article shape test failed at the key list check (line 95). Expected has "body" and Received doesn't, so F2 removes the body field from the article answer. The 403 test passed because it only checks the title
- **Run with the fault off again:** `$env:CONDUIT_FAULT = ""`, then the same run · **Result:** 5 passed, 0 failed
- **Note:** I had help from Claude on the prediction in section 7 and the red-test answer.

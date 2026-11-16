# API review: Claude's first API tests (week 4, project P4)

The coach fills this in from your answers. Check that every line is what you decided and what you saw.

- **App:** Conduit, the practice app on your own laptop (`http://127.0.0.1:3000`)
- **API description:** `P4/API.md`
- **Test file:** `P4/tests/api.spec.ts`, written by Claude
- **Prompt file:** `P4/prompts/api.md`

## 1. My first look, by hand
The request my comment sent in the app, and the status that came back.
- The line that sent your comment used POST, and the status that came back was 201 Created. The other line was a GET that came back 200 OK. It loaded the comment list again so your new comment would appear on the page

## 2. My predictions and the real answers
One line per request: what I predicted, and what the app really answered.
- **A** (a comment, with the token): I predicted 201. The body has a comment object whose body is "Clear and useful.", and its author.username should be practice-reader. The comment also gets its own id. The app answered 201, a comment with id 5, body "Clear and useful.", author practice-reader.
- **B** (the same comment, with no token): I predicted 401. The body is {"errors":{"token":["is missing"]}}. This endpoint needs a token and the request sends none, so it fails before the server checks the article or the comment. The app answered 401, {"errors":{"token":["is missing"]}}.
- **C** (a comment on an article that does not exist): I predicted 404. The body is {"errors":{"article":["not found"]}}. The token and the body are fine, but there's no article with the slug no-such-article. The app answered 404, {"errors":{"article":["not found"]}}.

What surprised me: A surprised me most. I only sent the comment text, but the app sent back the whole comment, with a new id and the author. I think it does this so the page can show the comment straight away, and so a test can get the comment's id. A test needs that id later to delete the comment with DELETE /api/articles/:slug/comments/:id.

## 3. My prompt to Claude
```text
Task: Write at least 6 Playwright API tests for articles in the Conduit API: create, read, change and delete an article. At least 3 positive and at least 3 negative tests. Save them in P4/tests/api.spec.ts. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/tests/example.spec.ts Send requests with the request fixture, like this example.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Do not run the tests. After each change, GET the article again to prove the change was saved
```

## 4. The run
- **Result:** 9 tests: 8 passed, 1 failed.
- **A red test, and who is wrong** (only if a test failed):
  - Test: "change: the author changes description and body, other fields stay" (failed at the tagList check)
  - Expected: ["testing", "api"] · Received: []
  - API.md says: "Updating: every field is optional. A field you do not send stays as it was."
  - My answer: The app is wrong, not the test. The test creates an article with tags testing, api, then sends a PUT with only description and body. API.md says every field you don't send stays as it was, so the tags should stay. But the GET afterwards shows tagList: [], so the update removed the tags. The test is right and should stay red until the app is fixed.
- **My note** (only if I kept a red test with `test.fail()`): PUT without tagList removes all tags; API.md says fields not sent stay as they were.

## 5. The developer's question
The test I looked at, and my answer to: "So the app saved nothing, right?"
- **Test:** "create without a title gives 422 "title can't be blank"" (from another run)
- **My answer:** Not yet. The test proves the app answers correctly: 422 and the right message. It doesn't prove the app didn't save an article without a title. To be sure, the test should also send a GET for this user's articles afterwards and check that there are none.

## 6. Tests I reviewed with the API checklist
The API checklist: status · body · shape · negative cases (a refused request changes nothing) · own test data.

### "change with tagList null gives 422, and the tags stay the same"
- **My decision:** Change it. The status and the GET for the tags are good, so keep them. But it doesn't check the error body. API.md doesn't give the exact text, but it does say the error's key names the field that's wrong, so the test should check that the answer has errors.tagList. Without that, a 422 with an empty or wrong body would still pass.

## 7. My API rules
The rules I added to my `playwright-quality` skill, under `## API rules`:
1. Read the data again. After every request that changes data or is refused, the test sends a GET and checks the data is what API.md says. (From the tags bug: the PUT answered 200, but only the GET showed the tags were gone.)
2. Check the body, not only the status. Every test checks the exact values in the answer. For an error, it checks that the errors key names the wrong field, as API.md describes. (From the tagList: null test, which checked 422 but not errors.tagList.)
3. A refused request changes nothing. For every negative test, a GET proves nothing was created, changed or deleted. (From the "no title, 422" test: the answer looked right, but nothing proved no article was saved.)

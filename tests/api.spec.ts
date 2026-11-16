import { test, expect, APIRequestContext } from '@playwright/test';

// Test data. Each piece is defined here only.
// API.md: passwords need at least 8 characters.
const PASSWORD = 'password123';

const ARTICLE = {
  title: 'API test article',
  description: 'A short description',
  body: 'The body of the API test article.',
  tagList: ['testing', 'api'],
};

const CHANGED = {
  description: 'A changed description',
  body: 'A changed body.',
};

// Signs up a new user with a unique name, so each test can run alone.
async function signUp(request: APIRequestContext, prefix: string) {
  const id = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const username = `${prefix}${id}`;
  const response = await request.post('/api/users', {
    data: { user: { username, email: `${username}@example.com`, password: PASSWORD } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return { username, token: json.user.token as string };
}

function auth(token: string) {
  return { Authorization: `Token ${token}` };
}

// Creates ARTICLE as this user and returns its slug.
async function createArticle(request: APIRequestContext, token: string) {
  const response = await request.post('/api/articles', {
    headers: auth(token),
    data: { article: ARTICLE },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return json.article.slug as string;
}

// ---------- Positive tests ----------

test('create: a signed-in user creates an article, and GET returns it', async ({ request }) => {
  const author = await signUp(request, 'author');

  const response = await request.post('/api/articles', {
    headers: auth(author.token),
    data: { article: ARTICLE },
  });
  expect(response.status()).toBe(201);
  const created = (await response.json()).article;
  expect(created.title).toBe(ARTICLE.title);
  expect(created.description).toBe(ARTICLE.description);
  expect(created.body).toBe(ARTICLE.body);
  expect(created.tagList).toEqual(ARTICLE.tagList);
  expect(created.author.username).toBe(author.username);

  // GET again to prove the article was saved.
  const check = await request.get(`/api/articles/${created.slug}`);
  expect(check.status()).toBe(200);
  const saved = (await check.json()).article;
  expect(saved.slug).toBe(created.slug);
  expect(saved.title).toBe(ARTICLE.title);
  expect(saved.description).toBe(ARTICLE.description);
  expect(saved.body).toBe(ARTICLE.body);
  expect(saved.tagList).toEqual(ARTICLE.tagList);
  expect(saved.author.username).toBe(author.username);
});

test('read: GET by slug without a token returns the full article', async ({ request }) => {
  const author = await signUp(request, 'author');
  const slug = await createArticle(request, author.token);

  // API.md: the token is optional for GET /api/articles/:slug.
  const response = await request.get(`/api/articles/${slug}`);
  expect(response.status()).toBe(200);
  const article = (await response.json()).article;
  expect(article.slug).toBe(slug);
  expect(article.title).toBe(ARTICLE.title);
  expect(article.description).toBe(ARTICLE.description);
  expect(article.body).toBe(ARTICLE.body);
  expect(article.tagList).toEqual(ARTICLE.tagList);
  expect(article.author.username).toBe(author.username);
  expect(article.favorited).toBe(false);
});

test('change: the author changes description and body, other fields stay', async ({ request }) => {
  // PUT without tagList removes all tags; API.md says fields not sent stay as they were.
  test.fail();
  const author = await signUp(request, 'author');
  const slug = await createArticle(request, author.token);

  // The title is not sent, so it stays, and (this app) the slug stays too.
  const response = await request.put(`/api/articles/${slug}`, {
    headers: auth(author.token),
    data: { article: CHANGED },
  });
  expect(response.status()).toBe(200);
  const updated = (await response.json()).article;
  expect(updated.description).toBe(CHANGED.description);
  expect(updated.body).toBe(CHANGED.body);

  // GET again to prove the change was saved.
  const check = await request.get(`/api/articles/${slug}`);
  expect(check.status()).toBe(200);
  const saved = (await check.json()).article;
  expect(saved.description).toBe(CHANGED.description);
  expect(saved.body).toBe(CHANGED.body);
  expect(saved.title).toBe(ARTICLE.title);
  expect(saved.tagList).toEqual(ARTICLE.tagList);
});

test('delete: the author deletes the article, and GET then gives 404', async ({ request }) => {
  const author = await signUp(request, 'author');
  const slug = await createArticle(request, author.token);

  const response = await request.delete(`/api/articles/${slug}`, {
    headers: auth(author.token),
  });
  expect(response.status()).toBe(204);
  expect(await response.text()).toBe('');

  // GET again to prove the article is gone.
  const check = await request.get(`/api/articles/${slug}`);
  expect(check.status()).toBe(404);
  expect(await check.json()).toEqual({ errors: { article: ['not found'] } });
});

// ---------- Negative tests ----------

test('create without a title gives 422, and no article is saved', async ({ request }) => {
  const author = await signUp(request, 'author');

  const response = await request.post('/api/articles', {
    headers: auth(author.token),
    data: { article: { description: ARTICLE.description, body: ARTICLE.body } },
  });
  expect(response.status()).toBe(422);
  expect(await response.json()).toEqual({ errors: { title: ["can't be blank"] } });

  // GET again to prove nothing was saved for this new author.
  const check = await request.get(`/api/articles?author=${author.username}`);
  expect(check.status()).toBe(200);
  const list = await check.json();
  expect(list.articlesCount).toBe(0);
  expect(list.articles).toEqual([]);
});

test('change without a token gives 401, and the article stays the same', async ({ request }) => {
  const author = await signUp(request, 'author');
  const slug = await createArticle(request, author.token);

  const response = await request.put(`/api/articles/${slug}`, {
    data: { article: CHANGED },
  });
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ errors: { token: ['is missing'] } });

  // GET again to prove nothing changed.
  const check = await request.get(`/api/articles/${slug}`);
  expect(check.status()).toBe(200);
  const saved = (await check.json()).article;
  expect(saved.description).toBe(ARTICLE.description);
  expect(saved.body).toBe(ARTICLE.body);
});

test("change someone else's article gives 403, and the article stays the same", async ({ request }) => {
  const author = await signUp(request, 'author');
  const other = await signUp(request, 'other');
  const slug = await createArticle(request, author.token);

  const response = await request.put(`/api/articles/${slug}`, {
    headers: auth(other.token),
    data: { article: CHANGED },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ errors: { article: ['forbidden'] } });

  // GET again to prove nothing changed.
  const check = await request.get(`/api/articles/${slug}`);
  expect(check.status()).toBe(200);
  const saved = (await check.json()).article;
  expect(saved.description).toBe(ARTICLE.description);
  expect(saved.body).toBe(ARTICLE.body);
});

test("delete someone else's article gives 403, and the article is still there", async ({ request }) => {
  const author = await signUp(request, 'author');
  const other = await signUp(request, 'other');
  const slug = await createArticle(request, author.token);

  const response = await request.delete(`/api/articles/${slug}`, {
    headers: auth(other.token),
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ errors: { article: ['forbidden'] } });

  // GET again to prove the article was not deleted.
  const check = await request.get(`/api/articles/${slug}`);
  expect(check.status()).toBe(200);
  const saved = (await check.json()).article;
  expect(saved.title).toBe(ARTICLE.title);
  expect(saved.author.username).toBe(author.username);
});

test('change with tagList null gives 422, and the tags stay the same', async ({ request }) => {
  const author = await signUp(request, 'author');
  const slug = await createArticle(request, author.token);

  const response = await request.put(`/api/articles/${slug}`, {
    headers: auth(author.token),
    data: { article: { tagList: null } },
  });
  // API.md gives the status only, not the exact error text.
  expect(response.status()).toBe(422);

  // GET again to prove the tags did not change.
  const check = await request.get(`/api/articles/${slug}`);
  expect(check.status()).toBe(200);
  const saved = (await check.json()).article;
  expect(saved.tagList).toEqual(ARTICLE.tagList);
});

import { test, expect, APIRequestContext } from '@playwright/test';

// Field lists come from API.md.
const USER_KEYS = ['email', 'token', 'username', 'bio', 'image'];
const ARTICLE_KEYS = [
  'slug',
  'title',
  'description',
  'body',
  'tagList',
  'createdAt',
  'updatedAt',
  'favorited',
  'favoritesCount',
  'author',
];
const PROFILE_KEYS = ['username', 'bio', 'image', 'following'];

function sorted(keys: string[]): string[] {
  return [...keys].sort();
}

// Signs up a new user with a unique name. Returns the token and the username.
async function signUp(request: APIRequestContext, prefix: string) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const username = `${prefix}-${id}`;
  const response = await request.post('/api/users', {
    data: {
      user: {
        username,
        email: `${username}@example.com`,
        password: 'password123',
      },
    },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return { token: json.user.token as string, username };
}

// Creates an article for the user with this token. Returns its slug.
async function createArticle(request: APIRequestContext, token: string, title: string) {
  const response = await request.post('/api/articles', {
    headers: { Authorization: `Token ${token}` },
    data: {
      article: {
        title,
        description: 'Contract test description',
        body: 'Contract test body',
        tagList: ['contract'],
      },
    },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return json.article.slug as string;
}

test.describe('Schema checks', () => {
  test('GET /api/user returns the User shape from API.md', async ({ request }) => {
    const { token } = await signUp(request, 'schema-user');

    const response = await request.get('/api/user', {
      headers: { Authorization: `Token ${token}` },
    });

    expect(response.status()).toBe(200);
    const json = await response.json();

    expect(Object.keys(json)).toEqual(['user']);
    expect(sorted(Object.keys(json.user))).toEqual(sorted(USER_KEYS));

    // API.md: a new user has bio and image set to null.
    expect(json).toMatchObject({
      user: {
        email: expect.any(String),
        token: expect.any(String),
        username: expect.any(String),
        bio: null,
        image: null,
      },
    });
  });

  test('GET /api/articles/:slug returns the Article shape from API.md', async ({ request }) => {
    const { token } = await signUp(request, 'schema-author');
    const slug = await createArticle(request, token, `Schema check ${Date.now()}`);

    const response = await request.get(`/api/articles/${slug}`);

    expect(response.status()).toBe(200);
    const json = await response.json();

    expect(Object.keys(json)).toEqual(['article']);
    expect(sorted(Object.keys(json.article))).toEqual(sorted(ARTICLE_KEYS));
    expect(sorted(Object.keys(json.article.author))).toEqual(sorted(PROFILE_KEYS));

    // API.md: a new user has bio and image set to null.
    expect(json).toMatchObject({
      article: {
        slug: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        body: expect.any(String),
        tagList: expect.any(Array),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        favorited: expect.any(Boolean),
        favoritesCount: expect.any(Number),
        author: {
          username: expect.any(String),
          bio: null,
          image: null,
          following: expect.any(Boolean),
        },
      },
    });
  });
});

test.describe('Auth checks', () => {
  test('GET /api/user with no token gives 401 "is missing"', async ({ request }) => {
    const response = await request.get('/api/user');

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ errors: { token: ['is missing'] } });
  });

  test('GET /api/user with a wrong token gives 401 "is invalid"', async ({ request }) => {
    const response = await request.get('/api/user', {
      headers: { Authorization: 'Token this-is-not-a-real-token' },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ errors: { token: ['is invalid'] } });
  });

  test("changing someone else's article gives 403 and the article stays the same", async ({ request }) => {
    const author = await signUp(request, 'auth-author');
    const other = await signUp(request, 'auth-other');
    const title = `Owned article ${Date.now()}`;
    const slug = await createArticle(request, author.token, title);

    const response = await request.put(`/api/articles/${slug}`, {
      headers: { Authorization: `Token ${other.token}` },
      data: { article: { title: 'Changed by someone else' } },
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ errors: { article: ['forbidden'] } });

    const check = await request.get(`/api/articles/${slug}`);
    expect(check.status()).toBe(200);
    const json = await check.json();
    expect(json.article.title).toBe(title);
  });
});

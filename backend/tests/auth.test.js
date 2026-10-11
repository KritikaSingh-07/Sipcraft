const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { request, setup, teardown, ORIGIN, refreshCookie, cookiePair } = require('./helpers');

let app;
let agent;
const csrf = { 'X-Requested-With': 'XMLHttpRequest', Origin: ORIGIN };

const register = (body) => agent.post('/api/auth/register').set('Origin', ORIGIN).send(body);
const login = (email, password) => agent.post('/api/auth/login').set('Origin', ORIGIN).send({ email, password });
const refresh = (cookie) => agent.post('/api/auth/refresh').set(csrf).set('Cookie', cookie);

describe('Authentication & authorization', () => {
  before(async () => {
    ({ app } = await setup());
    agent = request(app);
  });
  after(teardown);

  it('registers a user, ignores a client-supplied admin role and sets a secure refresh cookie', async () => {
    const res = await register({ name: 'Test Shopper', email: 'shopper@example.com', password: 'Shopper123', confirmPassword: 'Shopper123', role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'user');
    assert.ok(res.body.data.accessToken);
    assert.equal(res.body.data.user.password, undefined);
    const cookie = refreshCookie(res);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Path=\/api\/auth/);
    assert.ok(!JSON.stringify(res.body).includes(cookiePair(cookie).split('=')[1]), 'refresh token must not be in the body');
  });

  it('rejects weak passwords, mismatched confirmation and duplicate emails', async () => {
    assert.equal((await register({ name: 'A B', email: 'weak@example.com', password: 'short', confirmPassword: 'short' })).status, 400);
    assert.equal((await register({ name: 'A B', email: 'mm@example.com', password: 'Shopper123', confirmPassword: 'Shopper124' })).status, 400);
    assert.equal((await register({ name: 'A B', email: 'shopper@example.com', password: 'Shopper123', confirmPassword: 'Shopper123' })).status, 409);
  });

  it('logs in with valid credentials and rejects wrong password / unknown email identically', async () => {
    const ok = await login('shopper@example.com', 'Shopper123');
    assert.equal(ok.status, 200);
    const badPw = await login('shopper@example.com', 'Wrong12345');
    const badEmail = await login('nobody@example.com', 'Shopper123');
    assert.equal(badPw.status, 401);
    assert.equal(badEmail.status, 401);
    assert.equal(badPw.body.message, badEmail.body.message);
  });

  it('protects /me: valid, missing, tampered, alg=none and expired tokens', async () => {
    const { body } = await login('shopper@example.com', 'Shopper123');
    const token = body.data.accessToken;
    assert.equal((await agent.get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status, 200);
    assert.equal((await agent.get('/api/auth/me')).status, 401);

    const [h, p, s] = token.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    payload.role = 'admin';
    const tampered = `${h}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${s}`;
    assert.equal((await agent.get('/api/admin/dashboard').set('Authorization', `Bearer ${tampered}`)).status, 401);

    const none = jwt.sign({ sub: payload.sub, role: 'admin', typ: 'access' }, null, { algorithm: 'none', issuer: 'sipcraft-api', audience: 'sipcraft-web' });
    assert.equal((await agent.get('/api/auth/me').set('Authorization', `Bearer ${none}`)).status, 401);

    const expired = jwt.sign({ sub: payload.sub, role: 'user', typ: 'access' }, process.env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      expiresIn: -10,
      issuer: 'sipcraft-api',
      audience: 'sipcraft-web',
    });
    const exp = await agent.get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    assert.equal(exp.status, 401);
    assert.equal(exp.body.code, 'TOKEN_EXPIRED');

    // A refresh token must never work as an access token.
    const { body: b2, headers } = await login('shopper@example.com', 'Shopper123');
    const rt = cookiePair(refreshCookie({ headers })).split('=')[1];
    assert.ok(b2.data.accessToken);
    assert.equal((await agent.get('/api/auth/me').set('Authorization', `Bearer ${rt}`)).status, 401);
  });

  it('rotates refresh tokens and detects reuse of a rotated token', async () => {
    const res = await login('shopper@example.com', 'Shopper123');
    const c1 = cookiePair(refreshCookie(res));

    assert.equal((await agent.post('/api/auth/refresh').set('Cookie', c1)).status, 403, 'CSRF header required');

    const r1 = await refresh(c1);
    assert.equal(r1.status, 200);
    assert.ok(r1.body.data.accessToken);
    const c2 = cookiePair(refreshCookie(r1));
    assert.notEqual(c1, c2);

    const reuse = await refresh(c1);
    assert.equal(reuse.status, 401);
    assert.equal(reuse.body.code, 'REFRESH_REVOKED');
    // Reuse revokes the whole token family, including the legitimately rotated token.
    assert.equal((await refresh(c2)).status, 401);
  });

  it('rejects invalid and expired refresh tokens', async () => {
    assert.equal((await refresh('sc_rt=garbage.token.value')).status, 401);
    assert.equal((await agent.post('/api/auth/refresh').set(csrf)).status, 401);
    const expired = jwt.sign({ sub: '64b000000000000000000000', typ: 'refresh', fam: 'x' }, process.env.JWT_REFRESH_SECRET, {
      algorithm: 'HS256',
      expiresIn: -5,
      issuer: 'sipcraft-api',
      audience: 'sipcraft-web',
    });
    const r = await refresh(`sc_rt=${expired}`);
    assert.equal(r.status, 401);
    assert.equal(r.body.code, 'REFRESH_EXPIRED');
  });

  it('allows exactly one of several simultaneous refreshes with the same token', async () => {
    const res = await login('shopper@example.com', 'Shopper123');
    const c = cookiePair(refreshCookie(res));
    const results = await Promise.all([refresh(c), refresh(c), refresh(c)]);
    assert.equal(results.filter((r) => r.status === 200).length, 1);
  });

  it('logout revokes the session and clears the cookie', async () => {
    const res = await login('shopper@example.com', 'Shopper123');
    const c = cookiePair(refreshCookie(res));
    const out = await agent.post('/api/auth/logout').set(csrf).set('Cookie', c);
    assert.equal(out.status, 200);
    assert.match(refreshCookie(out), /sc_rt=;/);
    assert.equal((await refresh(c)).status, 401);
  });

  it('logout-all revokes every session for the user', async () => {
    const a = await login('shopper@example.com', 'Shopper123');
    const b = await login('shopper@example.com', 'Shopper123');
    const ca = cookiePair(refreshCookie(a));
    const cb = cookiePair(refreshCookie(b));
    const out = await agent.post('/api/auth/logout-all').set(csrf).set('Authorization', `Bearer ${a.body.data.accessToken}`);
    assert.equal(out.status, 200);
    assert.equal((await refresh(ca)).status, 401);
    assert.equal((await refresh(cb)).status, 401);
  });

  it('enforces RBAC: customers get 403 on admin APIs, anonymous gets 401', async () => {
    const user = await login('shopper@example.com', 'Shopper123');
    assert.equal((await agent.get('/api/admin/dashboard').set('Authorization', `Bearer ${user.body.data.accessToken}`)).status, 403);
    assert.equal((await agent.post('/api/products').set('Authorization', `Bearer ${user.body.data.accessToken}`).set('Origin', ORIGIN).send({})).status, 403);
    assert.equal((await agent.get('/api/admin/dashboard')).status, 401);
    const admin = await login('admin@sipcraft.test', 'AdminPass123');
    assert.equal((await agent.get('/api/admin/dashboard').set('Authorization', `Bearer ${admin.body.data.accessToken}`)).status, 200);
  });

  it('disabling an account blocks login, access tokens and refresh; re-enabling restores access', async () => {
    const user = await login('shopper@example.com', 'Shopper123');
    const userCookie = cookiePair(refreshCookie(user));
    const admin = await login('admin@sipcraft.test', 'AdminPass123');
    const adminToken = admin.body.data.accessToken;

    const disable = await agent
      .patch(`/api/admin/customers/${user.body.data.user._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Origin', ORIGIN)
      .send({ isActive: false });
    assert.equal(disable.status, 200);

    assert.equal((await login('shopper@example.com', 'Shopper123')).status, 403);
    const me = await agent.get('/api/auth/me').set('Authorization', `Bearer ${user.body.data.accessToken}`);
    assert.equal(me.status, 401);
    assert.equal((await refresh(userCookie)).status, 401);

    await agent.patch(`/api/admin/customers/${user.body.data.user._id}`).set('Authorization', `Bearer ${adminToken}`).set('Origin', ORIGIN).send({ isActive: true });
    assert.equal((await login('shopper@example.com', 'Shopper123')).status, 200);
  });

  it('password reset: hashed single-use token, revokes sessions, expires', async () => {
    const { User } = require('../src/models');
    const { __outbox } = require('../src/services/emailService');
    const session = await login('shopper@example.com', 'Shopper123');
    const oldCookie = cookiePair(refreshCookie(session));

    const unknown = await agent.post('/api/auth/forgot-password').set('Origin', ORIGIN).send({ email: 'nobody@example.com' });
    const known = await agent.post('/api/auth/forgot-password').set('Origin', ORIGIN).send({ email: 'shopper@example.com' });
    assert.equal(unknown.status, 200);
    assert.equal(known.body.message, unknown.body.message, 'no account enumeration');

    await new Promise((r) => setTimeout(r, 50));
    const mail = [...__outbox].reverse().find((m) => m.templateName === 'passwordReset' && m.to === 'shopper@example.com');
    const token = new URL(mail.data.resetUrl).searchParams.get('token');
    const stored = await User.findOne({ email: 'shopper@example.com' }).select('+passwordResetTokenHash');
    assert.notEqual(stored.passwordResetTokenHash, token, 'only a hash is stored');

    const reset = await agent.post('/api/auth/reset-password').set('Origin', ORIGIN).send({ token, password: 'NewShopper456', confirmPassword: 'NewShopper456' });
    assert.equal(reset.status, 200);
    assert.equal((await refresh(oldCookie)).status, 401, 'existing sessions revoked');
    assert.equal((await login('shopper@example.com', 'Shopper123')).status, 401);
    assert.equal((await login('shopper@example.com', 'NewShopper456')).status, 200);

    const reuse = await agent.post('/api/auth/reset-password').set('Origin', ORIGIN).send({ token, password: 'Another789A', confirmPassword: 'Another789A' });
    assert.equal(reuse.status, 400, 'token is single-use');

    await agent.post('/api/auth/forgot-password').set('Origin', ORIGIN).send({ email: 'shopper@example.com' });
    await new Promise((r) => setTimeout(r, 50));
    const mail2 = [...__outbox].reverse().find((m) => m.templateName === 'passwordReset' && m.to === 'shopper@example.com');
    const token2 = new URL(mail2.data.resetUrl).searchParams.get('token');
    await User.updateOne({ email: 'shopper@example.com' }, { passwordResetExpires: new Date(Date.now() - 1000) });
    const expired = await agent.post('/api/auth/reset-password').set('Origin', ORIGIN).send({ token: token2, password: 'Another789A', confirmPassword: 'Another789A' });
    assert.equal(expired.status, 400, 'expired token rejected');
  });

  it('rejects state-changing requests from untrusted origins', async () => {
    const res = await agent.post('/api/auth/login').set('Origin', 'https://evil.example').send({ email: 'shopper@example.com', password: 'NewShopper456' });
    assert.equal(res.status, 403);
  });

  it('strips NoSQL operators from input', async () => {
    const res = await agent.post('/api/auth/login').set('Origin', ORIGIN).send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 400);
  });
});

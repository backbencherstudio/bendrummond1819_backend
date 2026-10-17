import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { VERIFY_EMAIL_RESET_OTP } from './email-reset-otp';

// Opt-in: uses unique keys on local Redis, without clearing existing data.
const describeRedis =
  process.env.LOCAL_REDIS_TEST === '1' ? describe : describe.skip;
describeRedis('Email reset OTP atomic Redis verification', () => {
  let redis: Redis;
  const keys: string[] = [];
  const challenge = async (ttl = 60000) => {
    const key = `test:email-reset:${randomUUID()}`;
    keys.push(key);
    await redis.set(
      key,
      JSON.stringify({ hash: 'correct-hash', userId: 'u1', attempts: 0 }),
      'PX',
      ttl,
    );
    return key;
  };
  beforeAll(async () => {
    redis = new Redis({
      host: '127.0.0.1',
      port: 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    await redis.connect();
  });
  afterAll(async () => {
    if (redis?.status === 'ready') {
      if (keys.length) await redis.del(...keys);
      await redis.quit();
    } else redis?.disconnect();
  });
  it('allows four wrong attempts and consumes the challenge on the fifth', async () => {
    const key = await challenge();
    for (let attempt = 1; attempt <= 4; attempt++) {
      expect(
        await redis.eval(VERIFY_EMAIL_RESET_OTP, 1, key, 'wrong'),
      ).toBeNull();
      expect(await redis.exists(key)).toBe(1);
    }
    expect(
      await redis.eval(VERIFY_EMAIL_RESET_OTP, 1, key, 'wrong'),
    ).toBeNull();
    expect(await redis.exists(key)).toBe(0);
    expect(
      await redis.eval(VERIFY_EMAIL_RESET_OTP, 1, key, 'correct-hash'),
    ).toBeNull();
  });
  it('does not extend expiry after a failed attempt', async () => {
    const key = await challenge();
    const before = await redis.pttl(key);
    await redis.eval(VERIFY_EMAIL_RESET_OTP, 1, key, 'wrong');
    expect(await redis.pttl(key)).toBeLessThanOrEqual(before);
  });
  it('allows only one of two concurrent valid submissions', async () => {
    const key = await challenge();
    const results = await Promise.all([
      redis.eval(VERIFY_EMAIL_RESET_OTP, 1, key, 'correct-hash'),
      redis.eval(VERIFY_EMAIL_RESET_OTP, 1, key, 'correct-hash'),
    ]);
    expect(results.filter((value) => value === 'u1')).toHaveLength(1);
    expect(results.filter((value) => value === null)).toHaveLength(1);
  });
  it('rejects an expired challenge', async () => {
    const key = await challenge();
    await redis.pexpireat(key, Date.now() - 1);
    expect(
      await redis.eval(VERIFY_EMAIL_RESET_OTP, 1, key, 'correct-hash'),
    ).toBeNull();
  });
});

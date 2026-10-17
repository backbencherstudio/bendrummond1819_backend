// Compare, limit attempts and consume the challenge atomically across requests.
export const VERIFY_EMAIL_RESET_OTP = `
local raw = redis.call('GET', KEYS[1])
if not raw then return nil end
local challenge = cjson.decode(raw)
if challenge.hash == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return challenge.userId
end
challenge.attempts = challenge.attempts + 1
local ttl = redis.call('PTTL', KEYS[1])
if challenge.attempts >= 5 or ttl <= 0 then
  redis.call('DEL', KEYS[1])
else
  redis.call('PSETEX', KEYS[1], ttl, cjson.encode(challenge))
end
return nil
`;

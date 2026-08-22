import {createClient} from "redis";
import {config} from "../load-balancer/config";

//creating a redis client
const redisCLient = createClient({
    url: cofig.redisUrl
});

//fallback for redis connection error
redisClient.on("error", (error) =>{
    console.error("Redis Client Error", error.message);
});

//connect to redis server
await redisClient.connect();

console.log("Connected to Redis Server");


//adding lua script for atomic token bucket operation
const tokenBucketScript = `
local key = KEYS[1]

local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local data = redis.call("HMGET", key, "tokens", "lastRefill")

local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

if tokens == nil then
    tokens = capacity
    lastRefill = now
end

local elapsed = now - lastRefill

local newTokens =
    math.min(
        capacity,
        tokens + (elapsed * refillRate)
    )

local allowed = 0

if newTokens >= 1 then

    newTokens = newTokens - 1

    allowed = 1

end

redis.call(
    "HMSET",
    key,
    "tokens",
    newTokens,
    "lastRefill",
    now
)

redis.call(
    "EXPIRE",
    key,
    60
)

return {
    allowed,
    newTokens
}
`;

//Rate limiter function
export async function allowRequest(clientKey){
    const now = Date.now() / 1000;

    const key = `rate_limiter:${clientKey}`;

    const result = await redisCLient.eval(
        tokenBucketScript,
        {
            keys: [Key],
            arguments: [
                String(config.rateLimitCapacity),
                String(config.rateLimitRefillRate),
                String(now)
            ]
        }
    );

    return{
        allowed: Number(result[0]) === 1,
        remainingTokens: Number(result[1])
    };
}


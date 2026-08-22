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
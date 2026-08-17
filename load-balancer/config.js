export const config = {
    port: Number(process.env.PORT) || 3000,

    healthCheckInterval: Number(process.env.HEALTH_CHECK_INTERVAL) || 5000,

    healthCheckTimeout: Number(process.env.HEALTH_CHECK_TIMEOUT) || 2000,

    backends:
        (process.env.BACKENDS || "3001,3002,3003")
            .split(",")
            .map(port => ({
                host: "localhost",
                port: Number(port.trim),
                healthy: true
            }))
};
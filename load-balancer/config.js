export const config = {

    port:
        Number(process.env.PORT) || 3000,

    healthCheckInterval:
        Number(process.env.HEALTH_CHECK_INTERVAL) || 5000,

    healthCheckTimeout:
        Number(process.env.HEALTH_CHECK_TIMEOUT) || 2000,

    backendRequestTimeout:
        Number(process.env.BACKEND_REQUEST_TIMEOUT) || 3000, 
        
    circuitFailureThreshold:
        Number(process.env.CIRCUIT_FAILURE_THRESHOLD) || 3,
        
    circuitResetTimeout:
        Number(process.env.CIRCUIT_RESET_TIMEOUT) || 10000,    

    backends: (() => {

        const ports =
            (process.env.BACKENDS || "3001,3002,3003")
                .split(",")
                .map(port => Number(port.trim()));

        const weights =
            (process.env.BACKEND_WEIGHTS || "1,1,1")
                .split(",")
                .map(weight => Number(weight.trim()));

        return ports.map((port, index) => ({
            host: "localhost",
            port: port,
            healthy: true,
            weight: weights[index] || 1,
            currentWeight: 0,
            latency: Infinity,
            failureCount: 0,
            circuitState: "CLOSED",
            circuitOpenedAt: null
        }));

    })()

};
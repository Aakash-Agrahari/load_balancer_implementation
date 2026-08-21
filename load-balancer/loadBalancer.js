import http from "http";
import { config } from "./config.js";

const backendAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 100
});

const PORT = config.port;

const servers = config.backends;

let currentServerIndex = 0;

// Maximum number of retry attempts after the first backend fails
const MAX_RETRIES = 1;

// Metrics
const metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,

    byServer: {}
};

// Initialize metrics for every backend
servers.forEach(server => {

    metrics.byServer[server.port] = {
        requests: 0,
        successful: 0,
        failed: 0
    };

});

// Health Check
function checkServerHealth(server) {

    const options = {
        hostname: server.host,
        port: server.port,
        path: "/health",
        method: "GET",
        timeout: config.healthCheckTimeout
    };

    const healthRequest = http.request(
        options,
        (response) => {

            if (response.statusCode === 200) {

                if (!server.healthy) {

                    console.log(
                        `Server ${server.port} is healthy again`
                    );

                    // Reset scheduling state when server recovers
                    server.currentWeight = 0;
                }

                server.healthy = true;

            } else {

                if (server.healthy) {

                    console.log(
                        `Server ${server.port} is unhealthy`
                    );
                }

                server.healthy = false;
            }

            response.resume();
        }
    );


    // Backend connection failed
    healthRequest.on("error", () => {

        if (server.healthy) {

            console.log(
                `Server ${server.port} is DOWN`
            );
        }

        server.healthy = false;
    });


    // Backend did not respond in time
    healthRequest.on("timeout", () => {

        healthRequest.destroy();

        if (server.healthy) {

            console.log(
                `Server ${server.port} timed out`
            );
        }

        server.healthy = false;
    });


    healthRequest.end();
}

// Run health checks periodically
const healthCheckTimer = setInterval(() => {

    servers.forEach(server => {

        checkServerHealth(server);

    });

}, config.healthCheckInterval);

// Check circuit breaker state
function isCircuitAvailable(server) {

    // Circuit is closed
    if (server.circuitState === "CLOSED") {

        return true;
    }


    // Circuit is open
    if (server.circuitState === "OPEN") {

        const elapsedTime =
            Date.now() -
            server.circuitOpenedAt;


        // Reset timeout has passed
        if (
            elapsedTime >=
            config.circuitResetTimeout
        ) {

            server.circuitState =
                "HALF-OPEN";

            console.log(
                `Server ${server.port} circuit is HALF-OPEN`
            );

            return true;
        }


        // Circuit is still open
        return false;
    }


    // HALF-OPEN
    return true;
}


// Find next healthy server
function getNextHealthyServer() {

    for (let i = 0; i < servers.length; i++) {

        const server =
            servers[currentServerIndex];

        currentServerIndex =
            (currentServerIndex + 1)
            % servers.length;


        if (server.healthy) {

            return server;
        }
    }

    return null;
}


// Find a healthy server excluding servers that already failed
function getHealthyServerExcluding(excludedServers) {

    const healthyServers =
        servers.filter(
            server =>
                server.healthy &&
                !excludedServers.includes(server)
        );

    if (healthyServers.length === 0) {

        return null;
    }

    return getSmoothWeightedRoundRobinServer(
        healthyServers
    );
}


// Smooth Weighted Round Robin
function getSmoothWeightedRoundRobinServer(
    availableServers = servers
) {

    const healthyServers =
        availableServers.filter(
            server => server.healthy
        );

    if (healthyServers.length === 0) {

        return null;
    }

    const totalWeight =
        healthyServers.reduce(
            (total, server) =>
                total + server.weight,
            0
        );

    let selectedServer = null;

    for (const server of healthyServers) {

        server.currentWeight +=
            server.weight;

        if (
            selectedServer === null ||
            server.currentWeight >
                selectedServer.currentWeight
        ) {

            selectedServer = server;
        }
    }

    selectedServer.currentWeight -=
        totalWeight;

    return selectedServer;
}


// Forward request to backend
function forwardRequest(
    req,
    res,
    targetServer,
    startTime
) {

    return new Promise((resolve, reject) => {

        // Proxy request configuration
        const options = {

            hostname: targetServer.host,

            port: targetServer.port,

            path: req.url,

            method: req.method,

            headers: req.headers,

            agent: backendAgent
        };


        // Send request to backend
        const proxyRequest = http.request(
            options,
            (proxyResponse) => {

                const responseTime =
                    Date.now() - startTime;

                // Store latest response time
                targetServer.latency =
                    responseTime;


                // Successful backend response
                metrics.successfulRequests++;

                metrics.byServer[
                    targetServer.port
                ].requests++;

                metrics.byServer[
                    targetServer.port
                ].successful++;


                // Request log
                console.log(
                    `[REQUEST] ${req.method} ${req.url} → ` +
                    `${targetServer.port} → ` +
                    `${proxyResponse.statusCode} → ` +
                    `${responseTime}ms`
                );


                // Forward response
                res.writeHead(
                    proxyResponse.statusCode,
                    proxyResponse.headers
                );

                proxyResponse.pipe(res);

                resolve();
            }
        );

        //Backend response timeout
        proxyRequest.setTimeout(
            config.backendRequestTimeout,
            () => {

                console.error(
                    `Backend ${targetServer.port} timed out`
                );

                targetServer.healthy = false;

                proxyRequest.destroy(
                    new Error("Backend request timeout")
                );
            }
        );


        // Backend request error
        proxyRequest.on("error", (error) => {

            const responseTime =
                Date.now() - startTime;

            metrics.byServer[
                targetServer.port
            ].requests++;

            metrics.byServer[
                targetServer.port
            ].failed++;


            // Log error
            console.error(
                `[ERROR] ${req.method} ${req.url} → ` +
                `${targetServer.port} → ` +
                `${responseTime}ms → ` +
                `${error.message}`
            );


            // Mark backend unhealthy
            targetServer.healthy = false;

            targetServer.failureCount++; // increase circuit breaker failure count

            // Open circuit if failure threshold is reached
            if(targetServer.failureCount >= config.circuitFailureThreshold){
                targetServer.circuitState = "OPEN";
                targetServer.circuitState = Date.now();
                console.log(`Circuit OPEN for server ${targetServer.port}`);
            }

            metrics.failedRequests++;

            reject(error);
        });


        req.pipe(proxyRequest);
    });
}


// Load Balancer
const server = http.createServer(
    async (req, res) => {

        const startTime = Date.now();


        // Metrics endpoint
        if (req.url === "/metrics") {

            res.writeHead(200, {
                "Content-Type": "application/json"
            });

            res.end(
                JSON.stringify(
                    metrics,
                    null,
                    2
                )
            );

            return;
        }


        // Count normal application requests
        metrics.totalRequests++;


        // Find healthy backend
        let targetServer =
            getSmoothWeightedRoundRobinServer();


        // No healthy backend
        if (!targetServer) {

            console.log(
                "No healthy backend servers available"
            );

            metrics.failedRequests++;


            res.writeHead(503, {
                "Content-Type": "application/json"
            });


            res.end(
                JSON.stringify({
                    error: "Service Unavailable",
                    message:
                        "No healthy backend servers are available"
                })
            );

            return;
        }


        // Keep track of servers already attempted
        const attemptedServers = [];

        let attempts = 0;


        // Try the selected backend and retry once if it fails
        while (
            targetServer &&
            attempts <= MAX_RETRIES
        ) {

            attemptedServers.push(
                targetServer
            );


            // Log forwarding
            console.log(
                `Attempt ${attempts + 1} → ` +
                `localhost:${targetServer.port}`
            );


            try {

                await forwardRequest(
                    req,
                    res,
                    targetServer,
                    startTime
                );

                // Request succeeded
                return;

            } catch (error) {

                console.error(
                    `Backend ${targetServer.port} failed`
                );


                attempts++;


                // No more retries available
                if (
                    attempts > MAX_RETRIES
                ) {

                    break;
                }


                // Find another healthy backend
                targetServer =
                    getHealthyServerExcluding(
                        attemptedServers
                    );
            }
        }


        // All backend attempts failed
        res.writeHead(502, {
            "Content-Type": "application/json"
        });

        res.end(
            JSON.stringify({
                error: "Bad Gateway",
                message:
                    "All available backend servers failed"
            })
        );
    }
);


// Start load balancer
server.listen(PORT, () => {

    console.log(
        `Load balancer is running on port ${PORT}`
    );


    // Run initial health checks immediately

    servers.forEach(server => {

        checkServerHealth(server);

    });
});


// Graceful shutdown
function shutdown(signal) {

    console.log(
        `\n${signal} received. Starting graceful shutdown...`
    );

    // Stop health checks
    clearInterval(healthCheckTimer);

    // Stop accepting new requests
    server.close(() => {

        console.log(
            "Load balancer stopped successfully"
        );

        process.exit(0);
    });
}


// Handle Ctrl + C
process.on("SIGINT", () => {

    shutdown("SIGINT");

});


// Handle termination signal
process.on("SIGTERM", () => {

    shutdown("SIGTERM");

});
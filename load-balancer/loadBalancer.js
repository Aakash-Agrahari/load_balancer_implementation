import http from "http";
import { config } from "./config.js";

const PORT = config.port;

const servers = config.backends;

let currentServerIndex = 0;

let weightedRoundRobinIndex = 0;

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
        failed: 0,
        totalResponseTime: 0,
        averageResponseTime: 0
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
setInterval(() => {

    servers.forEach(server => {

        checkServerHealth(server);

    });

}, config.healthCheckInterval);

// Find next healthy server based on Round Robin
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

//find the fastest healthy server based on latency
function getFastestHealthyServer(){
    const healthyServers = servers.filter(server => server.healthy);

    const serversWithMetrics =
        healthyServers.filter(server =>
            metrics.byServer[server.port]
                .successful > 0
        );

    // If no server has latency data yet,
    // fall back to Round Robin.
    if (serversWithMetrics.length === 0) {
        return getNextHealthyServer();
    }

    return serversWithMetrics.reduce(
        (fastest, current) => {

            const fastestLatency =
                metrics.byServer[fastest.port]
                    .averageResponseTime;

            const currentLatency =
                metrics.byServer[current.port]
                    .averageResponseTime;

            return currentLatency < fastestLatency
                ? current
                : fastest;
        }
    );
}

//find a healthy server based on weights
function getWeightedServer() {

    const healthyServers =
        servers.filter(server => server.healthy);

    if (healthyServers.length === 0) {
        return null;
    }

    const totalWeight =
        healthyServers.reduce(
            (total, server) => total + server.weight,
            0
        );

    let random =
        Math.random() * totalWeight;

    for (const server of healthyServers) {

        random -= server.weight;

        if (random < 0) {
            return server;
        }
    }

    return healthyServers[
        healthyServers.length - 1
    ];
}



// Load Balancer
const server = http.createServer((req, res) => {

    const startTime = Date.now();

    // Metrics endpoint
    if (req.url === "/metrics") {

        res.writeHead(200, {
            "Content-Type": "application/json"
        });

        res.end(
            JSON.stringify(metrics, null, 2)
        );

        return;
    }


    // Count normal application requests
    metrics.totalRequests++;

    // shows the fastest server in the console
    /*console.log(
        "Fastest server:",
        getFastestHealthyServer()?.port
    );*/

    // Find healthy backend
    /*const targetServer =
        getNextHealthyServer();*/

    //Find fastest server
    //const targetServer = getFastestHealthyServer();   
    
    const targetServer = getWeightedServer();

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

    // Log forwarding
    console.log(
        `Forwarding ${req.method} ${req.url} → ` +
        `localhost:${targetServer.port}`
    );

    // Proxy request configuration
    const options = {

        hostname: targetServer.host,

        port: targetServer.port,

        path: req.url,

        method: req.method,

        headers: req.headers
    };


    // Send request to backend
    const proxyRequest = http.request(
        options,
        (proxyResponse) => {

            const responseTime =
                Date.now() - startTime;

            metrics.successfulRequests++;

            metrics.byServer[
                targetServer.port
            ].requests++;

            metrics.byServer[
                targetServer.port
            ].successful++;

            metrics.byServer[
                targetServer.port
            ].totalResponseTime += responseTime;

            metrics.byServer[
                targetServer.port
            ].averageResponseTime = 
                metrics.byServer[
                    targetServer.port
                ].totalResponseTime /
                metrics.byServer[
                    targetServer.port
                ].successful;


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
        }
    );

    // Backend request error
    proxyRequest.on("error", (error) => {

        const responseTime =
            Date.now() - startTime;

        metrics.failedRequests++;

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
            `502 → ${responseTime}ms → ` +
            `${error.message}`
        );

        targetServer.healthy = false; // Mark backend unhealthy

        res.writeHead(502, {
            "Content-Type": "application/json"
        });

        res.end(
            JSON.stringify({
                error: "Bad Gateway",
                message:
                    "Backend server failed"
            })
        );
    });
    
    req.pipe(proxyRequest); // Forward client request body
});


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
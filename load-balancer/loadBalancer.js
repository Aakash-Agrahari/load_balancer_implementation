import http from "http";
import {config} from "./config.js";

const PORT = config.port;
const servers = config.backends;

let currentServerIndex = 0;


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

                server.healthy = false;

                console.log(
                    `Server ${server.port} is unhealthy`
                );
            }

            response.resume();
        }
    );

    healthRequest.on("error", () => {

        if (server.healthy) {
            console.log(
                `Server ${server.port} is DOWN`
            );
        }

        server.healthy = false;
    });

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



// Load Balancer
const server = http.createServer((req, res) => {

    const targetServer =
        getNextHealthyServer();

    if (!targetServer) {

        console.log(
            "No healthy backend servers available"
        );

        res.writeHead(503, {
            "Content-Type": "application/json"
        });

        res.end(
            JSON.stringify({
            error: "Service Unavailable",
            message: "No healthy backend servers are available"
        })
        );

        return;
    }

    console.log(
        `Forwarding ${req.method} ${req.url} → localhost:${targetServer.port}`
    );

    const options = {
        hostname: targetServer.host,
        port: targetServer.port,
        path: req.url,
        method: req.method,
        headers: req.headers
    };

    const proxyRequest = http.request(
        options,
        (proxyResponse) => {

            res.writeHead(
                proxyResponse.statusCode,
                proxyResponse.headers
            );

            proxyResponse.pipe(res);
        }
    );

    proxyRequest.on("error", (error) => {

        console.error(
            `Proxy error for server ${targetServer.port}:`,
            error.message
        );

        targetServer.healthy = false;

        res.writeHead(502, {
            "Content-Type": "text/plain"
        });

        res.end("Bad Gateway");
    });

    req.pipe(proxyRequest);
});


server.listen(PORT, () => {

    console.log(
        `Load balancer is running on port ${PORT}`
    );

    // Run an initial health check immediately
    servers.forEach(server => {
        checkServerHealth(server);
    });
});
import http from "http";

const PORT = 3000;

const servers = [
    {
        host: "localhost",
        port: 3001
    },
    {
        host: "localhost",
        port: 3002
    },
    {
        host: "localhost",
        port: 3003
    }
];

let currentServerIndex = 0;

const server = http.createServer((req, res) => {

    const targetServer = servers[currentServerIndex];

    currentServerIndex =
        (currentServerIndex + 1) % servers.length;

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
            `Server ${targetServer.port} error:`,
            error.message
        );

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
});
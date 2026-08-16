import http from "http";

const PORT = 3000;

 const TARGET_HOST = "localhost";
 const TARGET_PORT = 3001;

 const server = http.createServer((req, res) => {

    const options = {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers
    };

    const proxyRequest = http.request(options, (proxyResponse) => {
        res.writeHead(
            proxyResponse.statusCode,
            proxyResponse.headers
        );
        proxyResponse.pipe(res);
    });

    proxyRequest.on("error", (error) => {
        console.error("Proxy error:", error.message);

        res.writeHead(502, {
            "Content-Type": "text/plain"
        });
        res.end("Bad Gateway");
    });
    req.pipe(proxyRequest);
 });

 server.listen(PORT, () => {
    console.log(`Load balancer is running on port ${PORT}`);
 })
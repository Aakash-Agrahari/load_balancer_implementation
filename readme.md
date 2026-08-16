# Load Balancer From Scratch

A practical implementation of a load balancer using Node.js and JavaScript.

The goal of this project is to understand how load balancing works internally by building the core concepts ourselves before looking at tools such as Nginx and AWS Elastic Load Balancing.

---

## What is this project?

A load balancer sits between clients and multiple application servers.

Instead of sending every request directly to one server:

```text
Client
  |
  v
Server
```

we put a load balancer in between:

```text
                  Client
                    |
                    v
              Load Balancer
              /     |     \
             v      v      v
          Server 1 Server 2 Server 3
```

The load balancer decides which backend server should handle each request.

This becomes important when an application needs to handle more traffic than a single server can comfortably handle.

---

## Project Goal

Rather than immediately using an existing load-balancing service, I am building a simplified version from scratch.

The idea is to understand:

- How requests are forwarded
- How backend servers are selected
- Round Robin
- Random routing
- Least Connections
- Health checks
- Failure handling
- Horizontal scaling
- Reverse proxies
- How real load balancers differ from this implementation

---

## Planned Architecture

The initial version will run several Node.js servers locally:

```text
                         Postman
                            |
                            v
                    +---------------+
                    | Load Balancer |
                    |     :3000     |
                    +-------+-------+
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
        +-----------+ +-----------+ +-----------+
        | Server 1  | | Server 2  | | Server 3  |
        |   :3001   | |   :3002   | |   :3003   |
        +-----------+ +-----------+ +-----------+
```

The client only communicates with the load balancer.

The backend servers are responsible for processing the actual requests.

---

## Stage 1 - Multiple Backend Servers

The first step is to run multiple Node.js servers simultaneously.

For example:

```text
Server 1 -> localhost:3001
Server 2 -> localhost:3002
Server 3 -> localhost:3003
```

Each server will return its own identity so that the routing behavior can be observed easily.

Example:

```text
Hello from Server 1
Hello from Server 2
Hello from Server 3
```

---

## Stage 2 - Build the Load Balancer

The load balancer will run on:

```text
localhost:3000
```

A request such as:

```http
GET http://localhost:3000/
```

will be received by the load balancer.

The load balancer will then forward the request to one of the backend servers.

---

## Stage 3 - Round Robin

The first routing strategy will be Round Robin.

For example:

```text
Request 1 -> Server 1
Request 2 -> Server 2
Request 3 -> Server 3
Request 4 -> Server 1
Request 5 -> Server 2
Request 6 -> Server 3
```

The servers are selected sequentially.

Round Robin is simple and works well when the backend servers have similar capacity and requests have relatively similar processing costs.

---

## Stage 4 - Other Routing Strategies

After Round Robin, the project will explore other approaches.

### Random

A backend server is selected randomly.

```text
Request -> Random Server
```

### Least Connections

The load balancer keeps track of active connections.

For example:

```text
Server 1 -> 5 connections
Server 2 -> 2 connections
Server 3 -> 7 connections
```

The next request would be sent to Server 2.

---

## Stage 5 - Health Checks

A real load balancer should not blindly send traffic to servers that are unavailable.

The project will add health checking.

Example:

```text
Server 1 -> Healthy
Server 2 -> Healthy
Server 3 -> Unhealthy
```

The load balancer should stop sending new requests to Server 3.

---

## Stage 6 - Failure Simulation

One of the practical tests will be intentionally stopping a backend server.

For example:

```text
Before:

Load Balancer
    |
    +--> Server 1 ✓
    +--> Server 2 ✓
    +--> Server 3 ✓
```

After Server 2 crashes:

```text
Load Balancer
    |
    +--> Server 1 ✓
    +--> Server 2 ✗
    +--> Server 3 ✓
```

The goal is for the load balancer to detect the failure and continue routing requests to healthy servers.

---

## Why build this ourselves?

Tools such as Nginx and cloud load balancers already solve these problems.

However, using those tools immediately can hide what is actually happening.

Building a small version ourselves makes the underlying concepts easier to understand.

Once the basic implementation is complete, the project will compare it with real-world solutions.

---

## Nginx

A later stage of the project will use Nginx as a reverse proxy/load balancer.

Conceptually:

```text
Client
  |
  v
Nginx
  |
  +----> Node.js Server 1
  |
  +----> Node.js Server 2
  |
  +----> Node.js Server 3
```

This will help compare a custom JavaScript implementation with a commonly used production tool.

---

## AWS

AWS will be covered after understanding the underlying implementation.

The relevant AWS service for HTTP/HTTPS applications is the Application Load Balancer (ALB), which is part of Elastic Load Balancing.

The architecture will look roughly like:

```text
                   Internet
                       |
                       v
                AWS Application
                Load Balancer
                       |
             +---------+---------+
             |         |         |
             v         v         v
           EC2       EC2       EC2
         Instance  Instance  Instance
```

The AWS implementation will be treated as a separate stage rather than hiding the load-balancing concepts behind a managed service from the beginning.

---

## Tech Stack

Initial implementation:

- JavaScript
- Node.js
- Express.js

Later stages may include:

- Nginx
- AWS Application Load Balancer
- EC2

---

## Current Status

### Completed

- [ ] Project setup
- [ ] First backend server

### In Progress

- [ ] Multiple backend servers
- [ ] Custom load balancer
- [ ] Round Robin

### Planned

- [ ] Random routing
- [ ] Least Connections
- [ ] Health checks
- [ ] Failure detection
- [ ] Nginx implementation
- [ ] AWS implementation
- [ ] Production architecture discussion

---

## What I want to learn from this project

The main goal isn't to build a production replacement for Nginx or AWS.

The goal is to understand the ideas behind load balancing:

```text
Incoming traffic
       |
       v
Load balancing decision
       |
       v
Healthy backend
       |
       v
Request processing
```

Once these fundamentals are clear, tools such as Nginx, AWS ALB and Kubernetes become much easier to understand.

---

## Future Improvements

Some possible improvements after the basic implementation:

- Configurable backend servers
- Dynamic server registration
- Better health checks
- Connection tracking
- Retry mechanisms
- Request timeouts
- Logging
- Metrics
- Graceful handling of backend failures
- Distributed load balancing

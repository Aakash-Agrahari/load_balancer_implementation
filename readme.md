# Load Balancer from scratch

A practical load balancer built from scratch using Node.js and JavaScript.

The purpose of this project is to understand how load balancing works internally by building the core concepts ourselves instead of directly relying on Nginx, AWS Elastic Load Balancer, or another managed service.

The project is being developed step by step, starting with multiple backend instances and then adding request forwarding, load distribution, health checks, and failure handling.

---

## Why I Built This

When an application receives a large number of requests, running everything on a single server can become a bottleneck.

One common solution is to run multiple instances of the same application and distribute incoming requests between them.

The basic architecture looks like this:

                    Client
                       |
                       v
                +--------------+
                | Load Balancer|
                +------+-------+
                       |
             +---------+---------+
             |         |         |
             v         v         v
          Server 1  Server 2  Server 3
           :3001     :3002     :3003

The main goal of this project is to understand what happens behind this architecture by implementing the important parts ourselves.

---

## Current Architecture

The project uses one reusable backend application instead of creating separate files such as `server1.js`, `server2.js`, and `server3.js`.

The same `server.js` is started multiple times on different ports.

```text
load-balancer/
│
├── backend/
│   └── server.js
│
├── load-balancer/
│   └── loadBalancer.js
│
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

The same backend application runs as multiple instances:

```text
                    backend/server.js
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
          Instance 1    Instance 2    Instance 3
           :3001         :3002         :3003
```

This approach is closer to how horizontally scaled applications are normally structured.

---

## Technology Stack

- Node.js
- JavaScript
- ES Modules
- Express.js
- HTTP
- npm

No AWS load-balancing service or other managed cloud service is being used at this stage.

Everything is running locally so that the underlying concepts can be understood first.

---

## ES Modules

This project uses modern JavaScript ES Modules instead of CommonJS.

For example:

```javascript
import express from "express";
```

instead of:

```javascript
const express = require("express");
```

The `package.json` contains:

```json
"type": "module"
```

This allows the project to use `import` and `export` syntax.

---

# Backend Server

The backend application is located at:

```text
backend/server.js
```

The server reads its port from an environment variable:

```javascript
const PORT = process.env.PORT || 3001;
```

Because the port is configurable, the same application can be started multiple times.

For example:

```text
Instance 1 → PORT=3001
Instance 2 → PORT=3002
Instance 3 → PORT=3003
```

There is no need to duplicate the backend code.

---

## Running the Backend Instances

### Server 1

Open a terminal and run:

```powershell
$env:PORT=3001
node backend/server.js
```

### Server 2

Open another terminal:

```powershell
$env:PORT=3002
node backend/server.js
```

### Server 3

Open another terminal:

```powershell
$env:PORT=3003
node backend/server.js
```

The terminals should show:

```text
Server 3001 is running
Server 3002 is running
Server 3003 is running
```

---

## Testing the Backend Instances

At the current stage, each backend can be accessed independently.

### Server 1

```text
GET http://localhost:3001/
```

Response:

```text
Hello from Server 3001
```

### Server 2

```text
GET http://localhost:3002/
```

Response:

```text
Hello from Server 3002
```

### Server 3

```text
GET http://localhost:3003/
```

Response:

```text
Hello from Server 3003
```

At this point there is no load balancing yet.

The client still has to manually choose which backend server to call.

---

# Load Balancer

The load balancer will be implemented separately:

```text
load-balancer/loadBalancer.js
```

It will listen on:

```text
localhost:3000
```

The expected architecture is:

```text
                         Client
                            |
                            | :3000
                            v
                   +-------------------+
                   |   Load Balancer   |
                   +---------+---------+
                             |
               +-------------+-------------+
               |             |             |
               v             v             v
            :3001         :3002         :3003
           Server 1      Server 2      Server 3
```

The client will only need to communicate with the load balancer.

For example:

```text
GET http://localhost:3000/
```

The load balancer will decide which backend instance should handle the request.

---

# Planned Load Balancing Flow

The load balancer will receive a request:

```text
Client
   |
   | GET /
   v
Load Balancer
```

It will select one backend server:

```text
Load Balancer
      |
      v
Server 1
```

The backend response will then travel back through the load balancer:

```text
Server 1
   |
   | Response
   v
Load Balancer
   |
   v
Client
```

The client should not need to know which backend server actually handled the request.

---

# Round Robin

The first load-balancing algorithm we will implement is **Round Robin**.

The basic idea is simple.

Requests are distributed sequentially across the available servers.

For example:

```text
Request 1 → Server 1
Request 2 → Server 2
Request 3 → Server 3
Request 4 → Server 1
Request 5 → Server 2
Request 6 → Server 3
```

This allows requests to be distributed across the backend instances without manually selecting a server for every request.

---

# Request Forwarding

The load balancer will need to forward incoming HTTP requests to the selected backend server.

For example:

```text
Client
   |
   | GET /users
   v
Load Balancer :3000
   |
   | Forward request
   v
Backend :3001
   |
   | Response
   v
Load Balancer
   |
   v
Client
```

This introduces the concept of a reverse proxy.

The load balancer acts as an intermediary between the client and backend servers.

---

# Health Checks

A server may be running normally one moment and become unavailable later.

For example:

```text
Server 1 → Healthy
Server 2 → Healthy
Server 3 → Unhealthy
```

The load balancer should eventually be able to detect unavailable servers and avoid sending requests to them.

This will be implemented after the basic load-balancing functionality is working.

---

# Handling Server Failures

We will intentionally stop one of the backend instances and test what happens.

For example:

```text
Server 1 → Running
Server 2 → Stopped
Server 3 → Running
```

The goal is to make the load balancer understand that Server 2 is unavailable and continue sending requests to the healthy servers.

---

# Concurrent Requests

The project will also be tested with multiple requests arriving at approximately the same time.

This will help demonstrate why load balancing becomes important when many clients are accessing an application simultaneously.

---

# What This Project Is Teaching

The main purpose of this project is to understand the concepts behind scalable backend systems.

Topics covered include:

- Horizontal scaling
- Multiple application instances
- Load balancing
- Round Robin
- HTTP request forwarding
- Reverse proxy concepts
- Health checks
- Server failure handling
- Concurrent requests
- Stateless backend architecture
- Basic scalability concepts

---

# Local Architecture

Everything is currently running on the local machine.

Before implementing the load balancer:

```text
                        Windows Machine
                              |
              +---------------+---------------+
              |               |               |
              v               v               v
          Node.js         Node.js         Node.js
          :3001           :3002           :3003
        Backend #1       Backend #2       Backend #3
```

After implementing the load balancer:

```text
                         Client
                            |
                            v
                     localhost:3000
                            |
                            v
                   Node.js Load Balancer
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
           :3001         :3002         :3003
          Backend       Backend       Backend
          Instance      Instance      Instance
             1             2             3
```

---

# AWS and Cloud Services

AWS is not being used in the initial implementation.

The project is intentionally being built locally first.

The reason is simple: I want to understand what a load balancer actually does before using a managed service that handles these responsibilities automatically.

After understanding the custom implementation, the same concepts can be compared with production technologies such as:

- Nginx
- AWS Application Load Balancer
- AWS Network Load Balancer
- Docker
- Kubernetes
- Cloud-based auto scaling

The objective is to understand the underlying concepts rather than simply using a managed service without knowing what happens behind the scenes.

---

# Project Status

## Completed

- Node.js project setup
- Express setup
- ES Module configuration
- Reusable backend server
- Multiple backend instances
- Running the same server on different ports
- Testing backend instances independently

## In Progress

- Custom Node.js load balancer
- HTTP request forwarding
- Round Robin request distribution

## Planned

- Round Robin implementation
- Request forwarding
- Health checks
- Failed server detection
- Concurrent request testing
- Failure handling
- Reverse proxy concepts
- Comparison with Nginx
- Understanding AWS load balancing

---

# Learning Goal

By the end of this project, I want to understand not only how to use a load balancer, but also what happens internally when a request travels through a load-balanced system.

The final architecture should look like:

```text
Client
  |
  v
Load Balancer
  |
  +------> Backend Instance 1
  |
  +------> Backend Instance 2
  |
  +------> Backend Instance 3
```

The main questions this project aims to answer are:

1. Why do we need multiple backend instances?
2. How does a load balancer select a server?
3. How does Round Robin work?
4. How does a load balancer forward an HTTP request?
5. What happens when a backend server goes down?
6. How can a load balancer detect unhealthy servers?
7. How does load balancing improve availability and scalability?
8. How does our implementation compare with production solutions such as Nginx and AWS load balancers?

---

## Final Goal

The final goal is to be able to look at a system such as:

```text
                         Client
                            |
                            v
                    +---------------+
                    | Load Balancer |
                    +-------+-------+
                            |
                +-----------+-----------+
                |           |           |
                v           v           v
             Server 1    Server 2    Server 3
```

and understand what is happening at each step instead of treating the load balancer as a black box.

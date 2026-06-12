# Clyra DevOps Architecture & Deployment Guide

This document provides a comprehensive guide to the cloud-native architecture, containerization, CI/CD pipeline, and automated deployment flow for **Clyra**.

---

## 1. System Architecture Diagram

Below is the workflow showing how code moves from local development to production on AWS EC2 via GitHub Actions and Docker Hub.

```mermaid
graph TD
    %% Styling
    classDef dev fill:#ececff,stroke:#9370db,stroke-width:2px;
    classDef github fill:#f5f5f5,stroke:#333,stroke-width:2px;
    classDef runner fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef registry fill:#ffe0b2,stroke:#f57c00,stroke-width:2px;
    classDef aws fill:#e8f5e9,stroke:#388e3c,stroke-width:2px;
    classDef client fill:#fce4ec,stroke:#c2185b,stroke-width:2px;

    %% Nodes
    Dev[Developer Workstation]:::dev
    GitHubRepo[GitHub Repository<br><b>clyra/clyra</b>]:::github
    
    subgraph GHA [GitHub Actions Runner]
        FE_Job[Frontend Build & Push]:::runner
        BE_Job[Backend Test, Build & Push]:::runner
    end

    DockerHub[(Docker Hub Registry)]:::registry

    subgraph AWS [AWS EC2 Instance]
        DockerEngine[Docker Engine]:::aws
        subgraph Containers [Running Containers]
            FE_Cont[Frontend Container<br><b>clyra-frontend</b><br>Port 80 (Nginx)]:::aws
            BE_Cont[Backend Container<br><b>clyra-backend</b><br>Port 3001 (Node.js)]:::aws
        end
    end

    ClientBrowser[Client Browser]:::client

    %% Relationships
    Dev -->|1. Push to main| GitHubRepo
    GitHubRepo -->|2. Triggers Workflow| GHA
    
    FE_Job -->|3a. Build & Push Image| DockerHub
    BE_Job -->|3b. Build & Push Image| DockerHub
    
    FE_Job -->|4a. SSH: pull & restart| DockerEngine
    BE_Job -->|4b. SSH: pull & restart| DockerEngine

    DockerEngine -->|5. Pull Images| DockerHub
    DockerEngine -->|6. Orchestrate| Containers

    ClientBrowser -->|HTTP requests (Port 80)| FE_Cont
    ClientBrowser -->|Socket.IO & WebRTC Signaling (Port 3001)| BE_Cont
```

---

## 2. Containerization (Docker)

Clyra utilizes Docker to containerize both the React frontend and Node.js backend. This ensures consistent environments across development, testing, and production.

### A. Frontend Containerization (`/Dockerfile`)
The frontend is built using a **multi-stage Dockerfile** to minimize image size and maximize performance.

1. **Build Stage (`node:22-alpine`):**
   * Installs frontend dependencies via `npm ci`.
   * Accepts build-time arguments (`ARG VITE_*`) representing backend signaling and Firebase configurations.
   * Maps these to environment variables (`ENV VITE_*`), which are compiled and injected into the static build by Vite.
   * Builds the static files using `npm run build`.
2. **Production Stage (`nginx:alpine`):**
   * Uses Nginx to serve the compiled static files from `/app/dist`.
   * Overwrites the default Nginx config with [nginx.conf](file:///d:/projects/clyra/clyra/nginx.conf) to route all requests back to `index.html`, allowing React Router (client-side routing) to work flawlessly.
   * Exposes port `80`.

```dockerfile
# See full configuration in the source: Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

ARG VITE_SIGNALING_SERVER_URL
ARG VITE_FIREBASE_API_KEY
...
ENV VITE_SIGNALING_SERVER_URL=$VITE_SIGNALING_SERVER_URL
...

COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### B. Backend Containerization (`/server/Dockerfile`)
The backend is a Node.js signaling server. Its containerization is straightforward:

* Uses `node:22-alpine` for a lightweight runtime footprint.
* Installs dependencies via `npm ci` for fast, reproducible builds.
* Copies the backend source code.
* Exposes port `3001` and runs `node server.js`.

---

## 3. CI/CD Pipelines (GitHub Actions)

Two independent GitHub Actions workflows automate the integration and deployment of frontend and backend changes.

### A. Frontend Pipeline (`frontend-deploy.yml`)
Runs whenever changes are pushed to `main` affecting the frontend code (`src/**`, `public/**`, configuration files, or the root `Dockerfile`).

* **Docker Build & Push Job:**
  1. Checks out the repository.
  2. Authenticates with Docker Hub using repository secrets.
  3. Builds the Docker image, passing all Firebase and API variables as `--build-arg`s.
  4. Pushes the image tagged as `latest` to Docker Hub.
* **Deploy Job:**
  1. SSHs securely into the AWS EC2 instance using the `appleboy/ssh-action` workflow.
  2. Runs a deployment script on EC2:
     * Pulls the newly updated Docker image from Docker Hub.
     * Gracefully stops and removes any running `clyra-frontend` container.
     * Launches a new container mapping host port `80` to container port `80` with `--restart unless-stopped`.

### B. Backend Pipeline (`backend-deploy.yml`)
Runs on pushes to the `main` branch. It divides the workflow into four distinct steps for security and verification:

1. **Test Job:** Setup Node.js (with npm caching enabled) and run test suites if present.
2. **Build Job:** Gathers backend sources, installs dependencies, and uploads the server workspace as a GitHub Actions run artifact (`backend-source`).
3. **Docker Job:** Downloads the build artifact, authenticates with Docker Hub, builds the container image (`server/Dockerfile`), and pushes to Docker Hub.
4. **Deploy Job:** SSHs into the AWS EC2 instance, pulls the new backend image, stops/removes the existing container, and starts a new container mapping port `3001:3001`.

---

## 4. AWS EC2 Production Environment & SSH Automation

Deployments on AWS EC2 are **zero-touch** and fully automated through SSH-based workflows. 

### EC2 Environment Setup
The host EC2 instance is configured with:
* **Docker Engine** installed and running as a daemon.
* **Security Group Rules** configured to allow inbound traffic on:
  * Port `22` (SSH) — restricted to GitHub Action Runner IPs or secured securely.
  * Port `80` (HTTP) — for frontend client traffic.
  * Port `3001` (TCP) — for backend Socket.IO and WebRTC signaling connections.

### Zero-Touch Releases Workflow
During the deploy phase of each pipeline, GitHub Actions establishes an SSH connection. Rather than manual file copies, the deployment script uses container orchestration commands:

```bash
# Pull the latest image
docker pull <username>/clyra-backend:latest

# Stop and remove the existing container to release the host port
docker stop clyra-backend || true
docker rm clyra-backend || true

# Run the new container with restart policies
docker run -d \
  --name clyra-backend \
  --restart unless-stopped \
  -p 3001:3001 \
  <username>/clyra-backend:latest
```

This guarantees:
* **No local configuration changes on EC2:** The server host remains completely stateless; configurations are isolated inside Docker.
* **Auto-recovery:** If the EC2 host restarts, the Docker daemon automatically restarts the frontend and backend containers via `--restart unless-stopped`.

---

## 5. Step-by-Step Configuration Guide

To set up or replicate this pipeline, follow these configuration steps:

### Step 1: Configure GitHub Repository Secrets
Navigate to **Settings > Secrets and variables > Actions** in your GitHub repository and add the following secrets:

| Secret Name | Description |
|:---|:---|
| `DOCKER_USERNAME` | Your Docker Hub account username. |
| `DOCKER_PASSWORD` | Your Docker Hub personal access token (PAT). |
| `EC2_HOST` | The public IPv4 address or DNS of your AWS EC2 instance. |
| `EC2_USER` | The SSH username for your instance (e.g., `ubuntu` or `ec2-user`). |
| `EC2_SSH_KEY` | The raw private key (`.pem`) used to SSH into the EC2 instance. |
| `VITE_SIGNALING_SERVER_URL` | The public URL of your EC2 backend (e.g., `http://<ec2-ip>:3001`). |
| `VITE_FIREBASE_API_KEY` | Firebase Client API Key (for frontend auth/database). |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication Domain. |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project Identifier. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID. |
| `VITE_FIREBASE_APP_ID` | Firebase App ID. |
| `VITE_FIREBASE_MEASUREMENT_ID`| Firebase Analytics Measurement ID. |

### Step 2: Set Up the AWS EC2 Instance
1. Launch an EC2 Instance (Ubuntu 22.04 LTS recommended).
2. Install Docker:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io
   sudo systemctl enable docker
   sudo systemctl start docker
   # Add your ssh user to the docker group to run docker commands without sudo
   sudo usermod -aG docker $USER
   # Apply changes
   newgrp docker
   ```
3. Configure your Security Group inbound rules:
   * **Inbound HTTP (Port 80):** `0.0.0.0/0`
   * **Inbound Node Server (Port 3001):** `0.0.0.0/0`
   * **Inbound SSH (Port 22):** Your IP or GitHub Actions Runner IP ranges.

### Step 3: Triggering Deployments
Simply push code to the `main` branch. GitHub Actions will pick up the changes, run tests, build the containers, publish them to Docker Hub, SSH into the EC2 instance, and deploy the updated application immediately.

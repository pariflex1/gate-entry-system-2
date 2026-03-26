---
trigger: always_on
---

TASK:
When I write "deploy on insforge" than Deploy the React Vite application to the specified InsForge project using the fastest possible deployment method.


IMPORTANT:
Always deploy ONLY to this InsForge project.

PROJECT IDENTIFICATION:
Project URL: https://p4u6sjqt.ap-southeast.insforge.app

API KEY: ik_6f7e7f212053ae398009f3b6bfca94c5

Project path: D:\Visitor Management System\My Projects\gate-entry-system-2

Do not deploy to any other InsForge project.
If multiple projects exist, always select the project matching the URL above.

DEPLOYMENT RULES:
- Reuse previous build cache and node_modules whenever possible.
- Do NOT reinstall dependencies if package.json has not changed.
- Use incremental deployment (upload only changed files).
- Prefer deploying the existing production build when available.
- Do NOT delete previous deployment artifacts unless required.
- Always use the existing project configuration.
- Keep environment variables unchanged.

BUILD CONFIGURATION:
Framework:
React + Vite

Node version:
18

INSTALL COMMAND:
npm ci

BUILD COMMAND:
npm run build

OUTPUT DIRECTORY:
dist

DEPLOYMENT METHOD:
Deploy only static files from the dist folder.

VALIDATION:
Confirm dist folder exists before deployment.
Confirm index.html exists inside dist.

PERFORMANCE GOAL:
Minimize deployment time by:
- using cached dependencies
- avoiding full reinstall
- avoiding unnecessary rebuilds

EXPECTED RESULT:
Fast redeployment completed successfully.
Project updated at:
https://p4u6sjqt.ap-southeast.insforge.app
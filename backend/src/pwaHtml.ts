import fs from 'node:fs';
import path from 'node:path';

let cachedHtml = '';

export function getPwaHtml(): string {
  if (cachedHtml) {
    return cachedHtml;
  }

  // Attempt to read from public directory in current or parent working directory
  const possiblePaths = [
    path.resolve(process.cwd(), 'public', 'index.html'),
    path.resolve(process.cwd(), '..', 'public', 'index.html'),
    path.resolve(process.cwd(), 'backend', 'public', 'index.html'),
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        cachedHtml = fs.readFileSync(p, 'utf-8');
        return cachedHtml;
      }
    } catch {
      // Continue to next path
    }
  }

  // Fallback inline template in case file system is inaccessible on serverless
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Synvy — Personal Assistant</title>
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Synvy">
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png?v=2">
  <link rel="icon" type="image/png" href="/favicon.png?v=2">
  <link rel="manifest" href="/manifest.json?v=2">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div style="padding: 40px; text-align: center; color: white; background: #07090E; min-height: 100vh; font-family: -apple-system, sans-serif;">
    <h2>Synvy Assistant</h2>
    <p><a href="/index.html" style="color: #06B6D4;">Click here to load Synvy app</a></p>
  </div>
  <script src="/app.js"></script>
</body>
</html>`;
}

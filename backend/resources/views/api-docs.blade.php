<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Josbin POS — Open Integration API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; }
    .topbar {
      background: linear-gradient(135deg, #1a5276, #2c3e50);
      color: #fff; padding: 16px 28px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .topbar h1 { margin: 0; font-size: 18px; font-weight: 800; }
    .topbar p  { margin: 3px 0 0; font-size: 13px; opacity: .82; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>Josbin POS — Open Integration API</h1>
    <p>Layer 3 REST API for third-party POS integration · v1</p>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: {!! json_encode(route('v1.docs.spec')) !!},
      dom_id: '#swagger-ui',
      deepLinking: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 1,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>

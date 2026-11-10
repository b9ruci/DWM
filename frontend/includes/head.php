<?php
// Cabecera HTML común. Cada página define $pageTitle y $active antes de incluirla.
// La URL pública del API Gateway se toma de la variable de entorno API_BASE_URL;
// el navegador NO recibe ningún secreto, solo esta URL pública.
$apiBase = getenv('API_BASE_URL') ?: 'http://localhost:8080/api/v1';
if (!filter_var($apiBase, FILTER_VALIDATE_URL)) {
    $apiBase = 'http://localhost:8080/api/v1';
}
$pageTitle = $pageTitle ?? 'Chocolatería Chocomanía';
$version = '3.0.0';
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Chocolatería Chocomanía: chocolates artesanales, figuras, bombones y órdenes especiales.">
  <title><?= htmlspecialchars($pageTitle) ?> · Chocomanía</title>
  <link rel="icon" href="/assets/img/logo.svg" type="image/svg+xml">
  <!-- Dependencias versionadas y autoalojadas (sin CDN): Bootstrap 5.3.8, Bootstrap Icons 1.11.3, fuentes Fontsource -->
  <link href="/assets/vendor/fonts/fonts.css" rel="stylesheet">
  <link href="/assets/vendor/bootstrap-5.3.8/bootstrap.min.css" rel="stylesheet">
  <link href="/assets/vendor/bootstrap-icons-1.11.3/bootstrap-icons.min.css" rel="stylesheet">
  <link href="/assets/css/styles.css?v=<?= $version ?>" rel="stylesheet">
  <script>
    window.CHOCO_CONFIG = Object.freeze({ apiBase: <?= json_encode($apiBase, JSON_UNESCAPED_SLASHES) ?>, version: <?= json_encode($version) ?> });
  </script>
</head>
<body data-page="<?= htmlspecialchars($active ?? '') ?>">
<a class="visually-hidden-focusable" href="#contenido">Saltar al contenido</a>

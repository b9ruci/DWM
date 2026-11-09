<?php
$pageTitle = 'Catálogo';
$active = 'catalogo';
$pageScript = 'catalogo';
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<div class="page-hero"><div class="container-xl"><h1>Catálogo</h1><p class="mb-0">Chocolates artesanales hechos a mano.</p></div></div>
<section class="section">
  <div class="container-xl">
    <div class="row g-4">
      <aside class="col-12 col-lg-3">
        <div class="panel">
          <form id="filtros" role="search" novalidate>
            <label for="buscar" class="form-label fw-bold">Buscar</label>
            <input id="buscar" name="q" type="search" class="form-control mb-3" placeholder="Ej: bombones" maxlength="50" pattern="[\p{L}\p{N}\s'\-]{0,50}">
            <div class="invalid-feedback mb-2">Usa solo letras, números y espacios.</div>
            <p class="form-label fw-bold mb-2">Categoría</p>
            <div class="filter-chips" id="chips" role="group" aria-label="Filtrar por categoría"></div>
          </form>
        </div>
      </aside>
      <div class="col-12 col-lg-9">
        <p class="text-secondary" id="resumen" aria-live="polite"></p>
        <div id="catalogo"></div>
      </div>
    </div>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>

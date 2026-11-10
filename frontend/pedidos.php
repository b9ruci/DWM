<?php
$pageTitle = 'Mis pedidos';
$active = 'pedidos';
$pageScript = 'pedidos';
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<div class="page-hero"><div class="container-xl"><h1>Mis pedidos</h1><p class="mb-0">Estado de tus pedidos y pagos (vista agregada mediante GraphQL).</p></div></div>
<section class="section">
  <div class="container-xl">
    <div id="avisoPago" aria-live="polite"></div>
    <div class="row g-4">
      <div class="col-12 col-lg-5">
        <div class="panel">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h2 class="fs-4 mb-0">Historial</h2>
            <button class="btn btn-sm btn-outline-choco" type="button" id="btnRefrescar"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>
          </div>
          <div id="listaPedidos" class="d-flex flex-column gap-2"></div>
          <nav class="d-flex justify-content-between mt-3" aria-label="Paginación de pedidos">
            <button class="btn btn-sm btn-outline-choco" type="button" id="btnPrev">Anteriores</button>
            <span class="small align-self-center" id="paginaInfo"></span>
            <button class="btn btn-sm btn-outline-choco" type="button" id="btnNext">Siguientes</button>
          </nav>
        </div>
      </div>
      <div class="col-12 col-lg-7">
        <div class="panel" id="detallePedido" data-testid="order-detail">
          <p class="text-secondary mb-0">Selecciona un pedido para ver su detalle.</p>
        </div>
      </div>
    </div>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>

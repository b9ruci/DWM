<?php
$pageTitle = 'Servicios';
$active = 'servicios';
$pageScript = 'servicios';
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<div class="page-hero"><div class="container-xl"><h1>Servicios</h1></div></div>
<section class="section">
  <div class="container-xl">
    <div class="row g-4">
      <div class="col-12 col-lg-8">
        <div class="accordion" id="accordionServicios"></div>
      </div>
      <div class="col-12 col-lg-4">
        <div class="special-box">
          <img src="/assets/img/orden-especial.svg" alt="" width="140" height="140">
          <p class="stamp mb-0">¿Tienes una idea especial?</p>
          <a class="btn btn-gold" href="/contacto.php?tipo=ORDEN_ESPECIAL">¡Contáctanos!</a>
        </div>
      </div>
    </div>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>

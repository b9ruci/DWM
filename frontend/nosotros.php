<?php
$pageTitle = 'Nosotros';
$active = 'nosotros';
$pageScript = 'nosotros';
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<div class="page-hero"><div class="container-xl"><h1>Nosotros</h1></div></div>
<section class="section" id="quienes-somos">
  <div class="container-xl">
    <div class="section-title"><h2>Quiénes somos</h2></div>
    <div class="row g-4 align-items-center">
      <div class="col-12 col-md-8">
        <p class="fs-5">Chocomanía es una chocolatería artesanal (caso ficticio de curso) que elabora figuras, bombones y barras de chocolate hechas a mano, con ingredientes seleccionados y despacho en Santiago.</p>
        <p class="mb-0">Nacimos como un pequeño taller familiar y hoy combinamos recetas tradicionales con productos de temporada, como nuestra barra estilo Dubái rellena de pistacho.</p>
      </div>
      <div class="col-12 col-md-4 text-center">
        <img src="/assets/img/productos/bombones.svg" alt="Caja de bombones" width="220" height="220" class="rounded-4 border border-2 border-dark">
      </div>
    </div>
  </div>
</section>
<section class="section" id="equipo">
  <div class="container-xl">
    <div class="section-title"><h2>Nuestro equipo</h2></div>
    <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3" id="listaEquipo"></div>
  </div>
</section>
<section class="section" id="mision">
  <div class="container-xl">
    <div class="section-title"><h2>Misión y valores</h2></div>
    <div class="row g-3">
      <div class="col-12 col-md-4"><div class="panel h-100"><h3 class="fs-5">Artesanal</h3><p class="mb-0">Cada pieza se moldea y decora a mano.</p></div></div>
      <div class="col-12 col-md-4"><div class="panel h-100"><h3 class="fs-5">Personalizado</h3><p class="mb-0">Escuchamos tu idea y la convertimos en chocolate.</p></div></div>
      <div class="col-12 col-md-4"><div class="panel h-100"><h3 class="fs-5">Responsable</h3><p class="mb-0">Cuidamos tus datos y solo pedimos lo necesario para entregar tu pedido.</p></div></div>
    </div>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>

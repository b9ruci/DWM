<?php
$pageTitle = 'Inicio';
$active = 'inicio';
$pageScript = 'home';
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<!-- Carrusel de promociones (GET /api/v1/promotions → inventory) -->
<section class="hero" aria-label="Promociones">
  <div class="container-xl">
    <div class="hero-shell">
      <button class="hero-arrow" type="button" data-bs-target="#promoCarousel" data-bs-slide="prev" aria-label="Promoción anterior"><i class="bi bi-chevron-left"></i></button>
      <div id="promoCarousel" class="carousel slide" data-bs-ride="carousel" data-bs-interval="6000">
        <div class="carousel-inner" id="promoSlides">
          <div class="carousel-item active"><div class="hero-slide skeleton" style="min-height:300px"></div></div>
        </div>
      </div>
      <button class="hero-arrow" type="button" data-bs-target="#promoCarousel" data-bs-slide="next" aria-label="Promoción siguiente"><i class="bi bi-chevron-right"></i></button>
    </div>
    <div class="carousel-indicators hero-dots" id="promoDots"></div>
  </div>
</section>

<!-- Productos destacados (GET /api/v1/products?destacado=true → inventory) -->
<section class="section" aria-labelledby="tituloDestacados">
  <div class="container-xl">
    <div class="section-title"><h2 id="tituloDestacados">Productos destacados</h2></div>
    <div class="rail-wrap">
      <div class="product-rail" id="destacados" tabindex="0" aria-label="Productos destacados, desplazable horizontalmente"></div>
    </div>
  </div>
</section>

<!-- Órdenes especiales -->
<section class="section" aria-labelledby="tituloEspeciales">
  <div class="container-xl">
    <div class="section-title"><h2 id="tituloEspeciales">Órdenes especiales</h2></div>
    <div class="row g-4 align-items-stretch">
      <div class="col-12 col-lg-7">
        <p class="fs-5">Somos expertos y nos destacamos en:</p>
        <ul class="special-list fs-5">
          <li>Figuras de chocolate personalizadas para cumpleaños, bautizos y matrimonios.</li>
          <li>Cajas de bombones corporativas con el logo de tu empresa.</li>
          <li>Barras rellenas y sabores especiales <strong>y más</strong>, con despacho en Santiago.</li>
        </ul>
        <p class="fs-5 mb-0">Podemos afinar detalles si deseas algo en específico: cuéntanos tu idea, la fecha y la cantidad, y te enviaremos una propuesta.</p>
      </div>
      <div class="col-12 col-lg-5">
        <div class="special-box">
          <img src="/assets/img/orden-especial.svg" alt="" width="140" height="140">
          <p class="stamp mb-0">Orden a pedido customizado</p>
          <p class="mb-0 text-secondary">Respondemos en un máximo de 2 días hábiles.</p>
          <a class="btn btn-gold btn-lg px-4" href="/contacto.php?tipo=ORDEN_ESPECIAL" data-testid="cta-contacto">¡Contáctanos!</a>
        </div>
      </div>
    </div>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>

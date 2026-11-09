<?php
$pageTitle = 'Contacto';
$active = 'servicios';
$pageScript = 'contacto';
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<div class="page-hero"><div class="container-xl"><h1>Contáctanos</h1><p class="mb-0">Consultas y órdenes a pedido customizadas.</p></div></div>
<section class="section">
  <div class="container-xl">
    <div class="row g-4">
      <div class="col-12 col-lg-7">
        <div class="panel">
          <h2 class="fs-4">Envíanos un mensaje</h2>
          <form id="formContacto" novalidate>
            <div class="row g-3">
              <div class="col-12 col-sm-6">
                <label for="nombre" class="form-label">Nombre</label>
                <input type="text" class="form-control" id="nombre" name="nombre" required minlength="2" maxlength="80" autocomplete="name">
                <div class="invalid-feedback">Ingresa tu nombre (mínimo 2 caracteres).</div>
              </div>
              <div class="col-12 col-sm-6">
                <label for="correo" class="form-label">Correo electrónico</label>
                <input type="email" class="form-control" id="correo" name="email" required maxlength="120" autocomplete="email">
                <div class="invalid-feedback">Ingresa un correo válido.</div>
              </div>
              <div class="col-12">
                <label for="tipo" class="form-label">Tipo de solicitud</label>
                <select class="form-select" id="tipo" name="tipo" required>
                  <option value="CONSULTA">Consulta general</option>
                  <option value="ORDEN_ESPECIAL">Orden a pedido customizado</option>
                </select>
              </div>
              <div class="col-12">
                <label for="mensaje" class="form-label">Mensaje</label>
                <textarea class="form-control" id="mensaje" name="mensaje" rows="5" required minlength="10" maxlength="1000" placeholder="Cuéntanos qué necesitas, para qué fecha y cuántas unidades."></textarea>
                <div class="invalid-feedback">El mensaje debe tener entre 10 y 1000 caracteres.</div>
              </div>
            </div>
            <div class="form-msg mt-3" aria-live="polite"></div>
            <button type="submit" class="btn btn-choco mt-2" data-testid="contact-submit">Enviar solicitud</button>
          </form>
        </div>
      </div>
      <div class="col-12 col-lg-5">
        <div class="panel">
          <h2 class="fs-4">Nuestros canales</h2>
          <div id="listaCanales" class="list-group list-group-flush"></div>
        </div>
      </div>
    </div>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>

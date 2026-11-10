<?php
$pageTitle = 'Carrito';
$active = 'carrito';
$pageScript = 'carrito';
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<div class="page-hero"><div class="container-xl"><h1>Tu carrito</h1></div></div>
<section class="section">
  <div class="container-xl">
    <div class="row g-4">
      <div class="col-12 col-lg-7">
        <div class="panel">
          <h2 class="fs-4">Productos</h2>
          <div id="lineas"></div>
        </div>
      </div>
      <div class="col-12 col-lg-5">
        <div class="panel">
          <h2 class="fs-4">Resumen</h2>
          <div id="resumenCarrito"></div>
          <p class="small text-secondary mt-2 mb-3">El total final lo calcula el servidor con los precios vigentes al confirmar. Despacho $3.990 (gratis desde $50.000).</p>
          <form id="checkoutForm" novalidate>
            <h3 class="fs-5">Datos de despacho</h3>
            <div class="mb-2">
              <label for="direccion" class="form-label">Dirección</label>
              <input id="direccion" name="direccion" class="form-control" required minlength="5" maxlength="200" autocomplete="street-address">
              <div class="invalid-feedback">Ingresa una dirección (mínimo 5 caracteres).</div>
            </div>
            <div class="mb-2">
              <label for="comuna" class="form-label">Comuna</label>
              <input id="comuna" name="comuna" class="form-control" required minlength="2" maxlength="60" autocomplete="address-level2">
              <div class="invalid-feedback">Ingresa la comuna.</div>
            </div>
            <div class="mb-3">
              <label for="notas" class="form-label">Notas (opcional)</label>
              <textarea id="notas" name="notas" class="form-control" maxlength="300" rows="2" placeholder="Ej: tocar el timbre 2 veces"></textarea>
            </div>
            <div class="form-msg" aria-live="polite"></div>
            <button type="submit" class="btn btn-choco w-100 btn-lg" id="btnConfirmar" data-testid="checkout-submit">Confirmar pedido y pagar</button>
          </form>
        </div>
      </div>
    </div>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>

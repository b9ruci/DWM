<?php
$pageTitle = 'Administración';
$active = 'admin';
$pageScript = 'admin';
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<div class="page-hero"><div class="container-xl"><h1>Administración</h1><p class="mb-0">Acceso restringido al rol ADMIN (verificado por el API Gateway y por cada servicio).</p></div></div>
<section class="section">
  <div class="container-xl" id="adminRoot">
    <ul class="nav nav-pills mb-3 gap-2 flex-wrap" role="tablist">
      <li class="nav-item"><button class="nav-link active" data-bs-toggle="pill" data-bs-target="#tResumen" type="button">Resumen</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#tPedidos" type="button" data-testid="tab-admin-pedidos">Pedidos</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#tProductos" type="button" data-testid="tab-admin-productos">Productos</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#tSolicitudes" type="button">Solicitudes</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="pill" data-bs-target="#tClientes" type="button">Clientes</button></li>
    </ul>
    <div class="tab-content">
      <div class="tab-pane fade show active" id="tResumen"><div class="panel" id="resumenVentas"></div></div>
      <div class="tab-pane fade" id="tPedidos">
        <div class="panel">
          <div class="d-flex gap-2 align-items-center mb-2 flex-wrap">
            <label for="filtroEstado" class="form-label mb-0">Estado</label>
            <select id="filtroEstado" class="form-select form-select-sm w-auto">
              <option value="">Todos</option><option>PENDIENTE_PAGO</option><option>PAGADO</option><option>EN_PREPARACION</option><option>DESPACHADO</option><option>ENTREGADO</option><option>CANCELADO</option>
            </select>
          </div>
          <div id="adminPedidos"></div>
        </div>
      </div>
      <div class="tab-pane fade" id="tProductos">
        <div class="panel">
          <div class="d-flex justify-content-between mb-2"><h2 class="fs-5 mb-0">Productos</h2><button class="btn btn-choco btn-sm" type="button" id="btnNuevoProducto" data-testid="new-product">Nuevo producto</button></div>
          <div id="adminProductos"></div>
        </div>
      </div>
      <div class="tab-pane fade" id="tSolicitudes"><div class="panel" id="adminSolicitudes"></div></div>
      <div class="tab-pane fade" id="tClientes"><div class="panel" id="adminClientes"></div></div>
    </div>
  </div>
</section>

<div class="modal fade" id="productoModal" tabindex="-1" aria-labelledby="productoModalTitle" aria-hidden="true">
  <div class="modal-dialog modal-lg modal-dialog-scrollable">
    <form class="modal-content" id="productoForm" novalidate>
      <div class="modal-header"><h2 class="modal-title fs-5" id="productoModalTitle">Producto</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>
      <div class="modal-body">
        <input type="hidden" name="id">
        <div class="row g-3">
          <div class="col-12 col-md-8"><label class="form-label" for="pNombre">Nombre</label><input class="form-control" id="pNombre" name="nombre" required minlength="3" maxlength="80"><div class="invalid-feedback">Entre 3 y 80 caracteres.</div></div>
          <div class="col-12 col-md-4"><label class="form-label" for="pSku">SKU</label><input class="form-control" id="pSku" name="sku" required pattern="[A-Z0-9\-]{3,30}" maxlength="30"><div class="invalid-feedback">Mayúsculas, números y guiones.</div></div>
          <div class="col-12"><label class="form-label" for="pDesc">Descripción</label><textarea class="form-control" id="pDesc" name="descripcion" maxlength="400" rows="2"></textarea></div>
          <div class="col-6 col-md-3"><label class="form-label" for="pCat">Categoría</label><select class="form-select" id="pCat" name="categoria" required><option>Barras</option><option>Figuras</option><option>Bombones</option><option>Bebidas</option></select></div>
          <div class="col-6 col-md-3"><label class="form-label" for="pUnidad">Unidad</label><select class="form-select" id="pUnidad" name="unidad"><option value="unidad">Unidad</option><option value="kg">Kilo</option></select></div>
          <div class="col-6 col-md-3"><label class="form-label" for="pPrecio">Precio (CLP)</label><input class="form-control" id="pPrecio" name="precio" type="number" required min="1" max="10000000" step="1"><div class="invalid-feedback">Entero mayor que 0.</div></div>
          <div class="col-6 col-md-3"><label class="form-label" for="pStock">Stock</label><input class="form-control" id="pStock" name="stock" type="number" required min="0" max="100000" step="1"><div class="invalid-feedback">Entero ≥ 0.</div></div>
          <div class="col-12 col-md-8"><label class="form-label" for="pImg">Imagen (ruta)</label><input class="form-control" id="pImg" name="imagen" maxlength="200" placeholder="/assets/img/productos/generico.svg"></div>
          <div class="col-12 col-md-4 d-flex flex-column justify-content-end gap-1">
            <div class="form-check"><input class="form-check-input" type="checkbox" id="pDest" name="destacado"><label class="form-check-label" for="pDest">Destacado</label></div>
            <div class="form-check"><input class="form-check-input" type="checkbox" id="pAct" name="activo" checked><label class="form-check-label" for="pAct">Activo</label></div>
          </div>
        </div>
        <div class="form-msg mt-3" aria-live="polite"></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button><button type="submit" class="btn btn-choco" data-testid="product-save">Guardar</button></div>
    </form>
  </div>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>

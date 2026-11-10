<?php
// Encabezado según el mockup: logo (izquierda, dos filas) · título + buscador + usuario (arriba)
// · navegación con dropdowns al pasar el cursor + carrito con contador (abajo).
$active = $active ?? '';
$nav = function (string $key) use ($active) {
    return $active === $key ? ' active" aria-current="page' : '';
};
?>
<header class="site-header">
  <div class="container-xl">
    <div class="row g-2 g-md-3 align-items-center">
      <div class="col-auto col-md-2 col-xl-1">
        <a class="brand-logo" href="/index.php" aria-label="Ir al inicio"><img src="/assets/img/logo.svg" alt="Logo Chocomanía" width="120" height="120"></a>
      </div>
      <div class="col">
        <div class="header-top">
          <p class="brand-title font-title"><a href="/index.php">Chocolatería Chocomanía</a></p>
          <div class="header-actions">
            <form class="header-search input-group d-none d-lg-flex" role="search" action="/catalogo.php" method="get">
              <input class="form-control" type="search" name="q" placeholder="Buscar chocolates…" aria-label="Buscar productos" maxlength="50">
              <button class="btn" type="submit" aria-label="Buscar"><i class="bi bi-search"></i></button>
            </form>
            <div class="dropdown">
              <button class="icon-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Cuenta de usuario" id="userMenuButton" data-testid="user-menu">
                <i class="bi bi-person"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end" id="userMenu" aria-labelledby="userMenuButton">
                <!-- se completa con JS según la sesión -->
              </ul>
            </div>
          </div>
        </div>
        <nav class="navbar navbar-expand-lg main-nav" aria-label="Navegación principal">
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Abrir menú">
            <span class="navbar-toggler-icon"></span>
          </button>
          <a class="icon-btn ms-auto d-lg-none" href="/carrito.php" aria-label="Carrito" data-testid="cart-link-mobile">
            <i class="bi bi-cart3"></i><span class="cart-badge" data-cart-count>0</span>
          </a>
          <div class="collapse navbar-collapse" id="mainNav">
            <ul class="navbar-nav me-auto">
              <li class="nav-item"><a class="nav-link<?= $nav('inicio') ?>" href="/index.php">Inicio</a></li>
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle<?= $nav('catalogo') ?>" href="/catalogo.php" role="button" data-bs-toggle="dropdown" aria-expanded="false">Catálogo</a>
                <ul class="dropdown-menu" id="navCategorias">
                  <li><a class="dropdown-item" href="/catalogo.php">Todo el catálogo</a></li>
                  <!-- categorías desde GET /api/v1/categories -->
                </ul>
              </li>
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle<?= $nav('nosotros') ?>" href="/nosotros.php" role="button" data-bs-toggle="dropdown" aria-expanded="false">Nosotros</a>
                <ul class="dropdown-menu">
                  <li><a class="dropdown-item" href="/nosotros.php#quienes-somos">Quiénes somos</a></li>
                  <li><a class="dropdown-item" href="/nosotros.php#equipo">Nuestro equipo</a></li>
                  <li><a class="dropdown-item" href="/nosotros.php#mision">Misión y valores</a></li>
                </ul>
              </li>
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle<?= $nav('servicios') ?>" href="/servicios.php" role="button" data-bs-toggle="dropdown" aria-expanded="false">Servicios</a>
                <ul class="dropdown-menu">
                  <li><a class="dropdown-item" href="/servicios.php">Nuestros servicios</a></li>
                  <li><a class="dropdown-item" href="/contacto.php?tipo=ORDEN_ESPECIAL">Órdenes especiales</a></li>
                  <li><a class="dropdown-item" href="/contacto.php">Contacto</a></li>
                </ul>
              </li>
            </ul>
            <form class="d-lg-none mt-2" role="search" action="/catalogo.php" method="get">
              <input class="form-control" type="search" name="q" placeholder="Buscar chocolates…" aria-label="Buscar productos" maxlength="50">
            </form>
          </div>
          <a class="icon-btn d-none d-lg-inline-flex" href="/carrito.php" aria-label="Carrito" data-testid="cart-link">
            <i class="bi bi-cart3"></i><span class="cart-badge" data-cart-count>0</span>
          </a>
        </nav>
      </div>
    </div>
  </div>
</header>

<!-- Modal de autenticación (ingresar / crear cuenta) -->
<div class="modal fade" id="authModal" tabindex="-1" aria-labelledby="authModalTitle" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title fs-4" id="authModalTitle">Mi cuenta</h2>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
      </div>
      <div class="modal-body">
        <div id="authNotice" class="alert alert-warning d-none" role="alert"></div>
        <ul class="nav nav-tabs mb-3" role="tablist">
          <li class="nav-item" role="presentation"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tabLogin" type="button" role="tab">Ingresar</button></li>
          <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabRegistro" type="button" role="tab" data-testid="tab-registro">Crear cuenta</button></li>
        </ul>
        <div class="tab-content">
          <div class="tab-pane fade show active" id="tabLogin" role="tabpanel">
            <form id="loginForm" novalidate>
              <div class="mb-3">
                <label for="loginEmail" class="form-label">Correo electrónico</label>
                <input type="email" class="form-control" id="loginEmail" name="email" autocomplete="username" required maxlength="120">
                <div class="invalid-feedback">Ingresa un correo válido.</div>
              </div>
              <div class="mb-3">
                <label for="loginPassword" class="form-label">Contraseña</label>
                <input type="password" class="form-control" id="loginPassword" name="password" autocomplete="current-password" required maxlength="72">
                <div class="invalid-feedback">Ingresa tu contraseña.</div>
              </div>
              <div class="form-msg" aria-live="polite"></div>
              <button type="submit" class="btn btn-choco w-100" data-testid="login-submit">Ingresar</button>
            </form>
          </div>
          <div class="tab-pane fade" id="tabRegistro" role="tabpanel">
            <form id="registerForm" novalidate>
              <div class="mb-3">
                <label for="regNombre" class="form-label">Nombre</label>
                <input type="text" class="form-control" id="regNombre" name="nombre" autocomplete="name" required minlength="2" maxlength="80">
                <div class="invalid-feedback">Ingresa tu nombre (mínimo 2 caracteres).</div>
              </div>
              <div class="mb-3">
                <label for="regEmail" class="form-label">Correo electrónico</label>
                <input type="email" class="form-control" id="regEmail" name="email" autocomplete="email" required maxlength="120">
                <div class="invalid-feedback">Ingresa un correo válido.</div>
              </div>
              <div class="mb-3">
                <label for="regPassword" class="form-label">Contraseña</label>
                <input type="password" class="form-control" id="regPassword" name="password" autocomplete="new-password" required minlength="8" maxlength="72" pattern="(?=.*[A-Za-z])(?=.*\d).{8,}">
                <div class="form-text">Mínimo 8 caracteres, con letras y números.</div>
                <div class="invalid-feedback">Mínimo 8 caracteres, con letras y números.</div>
              </div>
              <div class="form-msg" aria-live="polite"></div>
              <button type="submit" class="btn btn-gold w-100" data-testid="register-submit">Crear cuenta</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="toast-zone" id="toastZone" aria-live="polite"></div>
<main id="contenido">

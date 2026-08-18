<!-- index.php -->
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Bootstrap 5</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
</head>

<body>
<!-- navbar -->
<nav class="navbar navbar-expand-sm bg-dark navbar-dark">
    <div class="container-fluid">
      <a class="navbar-brand" href="index.php">Logo</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#collapsibleNavbar">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="collapsibleNavbar">
        <ul class="navbar-nav me-auto">
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">Link 1</a>
            <ul class="dropdown-menu">
              <li><a class="dropdown-item" href="#">Quienes somos</a></li>
              <li><a class="dropdown-item" href="#">Nuestro equipo</a></li>
              <li><a class="dropdown-item" href="#">Mision</a></li>
            </ul>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="productos.php">Productos</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="servicios.php">Servicios</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="contacto.php">Contacto</a>
          </li>
        </ul>
        <button type="button" class="btn btn-outline-light" data-bs-toggle="modal" data-bs-target="#loginModal">
          Iniciar sesión
        </button>
      </div>
    </div>
</nav>

<!-- Modal de Login -->
<div class="modal" id="loginModal">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h4 class="modal-title">Iniciar sesión</h4>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <form>
          <div class="mb-3">
            <label for="loginEmail" class="form-label">Correo electrónico</label>
            <input type="email" class="form-control" id="loginEmail" placeholder="nombre@ejemplo.com">
          </div>
          <div class="mb-3">
            <label for="loginPassword" class="form-label">Contraseña</label>
            <input type="password" class="form-control" id="loginPassword" placeholder="Contraseña">
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-danger" data-bs-dismiss="modal">Cerrar</button>
        <button type="button" class="btn btn-primary">Ingresar</button>
      </div>
    </div>
  </div>
</div>

<div class="container-fluid p-5 bg-primary text-white text-center">
  <h1>Primera página en bootstrap</h1>
  <p>Miau</p>
</div>

<!-- Carousel -->
<div id="demo" class="carousel slide" data-bs-ride="carousel">
  <div class="carousel-indicators">
    <button type="button" data-bs-target="#demo" data-bs-slide-to="0" class="active"></button>
    <button type="button" data-bs-target="#demo" data-bs-slide-to="1"></button>
    <button type="button" data-bs-target="#demo" data-bs-slide-to="2"></button>
  </div>

<div class="carousel-inner">
    <div class="carousel-item active">
      <img src="https://i.pinimg.com/736x/0b/8c/f7/0b8cf7640d3b1e88aeb79526c6998910.jpg" alt="Momonga cigarro 1" class="d-block w-100" style="height: 400px; object-fit: contain;">
    </div>
    <div class="carousel-item">
      <img src="https://i.pinimg.com/736x/ab/46/49/ab464965c3a4fae0067aa1e71b824da9.jpg" alt="Momonga porro miserable 2" class="d-block w-100" style="height: 400px; object-fit: contain;">
    </div>
    <div class="carousel-item">
      <img src="https://i.pinimg.com/736x/bf/f9/9c/bff99c0afacf0209d90aefbb2cf20bd0.jpg" alt="Momonga feliz 3" class="d-block w-100" style="height: 400px; object-fit: contain;">
    </div>
</div>

  <button class="carousel-control-prev" type="button" data-bs-target="#demo" data-bs-slide="prev">
    <span class="carousel-control-prev-icon"></span>
  </button>
  <button class="carousel-control-next" type="button" data-bs-target="#demo" data-bs-slide="next">
    <span class="carousel-control-next-icon"></span>
  </button>
</div>

<div class="container-fluid mt-3">
	<div class="row">
		<div class="bg-primary col-12">Navbar</div>
	</div>
	<div class="row">
		<div class="bg-primary col-3">Izq</div>
		<div class="bg-secondary col-6">Centro</div>
		<div class="bg-warning col-3">Der</div>
	</div>

	<div class="row">
		<div class="bg-primary col-4">Izq</div>
		<div class="bg-warning col-4">Centro</div>
		<div class="bg-primary col-4">Der</div>
	</div>
</div>
</body>
</html>
<!-- servicios.php -->
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
  <h1>Servicios</h1>
</div>

<div class="container-fluid mt-3">
  <div class="accordion" id="accordionServicios">
  </div>
</div>

<script>
  const resAPI = {
    "status": 200,
    "message": "Servicios obtenidos",
    "data": [
      {"id": "1", "nombre": "Instalación", "descripcion": "Instalamos el producto en tu domicilio con garantía incluida."},
      {"id": "2", "nombre": "Mantención", "descripcion": "Revisión y mantención periódica para asegurar el buen funcionamiento."},
      {"id": "3", "nombre": "Reparación", "descripcion": "Diagnóstico y reparación de fallas por técnicos certificados."}
    ]
  };

  function cargarServicios(resAPI) {
    delete resAPI.status;
    delete resAPI.message;

    const contenedor = document.getElementById("accordionServicios");

    Object.values(resAPI.data).forEach((servicio, index) => {
      const item = document.createElement("div");
      item.classList.add("accordion-item");

      const header = document.createElement("h2");
      header.classList.add("accordion-header");

      const boton = document.createElement("button");
      boton.classList.add("accordion-button");
      if (index !== 0) boton.classList.add("collapsed"); // solo el primero abierto
      boton.setAttribute("type", "button");
      boton.setAttribute("data-bs-toggle", "collapse");
      boton.setAttribute("data-bs-target", "#collapse" + index);
      boton.innerText = servicio.nombre;

      header.appendChild(boton);

      const collapseDiv = document.createElement("div");
      collapseDiv.id = "collapse" + index;
      collapseDiv.classList.add("accordion-collapse", "collapse");
      if (index === 0) collapseDiv.classList.add("show");
      collapseDiv.setAttribute("data-bs-parent", "#accordionServicios");

      const body = document.createElement("div");
      body.classList.add("accordion-body");
      body.innerText = servicio.descripcion;

      collapseDiv.appendChild(body);
      item.appendChild(header);
      item.appendChild(collapseDiv);
      contenedor.appendChild(item);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    cargarServicios(resAPI);
  });
</script>
</body>
</html>
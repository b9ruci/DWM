<!-- contacto.php -->
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
  <h1>Contacto</h1>
</div>

<div class="container-fluid mt-3">
<div class="container-fluid mt-3">
  <div class="row">
    <div class="col-md-6">
      <h3>Envíanos un mensaje</h3>
      <form id="formContacto">
        <div class="mb-3">
          <label for="nombre" class="form-label">Nombre</label>
          <input type="text" class="form-control" id="nombre" placeholder="Tu nombre">
        </div>
        <div class="mb-3">
          <label for="correo" class="form-label">Correo electrónico</label>
          <input type="email" class="form-control" id="correo" placeholder="nombre@ejemplo.com">
        </div>
        <div class="mb-3">
          <label for="mensaje" class="form-label">Mensaje</label>
          <textarea class="form-control" id="mensaje" rows="4" placeholder="Escribe tu mensaje"></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Enviar</button>
      </form>
      <div id="respuestaContacto" class="mt-3"></div>
    </div>

    <div class="col-md-6">
      <h3>Nuestros canales</h3>
      <div id="listaCanales" class="list-group"></div>
    </div>
  </div>
</div>
</div>
<script>
  const resAPI = {
    "status": 200,
    "message": "Canales obtenidos",
    "data": [
      {"id": "1", "tipo": "Teléfono", "valor": "+56 9 1234 5678"},
      {"id": "2", "tipo": "Correo", "valor": "contacto@negocio.cl"},
      {"id": "3", "tipo": "Dirección", "valor": "Av. Siempre Viva 123, Santiago"}
    ]
  };

  function cargarCanales(resAPI) {
    delete resAPI.status;
    delete resAPI.message;

    const contenedor = document.getElementById("listaCanales");

    Object.values(resAPI.data).forEach(canal => {
      const item = document.createElement("div");
      item.classList.add("list-group-item");

      const tipo = document.createElement("strong");
      tipo.innerText = canal.tipo + ": ";

      const valor = document.createElement("span");
      valor.innerText = canal.valor;

      item.appendChild(tipo);
      item.appendChild(valor);
      contenedor.appendChild(item);
    });
  }

  function manejarEnvio(event) {
    event.preventDefault();

    const datosFormulario = {
      nombre: document.getElementById("nombre").value,
      correo: document.getElementById("correo").value,
      mensaje: document.getElementById("mensaje").value
    };

    console.log(datosFormulario);

    const respuesta = document.getElementById("respuestaContacto");
    respuesta.innerHTML = "";

    const alerta = document.createElement("div");
    alerta.classList.add("alert", "alert-success");
    alerta.innerText = `Gracias ${datosFormulario.nombre}, recibimos tu mensaje.`;

    respuesta.appendChild(alerta);
  }

  document.addEventListener("DOMContentLoaded", () => {
    cargarCanales(resAPI);
    document.getElementById("formContacto").addEventListener("submit", manejarEnvio);
  });
</script>
</body>
</html>
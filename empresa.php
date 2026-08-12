<!DOCTYPE html>
<html lang="en">
<head>
  <title>Bootstrap 5</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js"></script>
    <style>@import url('https://cory.anota.do/spacehey/windows_xp.css');.hideobj{ visibility: hidden; height: 20px; width: 0%; }</style>
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
        <ul class="navbar-nav">
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">Link 1</a>
            <ul class="dropdown-menu">
              <li><a class="dropdown-item" href="#">Quienes somos</a></li>
              <li><a class="dropdown-item" href="#">Nuestro equipo</a></li>
              <li><a class="dropdown-item" href="#">Mision</a></li>
            </ul>
            <li class="nav-item">
              <a class="nav-link" href="productos.php">Productos</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="contacto.php">Contacto</a>
            </li>
        </ul>
      </div>

<div class="container-fluid p-5 bg-primary text-white text-center">
  <h1>Página principal</h1>
  <p>Miau</p> 
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

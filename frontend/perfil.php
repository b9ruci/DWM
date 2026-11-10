<?php
$pageTitle = 'Mi perfil';
$active = 'perfil';
$pageScript = 'perfil';
require __DIR__ . '/includes/head.php';
require __DIR__ . '/includes/header.php';
?>
<div class="page-hero"><div class="container-xl"><h1>Mi perfil</h1><p class="mb-0">Tus datos personales se guardan cifrados y solo tú y la administración pueden verlos.</p></div></div>
<section class="section">
  <div class="container-xl">
    <div class="row justify-content-center">
      <div class="col-12 col-md-10 col-lg-7">
        <div class="panel" id="perfilPanel"></div>
      </div>
    </div>
  </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>

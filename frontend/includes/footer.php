</main>
<footer class="site-footer">
  <div class="container-xl">
    <div class="row g-4">
      <div class="col-12 col-md-4">
        <h3>Chocolatería Chocomanía</h3>
        <p class="mb-0">Chocolates artesanales hechos a mano en Santiago. Figuras, bombones, barras y órdenes a pedido.</p>
      </div>
      <div class="col-6 col-md-4">
        <h3>Explora</h3>
        <ul class="list-unstyled mb-0">
          <li><a href="/catalogo.php">Catálogo</a></li>
          <li><a href="/servicios.php">Servicios</a></li>
          <li><a href="/nosotros.php">Nosotros</a></li>
          <li><a href="/contacto.php">Contacto</a></li>
        </ul>
      </div>
      <div class="col-6 col-md-4">
        <h3>Contacto</h3>
        <ul class="list-unstyled mb-0">
          <li><i class="bi bi-geo-alt"></i> Av. Cacao 100, Santiago (ficticia)</li>
          <li><i class="bi bi-telephone"></i> +56 2 2345 6789 (ficticio)</li>
          <li><i class="bi bi-envelope"></i> hola@chocomania.test</li>
        </ul>
      </div>
    </div>
    <hr class="border-secondary">
    <p class="small mb-0">© 2026 Chocomanía · Proyecto académico con datos ficticios · v<?= htmlspecialchars($version) ?></p>
  </div>
</footer>
<script src="/assets/vendor/bootstrap-5.3.8/bootstrap.bundle.min.js"></script>
<script type="module" src="/assets/js/core/header.js?v=<?= $version ?>"></script>
<?php if (!empty($pageScript)): ?>
<script type="module" src="/assets/js/pages/<?= htmlspecialchars($pageScript) ?>.js?v=<?= $version ?>"></script>
<?php endif; ?>
</body>
</html>

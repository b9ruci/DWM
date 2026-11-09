// Servicios: acordeón generado desde contenido informativo estático (assets/data/servicios.json).
import { el, showLoading, showError } from '../core/ui.js';

async function cargar() {
  const acc = document.getElementById('accordionServicios');
  showLoading(acc);
  try {
    const res = await fetch('/assets/data/servicios.json');
    if (!res.ok) throw new Error(String(res.status));
    const servicios = await res.json();
    acc.replaceChildren(...servicios.map((s, i) => el('div', { class: 'accordion-item' }, [
      el('h2', { class: 'accordion-header' }, [
        el('button', { class: `accordion-button fw-bold${i ? ' collapsed' : ''}`, type: 'button', 'data-bs-toggle': 'collapse', 'data-bs-target': `#srv-${s.id}`, 'aria-expanded': String(i === 0), text: s.nombre }),
      ]),
      el('div', { id: `srv-${s.id}`, class: `accordion-collapse collapse${i ? '' : ' show'}`, 'data-bs-parent': '#accordionServicios' }, [
        el('div', { class: 'accordion-body d-flex flex-column flex-sm-row gap-3 align-items-sm-center justify-content-between' }, [
          el('p', { class: 'mb-0', text: s.descripcion }),
          el('a', { class: 'btn btn-outline-choco btn-sm flex-shrink-0', href: s.cta, text: 'Más información' }),
        ]),
      ]),
    ])));
  } catch {
    showError(acc, { error: { message: 'No pudimos cargar los servicios.' } }, cargar);
  }
}
cargar();

// Equipo: contenido informativo estático (assets/data/equipo.json). No es dato de negocio,
// por lo que no se integra con el backend (decisión documentada en el informe).
import { el, showLoading, showError } from '../core/ui.js';

async function cargarEquipo() {
  const box = document.getElementById('listaEquipo');
  showLoading(box);
  try {
    const res = await fetch('/assets/data/equipo.json');
    if (!res.ok) throw new Error(String(res.status));
    const equipo = await res.json();
    box.replaceChildren(...equipo.map((p) => el('div', { class: 'col' }, [
      el('div', { class: 'panel team-card h-100' }, [
        el('div', { class: 'avatar', text: p.inicial, 'aria-hidden': 'true' }),
        el('h3', { class: 'fs-5 mb-1', text: p.nombre }),
        el('p', { class: 'mb-0 text-secondary', text: p.cargo }),
        el('p', { class: 'small mb-0 text-secondary', text: p.nota }),
      ]),
    ])));
  } catch {
    showError(box, { error: { message: 'No pudimos cargar el equipo.' } }, cargarEquipo);
  }
}
cargarEquipo();

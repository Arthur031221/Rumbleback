import { h } from './dom.ts';
import { icon } from './icons.ts';
import { t } from './i18n.ts';

const CARDS = ['p', 'depth', 'mmi', 'real'] as const;

export function createLearn() {
  const dialog = h('dialog', { class: 'sheet learn', 'aria-labelledby': 'learn-title' });
  const title = h('h2', { id: 'learn-title', class: 'sheet-title' });
  const closeBtn = h('button', { class: 'icon-btn', type: 'button', onclick: () => dialog.close() }, icon('close'));
  // Scrollable, so a keyboard user has to be able to reach it.
  const body = h('div', { class: 'learn-body', tabindex: 0, role: 'region', 'aria-labelledby': 'learn-title' });
  dialog.append(h('div', { class: 'sheet-head' }, title, closeBtn), body);
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());

  function render(): void {
    title.textContent = t('learn.title');
    closeBtn.setAttribute('aria-label', t('common.close'));
    body.replaceChildren(
      ...CARDS.map((key) =>
        h(
          'section',
          { class: `learn-card learn-${key}` },
          h('h3', { text: t(`learn.${key}.title`) }),
          h('p', { text: t(`learn.${key}.body`) }),
        ),
      ),
      h('p', { class: 'fine', text: t('learn.sources') }),
    );
  }

  return {
    open(): void {
      render();
      if (!dialog.open) dialog.showModal();
    },
    relocalize: render,
    element: dialog,
  };
}

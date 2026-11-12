/* sitefast copy of the CHUDOVI kit (+ru, lang from <html lang>). Studio-standard bug button: dialog opens with the MMIX Review Kit card (comments pinned to page elements →
   /api/review → review.mmix.biz), then a plain description form posted to review.mmix.biz/api/bug-report.
   Follows the page language switch (html[data-lang]). */
(function () {
  'use strict';
  var ENDPOINT = 'https://review.mmix.biz/api/bug-report';
  var T = {
    en: {
      launcher: 'Report a problem', close: 'Close', title: 'Something not working?',
      lede: "Tell us what went wrong on this page. The report goes straight to the site's developers.",
      reviewTitle: 'Comment right on the page',
      reviewSub: 'Click any element or drag over an area and leave a note. Send everything at the end.',
      reviewGo: 'Start commenting →', or: 'Or describe it in a few words:', description: 'What happened?',
      placeholder: 'What you clicked, what you expected, what you saw', email: 'E-mail (optional)',
      emailHint: 'Only if you want an answer.', submit: 'Send report', sending: 'Sending…',
      thanks: 'Thank you, the report is in.', another: 'Send another',
      errEmpty: 'Please describe what went wrong.', errSend: 'Could not send. Please try again in a minute.'
    },
    uk: {
      launcher: 'Повідомити про проблему', close: 'Закрити', title: 'Щось не працює?',
      lede: 'Напишіть, що не так на цій сторінці. Повідомлення одразу отримають розробники сайту.',
      reviewTitle: 'Коментувати просто на сторінці',
      reviewSub: 'Натисніть на будь-який елемент або виділіть ділянку й залиште нотатку. Надсилання в кінці.',
      reviewGo: 'Почати →', or: 'Або опишіть кількома словами:', description: 'Що сталося?',
      placeholder: 'Що натиснули, що очікували, що побачили', email: 'E-mail (необов’язково)',
      emailHint: 'Лише якщо потрібна відповідь.', submit: 'Надіслати', sending: 'Надсилаємо…',
      thanks: 'Дякуємо, повідомлення отримано.', another: 'Надіслати ще',
      errEmpty: 'Опишіть, що не так.', errSend: 'Не вдалося надіслати. Спробуйте за хвилину.'
    },
    ru: {
      launcher: 'Сообщить о проблеме', close: 'Закрыть', title: 'Что-то не так?',
      lede: 'Напишите, что поправить на этой странице. Сообщение сразу получат разработчики сайта.',
      reviewTitle: 'Комментировать прямо на странице',
      reviewSub: 'Нажмите на любой элемент или выделите область и оставьте заметку. Отправка в конце.',
      reviewGo: 'Начать →', or: 'Или опишите в двух словах:', description: 'Что поправить?',
      placeholder: 'Что нажали, что ожидали, что увидели', email: 'E-mail (необязательно)',
      emailHint: 'Только если нужен ответ.', submit: 'Отправить', sending: 'Отправляем…',
      thanks: 'Спасибо, сообщение получено.', another: 'Отправить ещё',
      errEmpty: 'Опишите, что не так.', errSend: 'Не удалось отправить. Попробуйте через минуту.'
    },
    fr: {
      launcher: 'Signaler un problème', close: 'Fermer', title: 'Quelque chose ne fonctionne pas\u00a0?',
      lede: 'Dites-nous ce qui ne va pas sur cette page. Le message va directement aux développeurs du site.',
      reviewTitle: 'Commenter directement sur la page',
      reviewSub: 'Cliquez sur un élément ou encadrez une zone et laissez une note. Envoi à la fin.',
      reviewGo: 'Commencer →', or: 'Ou décrivez-le en quelques mots\u00a0:', description: 'Que s’est-il passé\u00a0?',
      placeholder: 'Ce que vous avez cliqué, ce que vous attendiez, ce que vous avez vu', email: 'Courriel (facultatif)',
      emailHint: 'Seulement si vous voulez une réponse.', submit: 'Envoyer', sending: 'Envoi…',
      thanks: 'Merci, le message est reçu.', another: 'En envoyer un autre',
      errEmpty: 'Décrivez ce qui ne va pas.', errSend: 'Envoi impossible. Réessayez dans une minute.'
    },
    es: {
      launcher: 'Informar un problema', close: 'Cerrar', title: '¿Algo no funciona?',
      lede: 'Cuéntanos qué falla en esta página. El mensaje va directamente a los desarrolladores del sitio.',
      reviewTitle: 'Comentar directamente en la página',
      reviewSub: 'Haz clic en un elemento o marca una zona y deja una nota. Se envía al final.',
      reviewGo: 'Empezar →', or: 'O descríbelo en pocas palabras:', description: '¿Qué pasó?',
      placeholder: 'Qué pulsaste, qué esperabas, qué viste', email: 'Correo (opcional)',
      emailHint: 'Solo si quieres una respuesta.', submit: 'Enviar', sending: 'Enviando…',
      thanks: 'Gracias, el mensaje llegó.', another: 'Enviar otro',
      errEmpty: 'Describe qué falla.', errSend: 'No se pudo enviar. Inténtalo en un minuto.'
    }
  };
  var ICON_BUG = '<path d="M8 6.5V5a4 4 0 0 1 8 0v1.5"/><rect x="6" y="7" width="12" height="13" rx="6"/><path d="M12 11v9M3 13h3M18 13h3M4 8l2.5 2M20 8l-2.5 2M4 19l2.5-2M20 19l-2.5-2"/>';
  var ICON_X = '<path d="M6 6l12 12M18 6L6 18"/>';

  var lang = function () { var h = document.documentElement, l = h.getAttribute('data-lang') || (h.getAttribute('lang') || '').slice(0, 2).toLowerCase(); return T[l] ? l : 'en'; };
  var el = function (tag, attrs, html) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var wrap = el('div', { class: 'bugr' });
  var btn = el('button', { type: 'button', class: 'bugr-btn', 'aria-expanded': 'false', 'aria-haspopup': 'dialog' });
  wrap.appendChild(btn);
  document.body.appendChild(wrap);

  var open = false, sent = false, sending = false, startedAt = 0, dlg = null, veil = null;
  var draft = { description: '', email: '' };

  function paintBtn() {
    var t = T[lang()];
    btn.setAttribute('aria-label', open ? t.close : t.launcher);
    btn.setAttribute('title', t.launcher);
    btn.setAttribute('aria-expanded', String(open));
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (open ? ICON_X : ICON_BUG) + '</svg>';
  }

  function focusables() {
    return dlg ? Array.prototype.filter.call(dlg.querySelectorAll('button:not([disabled]), textarea, input:not(.bugr-hp)'), function (n) { return n.offsetParent !== null; }) : [];
  }

  function render(err) {
    if (dlg) { dlg.remove(); veil.remove(); dlg = veil = null; }
    paintBtn();
    if (!open) return;
    var t = T[lang()];
    veil = el('div', { class: 'bugr-veil', 'aria-hidden': 'true' });
    veil.addEventListener('click', close);
    dlg = el('div', { class: 'bugr-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'bugr-t', 'aria-describedby': 'bugr-l', tabindex: '-1' });
    var body = sent
      ? '<div role="status" class="bugr-done"><p>✓ ' + esc(t.thanks) + '</p><button type="button" data-again>' + esc(t.another) + '</button></div>'
      : '<form novalidate>' +
        '<mmix-review-entry title-text="' + esc(t.reviewTitle) + '" sub-text="' + esc(t.reviewSub) + '" go-text="' + esc(t.reviewGo) + '"></mmix-review-entry>' +
        '<p class="bugr-or">' + esc(t.or) + '</p>' +
        '<label><span>' + esc(t.description) + '</span><textarea name="d" rows="4" maxlength="4000" placeholder="' + esc(t.placeholder) + '"></textarea></label>' +
        '<label><span>' + esc(t.email) + '</span><input type="email" name="e" autocomplete="email" maxlength="200"><small>' + esc(t.emailHint) + '</small></label>' +
        '<input class="bugr-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        (err ? '<p role="alert" class="bugr-err">' + esc(err) + '</p>' : '') +
        '<button type="submit" class="bugr-send"' + (sending ? ' disabled' : '') + '>' + esc(sending ? t.sending : t.submit) + '</button></form>';
    dlg.innerHTML = '<div class="bugr-head"><h2 id="bugr-t">' + esc(t.title) + '</h2><button type="button" class="bugr-x" aria-label="' + esc(t.close) + '">×</button></div>' +
      '<p id="bugr-l" class="bugr-lede">' + esc(t.lede) + '</p>' + body;
    wrap.appendChild(veil);
    wrap.appendChild(dlg);
    dlg.querySelector('.bugr-x').addEventListener('click', close);
    var again = dlg.querySelector('[data-again]');
    if (again) again.addEventListener('click', function () { sent = false; startedAt = Date.now(); render(); });
    var form = dlg.querySelector('form');
    if (form) {
      form.d.value = draft.description;
      form.e.value = draft.email;
      form.d.addEventListener('input', function () { draft.description = form.d.value; });
      form.e.addEventListener('input', function () { draft.email = form.e.value; });
      form.addEventListener('submit', submit);
    }
    dlg.addEventListener('keydown', onKey);
    var entry = dlg.querySelector('mmix-review-entry');
    var first = (entry && entry.shadowRoot && entry.shadowRoot.querySelector('button')) || dlg.querySelector('textarea') || dlg.querySelector('button');
    (err ? dlg.querySelector('textarea') : first || dlg).focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    var els = focusables();
    if (!els.length) return;
    var a = els[0], z = els[els.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }

  function close() {
    if (!open) return;
    open = false;
    render();
    btn.focus();
  }

  function submit(e) {
    e.preventDefault();
    if (sending) return;
    var t = T[lang()], form = e.target;
    var description = form.d.value.trim();
    if (description.length < 5) { render(t.errEmpty); return; }
    sending = true;
    render();
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        description: description, email: draft.email.trim(), pageUrl: location.href, userAgent: navigator.userAgent,
        viewport: innerWidth + 'x' + innerHeight, lang: lang(), startedAt: startedAt, website: form.website.value
      })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.ok === false) throw new Error(); });
    }).then(function () {
      sending = false; sent = true; draft = { description: '', email: '' }; render();
    }).catch(function () {
      sending = false; render(t.errSend);
    });
  }

  btn.addEventListener('click', function () {
    if (open) { close(); return; }
    open = true; startedAt = Date.now(); render();
  });
  document.addEventListener('mmixreview:entry', function () { if (open) { open = false; render(); } });
  new MutationObserver(function () { if (open) render(); else paintBtn(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
  paintBtn();
})();

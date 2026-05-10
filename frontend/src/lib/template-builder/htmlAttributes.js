function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function findHtmlAttributesSector() {
  return [...document.querySelectorAll('.gjs-sm-sector')]
    .find((el) => el.textContent.includes('HTML Attributes'))
    ?.querySelector('.gjs-sm-properties');
}

function setFieldValue(root, name, value) {
  const field = root.querySelector(`[data-html-attr-field="${name}"]`);
  if (field && value !== undefined && value !== null) {
    field.value = value;
  }
}

function hidePlaceholderProperty(root) {
  const placeholder = root.querySelector('[data-sm-property="data-gjs-attr-editor-placeholder"]');
  if (placeholder) {
    placeholder.style.display = 'none';
  }
}

function syncBuilderFromSelected(root, editor) {
  const selected = editor.getSelected();
  if (!selected) return;

  const attrs = selected.getAttributes();
  const tagName = selected.get('tagName') || '';
  const isImageTag = String(tagName || '').toLowerCase() === 'img' || selected.is?.('image');

  setFieldValue(root, 'tag', tagName);
  setFieldValue(root, 'src', attrs.src || '');
  setFieldValue(root, 'href', attrs.href || '');
  setFieldValue(root, 'alt', attrs.alt || '');
  setFieldValue(root, 'title', attrs.title || '');
  setFieldValue(root, 'target', attrs.target || '');

  const uploadButton = root.querySelector('[data-html-attr-upload-image]');
  if (uploadButton) {
    uploadButton.hidden = !isImageTag;
  }
}

function chooseFileAsDataUrl(accept = 'image/*') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    input.addEventListener('change', () => {
      const file = input.files?.[0];

      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        resolve({
          file,
          dataUrl: reader.result
        });
      };

      reader.readAsDataURL(file);
    });

    input.click();
  });
}

function buildHtmlAttributesPanel(root, editor, options = {}) {
  const uploadImageAsset = typeof options.uploadImageAsset === 'function' ? options.uploadImageAsset : null;
  const selected = editor.getSelected();
  if (!selected) return;

  const existing = root.querySelector('[data-html-attribute-builder]');
  if (existing) {
    hidePlaceholderProperty(root);
    syncBuilderFromSelected(root, editor);
    return;
  }

  const attrs = selected.getAttributes();
  const tagName = selected.get('tagName') || '';
  const isImageTag = String(tagName || '').toLowerCase() === 'img' || selected.is?.('image');
  hidePlaceholderProperty(root);
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-html-attribute-builder', 'true');
  wrapper.style.padding = '8px';
  wrapper.style.width = '100%';
  wrapper.style.boxSizing = 'border-box';

  wrapper.innerHTML = `
    <div class="vstack gap-2">
      <div class="small text-body-secondary">
        Edit the selected component's HTML attributes without leaving the canvas.
      </div>

      <label class="form-label mb-0">Tag</label>
      <input class="form-control form-control-sm" data-html-attr-field="tag" readonly value="${escapeHtml(tagName)}">

      <label class="form-label mb-0">src</label>
      <input class="form-control form-control-sm" data-html-attr-field="src" value="${escapeHtml(attrs.src || '')}">
      <button type="button" class="btn btn-sm btn-outline-secondary" data-html-attr-upload-image>
        Choose Image File
      </button>

      <label class="form-label mb-0">href</label>
      <input class="form-control form-control-sm" data-html-attr-field="href" value="${escapeHtml(attrs.href || '')}">

      <label class="form-label mb-0">alt</label>
      <input class="form-control form-control-sm" data-html-attr-field="alt" value="${escapeHtml(attrs.alt || '')}">

      <label class="form-label mb-0">title</label>
      <input class="form-control form-control-sm" data-html-attr-field="title" value="${escapeHtml(attrs.title || '')}">

      <label class="form-label mb-0">target</label>
      <select class="form-select form-select-sm" data-html-attr-field="target">
        <option value="">Same tab</option>
        <option value="_blank">New tab</option>
      </select>

      <button type="button" class="btn btn-sm btn-outline-primary" data-html-attr-apply>
        Apply HTML Attributes
      </button>
    </div>
  `;

  root.appendChild(wrapper);

  const uploadButton = wrapper.querySelector('[data-html-attr-upload-image]');
  if (uploadButton) {
    uploadButton.hidden = !isImageTag || !uploadImageAsset;
  }

  const targetField = wrapper.querySelector('[data-html-attr-field="target"]');
  if (targetField) targetField.value = attrs.target || '';

  wrapper.querySelector('[data-html-attr-apply]')?.addEventListener('click', () => {
    const liveSelected = editor.getSelected();
    if (!liveSelected) return;

    const nextAttrs = { ...liveSelected.getAttributes() };

    wrapper.querySelectorAll('[data-html-attr-field]').forEach((field) => {
      const name = field.getAttribute('data-html-attr-field');
      if (!name || name === 'tag') return;
      const value = field.value.trim();
      if (value) {
        nextAttrs[name] = value;
      } else {
        delete nextAttrs[name];
      }
    });

    liveSelected.setAttributes(nextAttrs);
    editor.StyleManager.render();
    editor.refresh();
    syncBuilderFromSelected(root, editor);
  });

  uploadButton?.addEventListener('click', async () => {
    if (!uploadImageAsset) return;

    const liveSelected = editor.getSelected();
    if (!liveSelected) {
      alert('Select an image first.');
      return;
    }

    const liveTagName = String(liveSelected.get('tagName') || '').toLowerCase();
    if (liveTagName !== 'img') {
      alert('Select an image element first.');
      return;
    }

    const picked = await chooseFileAsDataUrl('image/*');
    if (!picked) return;

    const uploaded = await uploadImageAsset(picked.file, picked.dataUrl);
    if (!uploaded?.file_url) {
      alert('Image upload failed');
      return;
    }

    const srcField = wrapper.querySelector('[data-html-attr-field="src"]');
    if (srcField) {
      srcField.value = uploaded.file_url;
    }

    liveSelected.setAttributes({
      ...liveSelected.getAttributes(),
      src: uploaded.file_url
    });

    editor.StyleManager.render();
    editor.refresh();
    syncBuilderFromSelected(root, editor);
  });
}

export function installHtmlAttributeControls(editor, options = {}) {
  const scheduleInstall = () => {
    window.setTimeout(() => {
      const sector = findHtmlAttributesSector();
      if (!sector) return;
      buildHtmlAttributesPanel(sector, editor, options);
    }, 100);
  };

  editor.StyleManager.addSector('html-attributes', {
    name: 'HTML Attributes',
    open: true,
    properties: [
      {
        name: 'Selected element',
        property: 'data-gjs-attr-editor-placeholder',
        type: 'text',
        defaults: '',
        full: true
      }
    ]
  });
  editor.StyleManager.render();

  editor.on('component:selected', scheduleInstall);
  editor.on('style:target', scheduleInstall);
  editor.on('load', scheduleInstall);
  scheduleInstall();
}

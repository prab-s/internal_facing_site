function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function hexToRgba(hex, opacityPercent) {
  const cleanHex = String(hex || '').replace('#', '');
  const expandedHex =
    cleanHex.length === 3 ? cleanHex.split('').map((c) => c + c).join('') : cleanHex.padEnd(6, '0');
  const alpha = clampNumber(opacityPercent, 0, 100, 100) / 100;
  const bigint = Number.parseInt(expandedHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => Number(value).toString(16).padStart(2, '0'))
    .join('')}`;
}

function getGradientValueFromInputs(root) {
  const type = root.querySelector('[data-gradient-field="type"]')?.value || 'linear';
  const angle = root.querySelector('[data-gradient-field="angle"]')?.value || '135';
  const direction = root.querySelector('[data-gradient-field="direction"]')?.value || '';
  const radialShape = root.querySelector('[data-gradient-field="radialShape"]')?.value || 'circle';
  const radialPosition = root.querySelector('[data-gradient-field="radialPosition"]')?.value || 'center';
  const colour1Hex = root.querySelector('[data-gradient-field="colour1"]')?.value || '#ffffff';
  const opacity1 = root.querySelector('[data-gradient-field="opacity1"]')?.value || '100';
  const stop1 = root.querySelector('[data-gradient-field="stop1"]')?.value || '0';
  const colour2Hex = root.querySelector('[data-gradient-field="colour2"]')?.value || '#000000';
  const opacity2 = root.querySelector('[data-gradient-field="opacity2"]')?.value || '100';
  const stop2 = root.querySelector('[data-gradient-field="stop2"]')?.value || '100';
  const colour1 = hexToRgba(colour1Hex, opacity1);
  const colour2 = hexToRgba(colour2Hex, opacity2);

  if (type === 'radial') {
    return `radial-gradient(${radialShape} at ${radialPosition}, ${colour1} ${stop1}%, ${colour2} ${stop2}%)`;
  }

  const linearDirection = direction || `${angle}deg`;
  return `linear-gradient(${linearDirection}, ${colour1} ${stop1}%, ${colour2} ${stop2}%)`;
}

function setGradientField(root, name, value) {
  const field = root.querySelector(`[data-gradient-field="${name}"]`);
  if (field && value !== undefined && value !== null) {
    field.value = value;
  }
}

function parseColourStop(colourValue, stopValue, root, colourField, opacityField, stopField) {
  const rgbaMatch = String(colourValue || '').match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/
  );
  if (rgbaMatch) {
    const r = rgbaMatch[1];
    const g = rgbaMatch[2];
    const b = rgbaMatch[3];
    const alpha = rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1;
    setGradientField(root, colourField, rgbToHex(r, g, b));
    setGradientField(root, opacityField, Math.round(alpha * 100));
    setGradientField(root, stopField, stopValue);
    return;
  }

  const hexMatch = String(colourValue || '').match(/#[0-9a-fA-F]{3,8}/);
  if (hexMatch) {
    setGradientField(root, colourField, hexMatch[0]);
    setGradientField(root, opacityField, 100);
    setGradientField(root, stopField, stopValue);
  }
}

function syncInputsFromGradient(root, gradient) {
  if (!gradient) return;
  const colourStopPattern = '(rgba?\\([^)]*\\)|#[0-9a-fA-F]{3,8})\\s+(\\d+)%';
  const linearRegex = new RegExp(`linear-gradient\\((.*?),\\s*${colourStopPattern}\\s*,\\s*${colourStopPattern}\\s*\\)`);
  const linearMatch = String(gradient).match(linearRegex);
  if (linearMatch) {
    const directionOrAngle = linearMatch[1];
    setGradientField(root, 'type', 'linear');
    if (directionOrAngle.endsWith('deg')) {
      setGradientField(root, 'direction', '');
      setGradientField(root, 'angle', directionOrAngle.replace('deg', ''));
    } else {
      setGradientField(root, 'direction', directionOrAngle);
    }
    parseColourStop(linearMatch[2], linearMatch[3], root, 'colour1', 'opacity1', 'stop1');
    parseColourStop(linearMatch[4], linearMatch[5], root, 'colour2', 'opacity2', 'stop2');
    return;
  }

  const radialRegex = new RegExp(
    `radial-gradient\\((circle|ellipse)\\s+at\\s+(.*?),\\s*${colourStopPattern}\\s*,\\s*${colourStopPattern}\\s*\\)`
  );
  const radialMatch = String(gradient).match(radialRegex);
  if (radialMatch) {
    setGradientField(root, 'type', 'radial');
    setGradientField(root, 'radialShape', radialMatch[1]);
    setGradientField(root, 'radialPosition', radialMatch[2]);
    parseColourStop(radialMatch[3], radialMatch[4], root, 'colour1', 'opacity1', 'stop1');
    parseColourStop(radialMatch[5], radialMatch[6], root, 'colour2', 'opacity2', 'stop2');
  }
}

export function installAdvancedGradientControls(editor) {
  const install = () => {
    const sector = [...document.querySelectorAll('.gjs-sm-sector')]
      .find((el) => el.textContent.includes('Advanced Gradient'))?.querySelector('.gjs-sm-properties');
    if (!sector) return;

    if (sector.querySelector('[data-gradient-builder]')) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-gradient-builder', 'true');
    wrapper.style.padding = '8px';
    wrapper.style.width = '100%';
    wrapper.style.boxSizing = 'border-box';
    wrapper.innerHTML = `
      <div class="vstack gap-2">
        <label class="form-label mb-0">Gradient type</label>
        <select class="form-select form-select-sm" data-gradient-field="type">
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
        </select>
        <div class="row g-2">
          <div class="col-6">
            <label class="form-label mb-0">Angle</label>
            <input class="form-control form-control-sm" type="number" data-gradient-field="angle" value="135" />
          </div>
          <div class="col-6">
            <label class="form-label mb-0">Direction</label>
            <input class="form-control form-control-sm" data-gradient-field="direction" />
          </div>
        </div>
        <div class="row g-2">
          <div class="col-6">
            <label class="form-label mb-0">Radial shape</label>
            <select class="form-select form-select-sm" data-gradient-field="radialShape">
              <option value="circle">Circle</option>
              <option value="ellipse">Ellipse</option>
            </select>
          </div>
          <div class="col-6">
            <label class="form-label mb-0">Radial position</label>
            <input class="form-control form-control-sm" data-gradient-field="radialPosition" value="center" />
          </div>
        </div>
        <div class="row g-2">
          <div class="col-4">
            <label class="form-label mb-0">Colour 1</label>
            <input class="form-control form-control-color w-100" type="color" data-gradient-field="colour1" value="#ffffff" />
          </div>
          <div class="col-4">
            <label class="form-label mb-0">Opacity 1</label>
            <input class="form-control form-control-sm" type="number" min="0" max="100" step="1" data-gradient-field="opacity1" value="100" />
          </div>
          <div class="col-4">
            <label class="form-label mb-0">Stop 1</label>
            <input class="form-control form-control-sm" type="number" min="0" max="100" step="1" data-gradient-field="stop1" value="0" />
          </div>
        </div>
        <div class="row g-2">
          <div class="col-4">
            <label class="form-label mb-0">Colour 2</label>
            <input class="form-control form-control-color w-100" type="color" data-gradient-field="colour2" value="#000000" />
          </div>
          <div class="col-4">
            <label class="form-label mb-0">Opacity 2</label>
            <input class="form-control form-control-sm" type="number" min="0" max="100" step="1" data-gradient-field="opacity2" value="100" />
          </div>
          <div class="col-4">
            <label class="form-label mb-0">Stop 2</label>
            <input class="form-control form-control-sm" type="number" min="0" max="100" step="1" data-gradient-field="stop2" value="100" />
          </div>
        </div>
        <label class="form-label mb-0">Generated CSS</label>
        <input class="form-control form-control-sm" data-gradient-output readonly />
        <button type="button" class="btn btn-sm btn-outline-primary" data-gradient-apply>Apply Gradient</button>
      </div>
    `;
    sector.appendChild(wrapper);

    const update = () => {
      const output = wrapper.querySelector('[data-gradient-output]');
      if (output) output.value = getGradientValueFromInputs(wrapper);
    };

    wrapper.querySelectorAll('input, select').forEach((input) => {
      input.addEventListener('input', update);
      input.addEventListener('change', update);
    });

    wrapper.querySelector('[data-gradient-apply]')?.addEventListener('click', () => {
      const selected = editor.getSelected();
      if (!selected) {
        window.alert('Select an element first.');
        return;
      }
      const gradient = getGradientValueFromInputs(wrapper);
      selected.addStyle({ 'background-image': gradient });
      editor.refresh();
      update();
    });

    const selected = editor.getSelected();
    if (selected) {
      const style = selected.getStyle();
      const backgroundImage = style['background-image'] || '';
      if (backgroundImage) {
        syncInputsFromGradient(wrapper, backgroundImage);
      }
    }

    update();
  };

  editor.StyleManager.addSector('advanced-gradient', {
    name: 'Advanced Gradient',
    open: true,
    properties: [
      {
        name: 'Background image',
        property: 'background-image',
        type: 'text',
        full: true,
        defaults: ''
      }
    ]
  });

  editor.on('style:target', () => {
    window.setTimeout(install, 100);
  });
  editor.on('component:selected', () => {
    window.setTimeout(install, 100);
  });
  editor.on('load', () => {
    window.setTimeout(install, 300);
  });
}
